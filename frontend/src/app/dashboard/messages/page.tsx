"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { Interaction } from "@/lib/types";

interface ContactItem {
  id: string;
  name: string;
  email: string;
  lastMessage: { content: string; direction: string; createdAt: string } | null;
  messageCount: number;
}

export default function AdminMessagesPage() {
  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Interaction[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(""), 2500); }

  function loadContacts() {
    api.getConversations().then(setContacts).catch(() => {});
  }

  function loadMessages(contactId: string) {
    api.getConversationMessages(contactId).then(setMessages).catch(() => setMessages([]));
  }

  useEffect(() => { loadContacts(); }, []);

  useEffect(() => {
    if (selectedId) loadMessages(selectedId);
  }, [selectedId]);

  // Poll every 3s
  useEffect(() => {
    const id = setInterval(() => {
      loadContacts();
      if (selectedId) loadMessages(selectedId);
    }, 3000);
    return () => clearInterval(id);
  }, [selectedId]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const selected = contacts.find((c) => c.id === selectedId) || null;

  const filtered = contacts.filter(
    (c) => c.name.toLowerCase().includes(search.toLowerCase()) || c.email.toLowerCase().includes(search.toLowerCase())
  );

  async function handleSend() {
    if (!input.trim() || !selectedId || sending) return;
    setSending(true);
    try {
      await api.sendMessage(selectedId, input.trim());
      setInput("");
      loadMessages(selectedId);
      loadContacts();
    } catch { showToast("Failed to send"); }
    finally { setSending(false); }
  }

  return (
    <div className="flex h-[calc(100vh-7rem)] gap-4">
      {toast && <div className="fixed right-6 top-20 z-50 rounded-lg bg-gray-900 px-4 py-2.5 text-sm text-white shadow-lg">{toast}</div>}

      {/* Contact list sidebar */}
      <div className="flex w-72 shrink-0 flex-col rounded-xl bg-white shadow-sm ring-1 ring-gray-200">
        <div className="border-b border-gray-100 px-4 py-3">
          <h3 className="mb-2 text-sm font-semibold text-gray-900">All Contacts</h3>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search contacts..."
            className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-xs outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
          />
        </div>
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-gray-400">No contacts found</div>
          ) : (
            filtered.map((c) => {
              const hasMessages = c.messageCount > 0;
              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  className={`w-full border-b border-gray-50 px-4 py-3 text-left transition hover:bg-gray-50 ${selectedId === c.id ? "bg-sky-50" : ""}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-900">{c.name}</span>
                    {hasMessages && (
                      <span className="rounded-full bg-sky-100 px-1.5 py-0.5 text-[10px] font-medium text-sky-700">
                        {c.messageCount}
                      </span>
                    )}
                  </div>
                  <div className="truncate text-xs text-gray-500">
                    {c.lastMessage ? c.lastMessage.content : "No messages yet"}
                  </div>
                  <div className="text-[10px] text-gray-400">{c.email}</div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Chat panel */}
      <div className="flex flex-1 flex-col rounded-xl bg-white shadow-sm ring-1 ring-gray-200">
        {!selected ? (
          <div className="flex flex-1 flex-col items-center justify-center text-sm text-gray-400">
            <svg className="mb-3 h-12 w-12 text-gray-200" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1"><path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
            Select a contact to start chatting
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">{selected.name}</h3>
                <p className="text-xs text-gray-500">{selected.email}</p>
              </div>
              {selected.messageCount > 0 && (
                <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-medium text-sky-700">
                  {selected.messageCount} message{selected.messageCount > 1 ? "s" : ""}
                </span>
              )}
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-4">
              <div className="space-y-3">
                {messages.length === 0 && (
                  <div className="py-8 text-center text-sm text-gray-400">
                    No messages yet. Send your first message to {selected.name.split(" ")[0]}.
                  </div>
                )}
                {messages.map((m) => (
                  <Fragment key={m.id}>
                    <div className={`flex ${m.direction === "OUTBOUND" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[70%] rounded-xl px-4 py-2.5 text-sm ${
                        m.direction === "OUTBOUND" ? "bg-sky-500 text-white" : "bg-gray-100 text-gray-900"
                      }`}>
                        <p>{m.content}</p>
                        <p className={`mt-0.5 text-[10px] ${m.direction === "OUTBOUND" ? "text-sky-100" : "text-gray-400"}`}>
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
                  placeholder={`Message ${selected.name.split(" ")[0]}...`}
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                />
                <button onClick={handleSend} disabled={!input.trim() || sending}
                  className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-600 disabled:opacity-50">
                  Send
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
