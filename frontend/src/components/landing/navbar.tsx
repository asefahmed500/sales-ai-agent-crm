"use client";

import Link from "next/link";

export default function Navbar({ onOpenCmd }: { onOpenCmd: () => void }) {
  return (
    <header className="px-4 pt-4 sm:px-6 sm:pt-6">
      <div className="mx-auto flex max-w-6xl items-center justify-between rounded-lg border border-gray-200 bg-white/80 px-4 py-2 shadow-sm backdrop-blur-lg">
        <Link href="/" className="text-lg font-bold tracking-tight text-gray-900">
          Sales<span className="text-sky-500">Genius</span>
        </Link>

        <button onClick={onOpenCmd} className="mx-2 hidden w-full max-w-xs items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-400 transition hover:border-gray-300 hover:text-gray-500 sm:flex">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <span>Search anything...</span>
          <kbd className="ml-auto rounded border border-gray-200 bg-white px-1.5 py-0.5 text-[10px] text-gray-400">⌘K</kbd>
        </button>

        <button onClick={onOpenCmd} className="rounded-md border border-gray-200 bg-gray-50 p-2 text-gray-400 transition hover:text-gray-600 sm:hidden">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        </button>

        <div className="flex items-center gap-1 sm:gap-2">
          <Link href="/login" className="rounded-md px-3 py-1.5 text-sm font-medium text-gray-600 transition hover:bg-gray-100 hover:text-gray-900">Sign In</Link>
          <Link href="/signup" className="rounded-md bg-[#2d2424] px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-[#4a4040]">Get Started</Link>
        </div>
      </div>
    </header>
  );
}
