"use client";

import { useEffect, useRef } from "react";
import type { SlashCommand } from "@/lib/types";

interface SlashMenuProps {
  commands: SlashCommand[];
  activeIndex: number;
  onSelect: (cmd: SlashCommand) => void;
  onHover: (index: number) => void;
}

export function SlashMenu({
  commands,
  activeIndex,
  onSelect,
  onHover,
}: SlashMenuProps) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(
      `[data-idx="${activeIndex}"]`
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  if (commands.length === 0) return null;

  return (
    <div className="absolute bottom-full left-0 right-0 mb-2 overflow-hidden rounded-xl border border-line bg-white shadow-lg shadow-ink/5">
      <div className="border-b border-line px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-faint">
        Commands
      </div>
      <div ref={listRef} className="max-h-64 overflow-y-auto py-1">
        {commands.map((cmd, i) => (
          <button
            key={cmd.command}
            data-idx={i}
            onMouseEnter={() => onHover(i)}
            onClick={() => onSelect(cmd)}
            className={`flex w-full items-center gap-3 px-3 py-2 text-left transition ${
              i === activeIndex ? "bg-panel-soft" : ""
            }`}
          >
            <span className="w-24 shrink-0 font-mono text-xs font-semibold text-ink">
              {cmd.command}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-medium text-ink">
                {cmd.label}
              </span>
              <span className="block truncate text-[11px] text-muted">
                {cmd.description}
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
