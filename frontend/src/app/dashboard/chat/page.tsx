"use client";

import dynamic from "next/dynamic";

const ChatShell = dynamic(
  () => import("@/components/chat-shell").then((m) => ({ default: m.ChatShell })),
  { ssr: false }
);

export default function ChatPage() {
  return <ChatShell />;
}
