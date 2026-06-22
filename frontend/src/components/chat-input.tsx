"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { SlashCommand } from "@/lib/types";
import { SLASH_COMMANDS } from "@/lib/agents";
import { SlashMenu } from "./slash-menu";

interface ChatInputProps {
  disabled: boolean;
  onSubmit: (text: string) => void;
}

export function ChatInput({ disabled, onSubmit }: ChatInputProps) {
  const [value, setValue] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const taRef = useRef<HTMLTextAreaElement>(null);

  const filtered = useMemo(() => {
    if (!value.startsWith("/")) return [];
    const q = value.toLowerCase().split(/\s+/)[0];
    return SLASH_COMMANDS.filter(
      (c) => c.command.startsWith(q) || c.label.toLowerCase().includes(q.slice(1))
    );
  }, [value]);

  useEffect(() => {
    setMenuOpen(filtered.length > 0 && !value.includes(" "));
    setActiveIdx(0);
  }, [filtered, value]);

  // autosize
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 160) + "px";
  }, [value]);

  const submit = (text: string) => {
    const t = text.trim();
    if (!t || disabled) return;
    onSubmit(t);
    setValue("");
    setMenuOpen(false);
    taRef.current?.focus();
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (menuOpen && filtered.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIdx((i) => (i + 1) % filtered.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIdx((i) => (i - 1 + filtered.length) % filtered.length);
        return;
      }
      if (e.key === "Tab") {
        e.preventDefault();
        choose(filtered[activeIdx]);
        return;
      }
      if (e.key === "Escape") {
        setMenuOpen(false);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (menuOpen && filtered[activeIdx]) choose(filtered[activeIdx]);
      else submit(value);
    }
  };

  const choose = (cmd: SlashCommand) => {
    setValue(cmd.command + " ");
    setMenuOpen(false);
    taRef.current?.focus();
  };

  return (
    <div className="relative">
      {menuOpen && (
        <SlashMenu
          commands={filtered}
          activeIndex={activeIdx}
          onSelect={choose}
          onHover={setActiveIdx}
        />
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(value);
        }}
        className="mx-auto flex w-full max-w-3xl items-end gap-2 rounded-2xl border border-line bg-white px-3 py-2 shadow-sm focus-within:border-coral/60"
      >
        <span className="pb-2 pl-1 pr-1 text-lg">/</span>
        <textarea
          ref={taRef}
          rows={1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKey}
          disabled={disabled}
          placeholder="Message SalesGenius…  (type / for commands)"
          className="max-h-40 flex-1 resize-none bg-transparent py-2 text-sm text-ink outline-none placeholder:text-faint disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={disabled || !value.trim()}
          className="mb-0.5 shrink-0 rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-canvas transition hover:bg-ink-soft disabled:opacity-40"
        >
          Send
        </button>
      </form>
      <p className="mx-auto mt-2 w-full max-w-3xl px-2 text-center text-[11px] text-faint">
        Enter to send · Shift+Enter for newline · type{" "}
        <code className="font-mono">/</code> for commands
      </p>
    </div>
  );
}
