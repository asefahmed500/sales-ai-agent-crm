"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AgentId, ChatMessage } from "@/lib/types";
import { DEFAULT_AGENTS } from "@/lib/agents";
import { agentSessionId } from "@/lib/api";

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  agentId: AgentId;
  sessionId: string;
  createdAt: number;
  updatedAt: number;
}

const STORAGE_KEY = "salesgenius.conversations.v1";

const uid = () => Math.random().toString(36).slice(2, 10);

function load(): Conversation[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persist(convs: Conversation[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(convs));
  } catch {
    /* quota / private mode */
  }
}

export function useConversations() {
  // start empty so SSR + first client render match; hydrate from storage in effect
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const activeIdRef = useRef<string | null>(null);

  useEffect(() => {
    const stored = load();
    setConversations(stored);
    if (stored.length > 0 && !activeIdRef.current) {
      const top = stored[0];
      setActiveId(top.id);
      activeIdRef.current = top.id;
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) persist(conversations);
  }, [conversations, hydrated]);

  const active = conversations.find((c) => c.id === activeId) ?? null;

  const newConversation = useCallback((agentId: AgentId): string => {
    const id = uid();
    const conv: Conversation = {
      id,
      title: "New chat",
      messages: [
        {
          id: uid(),
          role: "agent",
          agentId,
          agentName: DEFAULT_AGENTS.find((a) => a.id === agentId)?.name ?? "Agent",
          agentIcon: DEFAULT_AGENTS.find((a) => a.id === agentId)?.icon ?? "🤖",
          content: DEFAULT_AGENTS.find((a) => a.id === agentId)?.greeting ?? "Hi!",
          createdAt: new Date().toISOString(),
        },
      ],
      agentId,
      sessionId: agentSessionId(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setConversations((prev) => [conv, ...prev]);
    setActiveId(id);
    activeIdRef.current = id;
    return id;
  }, []);

  const selectConversation = useCallback((id: string) => {
    setActiveId(id);
    activeIdRef.current = id;
  }, []);

  const deleteConversation = useCallback(
    (id: string) => {
      setConversations((prev) => {
        const next = prev.filter((c) => c.id !== id);
        if (activeIdRef.current === id) {
          const top = next[0]?.id ?? null;
          setActiveId(top);
          activeIdRef.current = top;
        }
        return next;
      });
    },
    []
  );

  const renameConversation = useCallback((id: string, title: string) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, title } : c))
    );
  }, []);

  const appendMessage = useCallback((id: string, message: ChatMessage) => {
    setConversations((prev) =>
      prev.map((c) =>
        c.id === id
          ? {
              ...c,
              messages: [...c.messages, message],
              updatedAt: Date.now(),
              title:
                c.title === "New chat" && message.role === "user"
                  ? message.content.slice(0, 40)
                  : c.title,
            }
          : c
      )
    );
  }, []);

  const setConversationAgent = useCallback((id: string, agentId: AgentId) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, agentId } : c))
    );
  }, []);

  return {
    conversations,
    active,
    activeId,
    hydrated,
    newConversation,
    selectConversation,
    deleteConversation,
    renameConversation,
    appendMessage,
    setConversationAgent,
  };
}
