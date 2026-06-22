"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { MessageList } from "./message-list";
import { ChatInput } from "./chat-input";
import { api } from "@/lib/api";
import { DEFAULT_AGENTS } from "@/lib/agents";
import { useConversations } from "@/hooks/use-conversations";
import type {
  AgentDef,
  ChatMessage,
  Contact,
  Pipeline,
  TrajectoryStep,
} from "@/lib/types";

const uid = () => Math.random().toString(36).slice(2);

export function ChatShell() {
  const [agents, setAgents] = useState<AgentDef[]>(DEFAULT_AGENTS);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [pipeline, setPipeline] = useState<Pipeline | null>(null);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [sidebarPipeline, setSidebarPipeline] = useState<{ contacts: number; open: { value: number }; won: { value: number } } | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isThinking, setIsThinking] = useState(false);
  const [liveTrajectory, setLiveTrajectory] = useState<TrajectoryStep[]>([]);

  const conv = useConversations();
  const eventSourceRef = useRef<EventSource | null>(null);
  const liveTrajRef = useRef<TrajectoryStep[]>([]);
  useEffect(() => {
    liveTrajRef.current = liveTrajectory;
  }, [liveTrajectory]);

  const activeAgent =
    agents.find((a) => a.id === conv.active?.agentId) ?? DEFAULT_AGENTS[1];

  // Initial load
  useEffect(() => {
    (async () => {
      try {
        const remote = await api.agents();
        if (Array.isArray(remote) && remote.length === 4) setAgents(remote);
      } catch {
        /* keep defaults */
      }
    })();
  }, []);

  // periodic CRM refresh
  const refresh = useCallback(async () => {
    try {
      const [c, p] = await Promise.all([api.contacts(), api.pipeline()]);
      setContacts(c as Contact[]);
      const pip = p as Pipeline | null;
      setPipeline(pip);
      setSidebarPipeline(pip ? {
        contacts: (c as Contact[]).length,
        open: { value: pip.stages.filter((s) => s.stage !== "CLOSED_WON").reduce((sum, s) => sum + s.value, 0) },
        won: { value: pip.stages.find((s) => s.stage === "CLOSED_WON")?.value ?? 0 },
      } : null);
    } catch {
      /* ignore */
    }
  }, []);
  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 6000);
    return () => clearInterval(id);
  }, [refresh]);

  // Ensure there's an active conversation once hydrated
  useEffect(() => {
    if (conv.hydrated && !conv.activeId) {
      conv.newConversation(DEFAULT_AGENTS[1].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conv.hydrated, conv.activeId]);

  // close SSE on unmount
  useEffect(() => () => eventSourceRef.current?.close(), []);

  const handleAgentChange = useCallback(
    (a: AgentDef) => {
      if (conv.active) conv.setConversationAgent(conv.active.id, a.id);
    },
    [conv]
  );

  const handleSlash = useCallback(
    (text: string): boolean => {
      const cmd = text.toLowerCase().split(/\s+/)[0];
      if (cmd === "/clear") {
        conv.newConversation(activeAgent.id);
        return true;
      }
      const switchMap: Record<string, AgentDef | undefined> = {
        "/scout": agents.find((a) => a.id === "scout"),
        "/rep": agents.find((a) => a.id === "rep"),
        "/closer": agents.find((a) => a.id === "closer"),
        "/success": agents.find((a) => a.id === "success"),
      };
      const target = switchMap[cmd];
      if (target) {
        handleAgentChange(target);
        return true;
      }
      return false;
    },
    [conv, activeAgent, agents, handleAgentChange]
  );

  const sendMessage = useCallback(
    async (text: string) => {
      if (handleSlash(text)) return;

      // guarantee an active conversation exists
      let convId = conv.active?.id;
      if (!convId) convId = conv.newConversation(activeAgent.id);

      const agent = activeAgent;
      const sessionId = conv.active?.sessionId ?? uid();

      const userMsg: ChatMessage = {
        id: uid(),
        role: "user",
        content: text,
        createdAt: new Date().toISOString(),
      };
      conv.appendMessage(convId, userMsg);

      setIsThinking(true);
      setLiveTrajectory([]);

      // SSE
      eventSourceRef.current?.close();
      const sse = new EventSource(
        `${api.backendUrl}/api/agent/stream/${sessionId}`
      );
      eventSourceRef.current = sse;

      sse.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "trajectory_step") {
            setLiveTrajectory((prev) => [...prev, data.step]);
          } else if (data.type === "complete") {
            const agentMsg: ChatMessage = {
              id: uid(),
              role: "agent",
              agentId: agent.id,
              agentName: agent.name,
              agentIcon: agent.icon,
              content: data.response,
              trajectory: [...liveTrajRef.current],
              createdAt: new Date().toISOString(),
            };
            conv.appendMessage(convId!, agentMsg);
            setIsThinking(false);
            setLiveTrajectory([]);
            sse.close();
            eventSourceRef.current = null;
            refresh();
          }
        } catch {
          /* malformed */
        }
      };
      sse.onerror = () => {
        sse.close();
        setIsThinking(false);
      };

      // POST
      try {
        await fetch(`${api.backendUrl}/api/agent/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            contactId: selectedContact?.id,
            message: text,
            agent: agent.id,
          }),
        });
      } catch {
        setIsThinking(false);
        sse.close();
      }
    },
    [handleSlash, conv, activeAgent, selectedContact, refresh]
  );

  const messages = conv.active?.messages ?? [];

  return (
    <div className="flex h-screen w-full overflow-hidden bg-canvas">
      {/* Sidebar */}
      <div
        className={`shrink-0 transition-all duration-200 ease-out ${
          sidebarOpen ? "w-72" : "w-0"
        } overflow-hidden`}
      >
        <Sidebar
          conversations={conv.conversations}
          activeId={conv.activeId}
          onNew={() => conv.newConversation(activeAgent.id)}
          onSelect={conv.selectConversation}
          onDelete={conv.deleteConversation}
          pipeline={sidebarPipeline}
        />
      </div>

      {/* Main column */}
      <main className="flex min-w-0 flex-1 flex-col">
        <Header
          onToggleSidebar={() => setSidebarOpen((v) => !v)}
          sidebarOpen={sidebarOpen}
          agents={agents}
          activeAgent={activeAgent}
          onAgentChange={handleAgentChange}
          selectedContactName={selectedContact?.name ?? null}
        />

        <MessageList
          messages={messages}
          isThinking={isThinking}
          thinkingAgentId={activeAgent.id}
          thinkingAgentName={activeAgent.name}
          liveTrajectory={liveTrajectory}
        />

        <div className="border-t border-line bg-canvas px-4 py-4">
          <ChatInput disabled={isThinking} onSubmit={sendMessage} />
        </div>
      </main>
    </div>
  );
}
