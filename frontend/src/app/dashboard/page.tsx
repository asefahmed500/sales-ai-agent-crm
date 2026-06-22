"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { AdminDashboard, Contact, Deal } from "@/lib/types";
import { useDashboardUser } from "./layout";

function fmt(n: number): string {
  if (!n) return "$0";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}

export default function DashboardPage() {
  const user = useDashboardUser();
  const [data, setData] = useState<AdminDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api.getCrmDashboard()
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load dashboard"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <svg className="h-6 w-6 animate-spin text-sky-500" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity="0.25" />
          <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
        </svg>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
    );
  }

  const stats = [
    { label: "Total Contacts", value: data?.totalContacts ?? 0, color: "bg-sky-500" },
    { label: "Total Companies", value: data?.totalCompanies ?? 0, color: "bg-violet-500" },
    { label: "Total Deals Value", value: fmt(data?.totalDeals ?? 0), color: "bg-emerald-500" },
    { label: "Open Deals", value: data?.openDealsCount ?? 0, color: "bg-amber-500" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">
          Welcome back{user ? `, ${user.name.split(" ")[0]}` : ""} 👋
        </h2>
        <p className="text-sm text-gray-500">Here&apos;s what&apos;s happening with your sales pipeline.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
            <div className="flex items-center gap-3">
              <div className={`h-10 w-10 rounded-lg ${s.color} flex items-center justify-center text-white text-sm font-bold`}>
                {typeof s.value === "number" ? s.value.toString().charAt(0) : "$"}
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900">{s.value}</div>
                <div className="text-xs text-gray-500">{s.label}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Recent Contacts">
          <Table
            headers={["Name", "Email", "Stage", "Score"]}
            items={data?.recentContacts ?? []}
            render={(c: Contact) => (
              <tr key={c.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-2.5 text-sm font-medium text-gray-900">{c.name}</td>
                <td className="px-4 py-2.5 text-sm text-gray-500">{c.email}</td>
                <td className="px-4 py-2.5">
                  <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-medium text-sky-700">
                    {c.stage}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-sm text-gray-700">{c.score}</td>
              </tr>
            )}
          />
        </Section>

        <Section title="Recent Deals">
          <Table
            headers={["Name", "Amount", "Stage", "Status"]}
            items={data?.recentDeals ?? []}
            render={(d: Deal) => (
              <tr key={d.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-2.5 text-sm font-medium text-gray-900">{d.name}</td>
                <td className="px-4 py-2.5 text-sm text-gray-700">{fmt(d.amount)}</td>
                <td className="px-4 py-2.5">
                  <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                    {d.stage}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    d.status === "OPEN" ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"
                  }`}>
                    {d.status}
                  </span>
                </td>
              </tr>
            )}
          />
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200">
      <div className="border-b border-gray-100 px-4 py-3">
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      </div>
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

function Table<T>({ headers, items, render }: { headers: string[]; items: T[]; render: (item: T) => React.ReactNode }) {
  if (items.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-gray-400">No data yet</div>
    );
  }
  return (
    <table className="w-full">
      <thead>
        <tr className="border-b border-gray-100">
          {headers.map((h) => (
            <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>{items.map(render)}</tbody>
    </table>
  );
}
