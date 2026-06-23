"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Deal, Ticket } from "@/lib/types";

export default function PortalDashboard() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.getClientDeals().then(setDeals).catch(() => {}),
      api.getClientTickets().then(setTickets).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  const wonDeals = deals.filter((d) => d.status === "WON");
  const openDeals = deals.filter((d) => d.status !== "WON");
  const openTickets = tickets.filter((t) => t.status !== "CLOSED" && t.status !== "RESOLVED");

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Welcome back</h1>
        <p className="text-sm text-gray-500">Here&apos;s a quick overview of your account</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
          <div className="text-sm text-gray-500">Active Deals</div>
          <div className="mt-1 text-2xl font-bold text-gray-900">{openDeals.length}</div>
        </div>
        <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
          <div className="text-sm text-gray-500">Won Deals</div>
          <div className="mt-1 text-2xl font-bold text-green-600">{wonDeals.length}</div>
        </div>
        <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
          <div className="text-sm text-gray-500">Open Tickets</div>
          <div className="mt-1 text-2xl font-bold text-amber-600">{openTickets.length}</div>
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
          <h2 className="mb-3 text-sm font-semibold text-gray-900">My Deals</h2>
          {deals.length === 0 ? (
            <div className="py-6 text-center text-sm text-gray-400">No deals yet</div>
          ) : (
            <div className="space-y-2">
              {deals.slice(0, 5).map((d) => (
                <div key={d.id} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm">
                  <span className="font-medium text-gray-900">{d.name}</span>
                  <span className="text-xs text-gray-500">{d.stage} — ${d.amount?.toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
          <h2 className="mb-3 text-sm font-semibold text-gray-900">My Tickets</h2>
          {tickets.length === 0 ? (
            <div className="py-6 text-center text-sm text-gray-400">No tickets yet</div>
          ) : (
            <div className="space-y-2">
              {tickets.slice(0, 5).map((t) => (
                <div key={t.id} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm">
                  <span className="font-medium text-gray-900 truncate max-w-48">{t.subject}</span>
                  <span className="text-xs text-gray-500">{t.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
