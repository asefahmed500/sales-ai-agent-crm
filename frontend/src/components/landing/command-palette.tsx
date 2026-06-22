"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

const actions = [
  { label: "Sign In", href: "/login", icon: "→" },
  { label: "Create Account", href: "/signup", icon: "+" },
  { label: "Dashboard", href: "/dashboard", icon: "▦" },
  { label: "Documentation", href: "#", icon: "?" },
];

export default function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) { setQuery(""); setTimeout(() => inputRef.current?.focus(), 50); }
  }, [open]);

  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const filtered = actions.filter((a) => a.label.toLowerCase().includes(query.toLowerCase()));

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-[15vh]" onClick={onClose}>
      <div className="w-full max-w-lg rounded-lg bg-white shadow-2xl ring-1 ring-gray-200" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-gray-100 px-4 py-3">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input ref={inputRef} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Type a command..." className="flex-1 text-sm text-gray-900 outline-none placeholder:text-gray-400" />
          <kbd className="hidden rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[10px] text-gray-400 sm:inline">ESC</kbd>
        </div>
        <div className="max-h-64 overflow-y-auto p-2">
          {filtered.length === 0 && <p className="py-6 text-center text-sm text-gray-400">No results</p>}
          {filtered.map((a) => (
            <Link key={a.label} href={a.href} onClick={onClose} className="flex items-center gap-3 rounded px-3 py-2.5 text-sm text-gray-700 transition hover:bg-gray-50">
              <span className="flex h-6 w-6 items-center justify-center rounded bg-gray-100 text-xs text-gray-500">{a.icon}</span>
              {a.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
