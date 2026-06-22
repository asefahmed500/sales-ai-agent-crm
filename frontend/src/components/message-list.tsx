"use client";

import { useEffect, useRef } from "react";
import type { ChatMessage, TrajectoryStep } from "@/lib/types";
import { ACCENT } from "@/lib/agents";
import { AgentIcon } from "./icons";

interface MessageListProps {
  messages: ChatMessage[];
  isThinking: boolean;
  thinkingAgentId?: string;
  thinkingAgentName?: string;
  liveTrajectory: ChatMessage["trajectory"];
}

export function MessageList({
  messages,
  isThinking,
  thinkingAgentId,
  thinkingAgentName,
  liveTrajectory,
}: MessageListProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinking, liveTrajectory?.length]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 overflow-y-auto px-4 py-6">
      {messages.map((m) =>
        m.role === "user" ? (
          <UserBubble key={m.id} message={m} />
        ) : (
          <AgentBubble key={m.id} message={m} />
        )
      )}

      {isThinking && (
        <div className="msg-in flex gap-3">
          <Avatar agentId={thinkingAgentId || "rep"} />
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-1.5 text-xs text-muted">
              <span>{thinkingAgentName} is working</span>
              <span className="flex gap-0.5">
                <span className="dot h-1 w-1 rounded-full bg-muted" />
                <span className="dot h-1 w-1 rounded-full bg-muted" style={{ animationDelay: "0.15s" }} />
                <span className="dot h-1 w-1 rounded-full bg-muted" style={{ animationDelay: "0.3s" }} />
              </span>
            </div>
            {liveTrajectory && liveTrajectory.length > 0 && (
              <div className="space-y-1">
                {liveTrajectory.map((t, i) => (
                  <div
                    key={t.id || i}
                    className="flex items-center gap-2 rounded-md bg-panel-soft px-2.5 py-1 text-[11px] text-muted"
                  >
                    <span className="font-mono text-faint">▸</span>
                    <span className="truncate font-mono text-[11px]">{t.action}</span>
                    <span className="truncate text-faint">{t.thought}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div ref={endRef} />
    </div>
  );
}

function UserBubble({ message }: { message: ChatMessage }) {
  return (
    <div className="msg-in flex justify-end">
      <div className="max-w-[80%] rounded-2xl rounded-br-md bg-ink px-4 py-2.5 text-sm leading-relaxed text-canvas">
        {message.content}
      </div>
    </div>
  );
}

function AgentBubble({ message }: { message: ChatMessage }) {
  const accent = ACCENT[message.agentId || "rep"];
  return (
    <div className="msg-in flex gap-3">
      <Avatar agentId={message.agentId || "rep"} />
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-2">
          <span className="text-xs font-semibold text-ink">{message.agentName}</span>
          {message.agentId && (
            <span className={`rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase ${accent.chip}`}>
              {message.agentId}
            </span>
          )}
        </div>
        <div className="whitespace-pre-wrap rounded-2xl rounded-tl-md border border-line bg-white px-4 py-3 text-sm leading-relaxed text-ink">
          <RichText text={message.content} />
        </div>
        {message.trajectory && message.trajectory.length > 0 && (
          <TrajectoryList steps={message.trajectory} />
        )}
      </div>
    </div>
  );
}

function TrajectoryList({ steps }: { steps: TrajectoryStep[] }) {
  return (
    <details className="mt-1.5 group">
      <summary className="cursor-pointer list-none text-[11px] font-medium text-muted hover:text-ink">
        <span className="inline-flex items-center gap-1">
          <span className="transition group-open:rotate-90">▸</span>
          Agent reasoning ({steps.length})
        </span>
      </summary>
      <ol className="mt-1.5 space-y-1 border-l border-line pl-3">
        {steps.map((s, i) => (
          <li key={s.id || i} className="text-[11px]">
            <span className="font-mono font-semibold text-ink-soft">{s.action}</span>
            <span className="text-faint"> — {s.thought}</span>
            {s.result && (
              <span className="block truncate font-mono text-faint">
                → {s.result.slice(0, 80)}
              </span>
            )}
          </li>
        ))}
      </ol>
    </details>
  );
}

function Avatar({ agentId }: { agentId: string }) {
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line bg-panel-soft">
      <AgentIcon agentId={agentId} size={16} />
    </div>
  );
}

/** Minimal markdown-ish renderer: **bold**, `code`, line breaks preserved by whitespace-pre-wrap. */
function RichText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean);
  return (
    <>
      {parts.map((p, i) => {
        if (p.startsWith("**") && p.endsWith("**"))
          return (
            <strong key={i} className="font-semibold">
              {p.slice(2, -2)}
            </strong>
          );
        if (p.startsWith("`") && p.endsWith("`"))
          return (
            <code key={i} className="rounded bg-panel px-1 py-0.5 font-mono text-[12px]">
              {p.slice(1, -1)}
            </code>
          );
        return <span key={i}>{p}</span>;
      })}
    </>
  );
}
