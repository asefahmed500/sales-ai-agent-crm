"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { Interaction } from "@/lib/types";

export default function PortalMessagesPage() {
  const [messages, setMessages] = useState<Interaction[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  function load() {
    api.getClientConversation().then(setMessages).catch(() => setMessages([]));
  }

  useEffect(() => { load(); }, []);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  // Poll for new messages every 3 seconds
  useEffect(() => {
    const id = setInterval(load, 3000);
    return () => clearInterval(id);
  }, []);

  async function handleSend() {
    if (!input.trim() || sending) return;
    setSending(true);
    try {
      await api.sendClientMessage(input.trim());
      setInput("");
      load();
    } catch {}
    finally { setSending(false); }
  }

  return (
    <div className="flex h-[calc(100vh-10rem)] flex-col rounded-xl bg-white shadow-sm ring-1 ring-gray-200">
      <div className="border-b border-gray-100 px-4 py-3">
        <h2 className="text-sm font-semibold text-gray-900">Live Chat with Admin</h2>
        <p className="text-xs text-gray-500">Send us a message and we&apos;ll get back to you</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="space-y-3">
          {messages.length === 0 && <div className="py-12 text-center text-sm text-gray-400">No messages yet. Start a conversation!</div>}
          {messages.map((m) => (
            <Fragment key={m.id}>
              <div className={`flex ${m.direction === "INBOUND" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[70%] rounded-xl px-4 py-2.5 text-sm ${m.direction === "INBOUND" ? "bg-sky-500 text-white" : "bg-gray-100 text-gray-900"}`}>
                  <p>{m.content}</p>
                  <p className={`mt-0.5 text-[10px] ${m.direction === "INBOUND" ? "text-sky-100" : "text-gray-400"}`}>
                    {new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            </Fragment>
          ))}
          <div ref={bottomRef} />
        </div>
      </div>

      <div className="border-t border-gray-100 px-4 py-3">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder="Type a message..."
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
          />
          <button onClick={handleSend} disabled={!input.trim() || sending}
            className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-600 disabled:opacity-50">
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
