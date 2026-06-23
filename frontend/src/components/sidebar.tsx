"use client";

import type { Conversation } from "@/hooks/use-conversations";
import { ACCENT, DEFAULT_AGENTS } from "@/lib/agents";

interface SidebarProps {
  conversations: Conversation[];
  activeId: string | null;
  onNew: () => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  pipeline: { contacts: number; open: { value: number }; won: { value: number } } | null;
}

function groupByDate(convs: Conversation[]) {
  const now = Date.now();
  const day = 86400000;
  const groups: { label: string; items: Conversation[] }[] = [
    { label: "Today", items: [] },
    { label: "Previous 7 days", items: [] },
    { label: "Older", items: [] },
  ];
  for (const c of convs) {
    const age = now - c.updatedAt;
    if (age < day) groups[0].items.push(c);
    else if (age < 7 * day) groups[1].items.push(c);
    else groups[2].items.push(c);
  }
  return groups.filter((g) => g.items.length > 0);
}

export function Sidebar({
  conversations,
  activeId,
  onNew,
  onSelect,
  onDelete,
  pipeline,
}: SidebarProps) {
  const groups = groupByDate(conversations);

  return (
    <div className="flex h-full w-72 flex-col border-r border-line bg-panel-soft">
      {/* New chat */}
      <div className="p-3">
        <button
          onClick={onNew}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-ink px-3 py-2.5 text-sm font-semibold text-canvas transition hover:bg-ink-soft"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          New chat
        </button>
      </div>

      {/* Conversation history */}
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {conversations.length === 0 ? (
          <p className="px-3 py-6 text-center text-xs text-faint">
            No conversations yet.
            <br />
            Start by sending a message.
          </p>
        ) : (
          groups.map((g) => (
            <div key={g.label} className="mb-3">
              <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-faint">
                {g.label}
              </div>
              <div className="space-y-0.5">
                {g.items.map((c) => {
                  const agent = DEFAULT_AGENTS.find((a) => a.id === c.agentId);
                  const accent = ACCENT[c.agentId];
                  const active = c.id === activeId;
                  return (
                    <div
                      key={c.id}
                      className={`group relative flex items-center gap-2 rounded-lg px-2.5 py-2 transition ${
                        active ? "bg-peach/60" : "hover:bg-peach/30"
                      }`}
                    >
                      <button
                        onClick={() => onSelect(c.id)}
                        className="flex min-w-0 flex-1 items-center gap-2 text-left"
                      >
                        <span className="text-sm">{agent?.icon ?? (
                          <svg className="inline-block h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                        )}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-medium text-ink">
                            {c.title}
                          </span>
                          <span className={`block truncate text-[10px] ${accent.text}`}>
                            {agent?.name ?? "Agent"} · {c.messages.length} msgs
                          </span>
                        </span>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(c.id);
                        }}
                        aria-label="Delete conversation"
                        className="shrink-0 rounded p-1 text-faint opacity-0 transition hover:bg-white/60 hover:text-coral group-hover:opacity-100"
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                          <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                        </svg>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer: pipeline snapshot */}
      <div className="border-t border-line p-3">
        {pipeline ? (
          <div className="rounded-xl border border-line bg-white/60 p-3">
            <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-faint">
              CRM Pipeline
            </div>
            <div className="grid grid-cols-3 gap-1 text-center">
              <Stat label="Contacts" value={pipeline.contacts} />
              <Stat label="Open $" value={fmt(pipeline.open.value)} />
              <Stat label="Won $" value={fmt(pipeline.won.value)} strong />
            </div>
          </div>
        ) : (
          <div className="text-[11px] text-faint">Loading pipeline…</div>
        )}
        <div className="mt-2 text-center text-[10px] text-faint">
          SalesGenius · Multi-agent sales floor
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  strong,
}: {
  label: string;
  value: string | number;
  strong?: boolean;
}) {
  return (
    <div>
      <div className={`text-sm font-bold ${strong ? "text-emerald-700" : "text-ink"}`}>
        {value}
      </div>
      <div className="text-[9px] uppercase text-faint">{label}</div>
    </div>
  );
}

function fmt(n: number): string {
  if (!n) return "$0";
  if (n >= 1000) return `$${Math.round(n / 1000)}k`;
  return `$${n}`;
}
