"use client";

import { useEffect, useRef, useState } from "react";
import type { AgentDef } from "@/lib/types";
import { ACCENT } from "@/lib/agents";

interface AgentSelectorProps {
  agents: AgentDef[];
  active: AgentDef;
  onChange: (a: AgentDef) => void;
}

export function AgentSelector({ agents, active, onChange }: AgentSelectorProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const accent = ACCENT[active.id];

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-2 rounded-xl border bg-white px-3 py-1.5 text-sm font-semibold shadow-sm transition hover:bg-panel-soft ${accent.chip}`}
      >
        <span className="text-base">{active.icon}</span>
        <span>{active.name}</span>
        <span className="text-[10px] font-normal opacity-70">{active.role}</span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          className={`transition ${open ? "rotate-180" : ""}`}
        >
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-30 mt-1.5 w-72 overflow-hidden rounded-xl border border-line bg-white shadow-xl shadow-ink/10">
          <div className="border-b border-line px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-faint">
            Choose your agent
          </div>
          <div className="py-1">
            {agents.map((a) => {
              const aAccent = ACCENT[a.id];
              const selected = a.id === active.id;
              return (
                <button
                  key={a.id}
                  onClick={() => {
                    onChange(a);
                    setOpen(false);
                  }}
                  className={`flex w-full items-start gap-3 px-3 py-2.5 text-left transition ${
                    selected ? aAccent.soft : "hover:bg-panel-soft"
                  }`}
                >
                  <span className="mt-0.5 text-lg">{a.icon}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="text-sm font-semibold text-ink">{a.name}</span>
                      <span className={`rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase ${aAccent.chip}`}>
                        {a.role}
                      </span>
                    </span>
                    <span className="mt-0.5 block text-xs text-muted">{a.description}</span>
                  </span>
                  {selected && (
                    <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${aAccent.dot}`} />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
