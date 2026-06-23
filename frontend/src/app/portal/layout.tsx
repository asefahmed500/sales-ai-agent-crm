"use client";

import { useEffect, useState, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { api, backendUrl } from "@/lib/api";

interface AppNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  link?: string;
  createdAt: string;
}

const nav = [
  { href: "/portal", label: "Dashboard", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
  { href: "/portal/deals", label: "My Deals", icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" },
  { href: "/portal/tickets", label: "My Tickets", icon: "M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" },
  { href: "/portal/messages", label: "Messages", icon: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" },
  { href: "/portal/documents", label: "Documents", icon: "M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" },
  { href: "/portal/profile", label: "Profile", icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" },
];

const noAuthRoutes = ["/portal/login", "/portal/register"];

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<{ id: string; name: string; email: string; role: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [showNotif, setShowNotif] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (noAuthRoutes.includes(pathname)) { setLoading(false); setUser(null); return; }
    setLoading(true);
    const token = localStorage.getItem("sg_token");
    if (!token) { setLoading(false); router.push("/portal/login"); return; }
    api.getMe()
      .then((u: any) => {
        if (u.role !== "CLIENT") {
          router.push("/dashboard");
          return;
        }
        setUser(u);
        setLoading(false);
      })
      .catch(() => { localStorage.removeItem("sg_token"); setLoading(false); router.push("/portal/login"); });
  }, [pathname, router]);

  // SSE notifications
  useEffect(() => {
    if (!user?.id) return;
    const token = localStorage.getItem("sg_token");
    if (!token) return;
    const es = new EventSource(`${backendUrl}/api/notifications/stream/${user.id}?token=${token}`);
    es.onmessage = (e) => {
      try {
        const n = JSON.parse(e.data);
        if (n.type === "connected" || n.type === "keepalive") return;
        setNotifications((prev) => [n, ...prev].slice(0, 20));
      } catch {}
    };
    es.onerror = () => {};
    return () => es.close();
  }, [user?.id]);

  // Close notification panel on outside click
  useEffect(() => {
    if (!showNotif) return;
    const handler = (e: MouseEvent) => { if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotif(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showNotif]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
      </div>
    );
  }

  if (!user) return <>{children}</>;

  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside className="flex w-56 flex-col border-r border-gray-200 bg-white">
        <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500 text-xs font-bold text-white">SG</div>
          <span className="text-sm font-semibold text-gray-800">Client Portal</span>
        </div>
        <nav className="flex-1 space-y-0.5 p-3">
          {nav.map((n) => {
            const active = pathname === n.href;
            return (
              <Link key={n.href} href={n.href}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition ${
                  active ? "bg-sky-50 font-medium text-sky-700" : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <path d={n.icon} />
                </svg>
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-gray-100 p-3">
          <div className="mb-2 px-3 text-xs text-gray-400 truncate">{user.name}</div>
          <button onClick={() => { localStorage.removeItem("sg_token"); router.push("/portal/login"); }}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-600 transition hover:bg-gray-100">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            Logout
          </button>
        </div>
      </aside>
      <main className="flex flex-1 flex-col overflow-auto">
        <header className="flex h-14 items-center justify-end gap-3 border-b border-gray-200 bg-white px-6">
          <div className="relative" ref={notifRef}>
            <button onClick={() => setShowNotif(!showNotif)} className="relative text-gray-500 hover:text-gray-700">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
              {notifications.length > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
                  {notifications.length > 9 ? "9+" : notifications.length}
                </span>
              )}
            </button>
            {showNotif && (
              <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-xl bg-white shadow-lg ring-1 ring-gray-200">
                <div className="border-b border-gray-100 px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Notifications</div>
                <div className="max-h-72 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="px-4 py-6 text-center text-xs text-gray-400">No notifications</div>
                  ) : (
                    notifications.map((n, i) => (
                      <div key={i} className="border-b border-gray-50 px-4 py-2.5 text-sm hover:bg-gray-50">
                        <div className="font-medium text-gray-900">{n.title}</div>
                        <div className="text-xs text-gray-500">{n.message}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
          <span className="text-sm font-medium text-gray-700">{user.name}</span>
        </header>
        <div className="flex-1 overflow-auto p-6">{children}</div>
      </main>
    </div>
  );
}
