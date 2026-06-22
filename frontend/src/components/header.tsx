"use client";

import type { AgentDef } from "@/lib/types";
import { ACCENT } from "@/lib/agents";
import { AgentSelector } from "./agent-selector";

interface HeaderProps {
  onToggleSidebar: () => void;
  sidebarOpen: boolean;
  agents: AgentDef[];
  activeAgent: AgentDef;
  onAgentChange: (a: AgentDef) => void;
  selectedContactName: string | null;
}

export function Header({
  onToggleSidebar,
  sidebarOpen,
  agents,
  activeAgent,
  onAgentChange,
  selectedContactName,
}: HeaderProps) {
  const accent = ACCENT[activeAgent.id];

  return (
    <header className="flex items-center justify-between border-b border-line bg-canvas/85 px-3 py-2.5 backdrop-blur sm:px-5">
      <div className="flex items-center gap-2">
        <button
          onClick={onToggleSidebar}
          aria-label="Toggle sidebar"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-ink transition hover:bg-panel-soft"
        >
          {sidebarOpen ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M3 6h18M3 12h18M3 18h18" />
            </svg>
          )}
        </button>

        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-ink text-canvas">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 22H22L12 2Z" fill="currentColor" />
            </svg>
          </div>
          <span className="hidden text-sm font-extrabold tracking-tight text-ink sm:inline">
            SalesGenius
          </span>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center">
        <AgentSelector agents={agents} active={activeAgent} onChange={onAgentChange} />
      </div>

      <div className="hidden min-w-0 max-w-[30%] truncate text-right text-xs text-muted md:block">
        {selectedContactName ? (
          <>
            Engaging:{" "}
            <span className={`font-semibold ${accent.text}`}>{selectedContactName}</span>
          </>
        ) : (
          <span className="text-faint">No contact pinned</span>
        )}
      </div>
    </header>
  );
}
