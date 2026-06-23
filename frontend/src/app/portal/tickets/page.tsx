"use client";

import { FormEvent, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Ticket } from "@/lib/types";

export default function PortalTickets() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ subject: "", description: "", priority: "MEDIUM", category: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.getClientTickets().then(setTickets).catch(() => {}).finally(() => setLoading(false));
  }, []);

  async function handleSubmit(ev: FormEvent) {
    ev.preventDefault();
    setSaving(true);
    try {
      await api.createClientTicket(form);
      setShowForm(false);
      setForm({ subject: "", description: "", priority: "MEDIUM", category: "" });
      api.getClientTickets().then(setTickets).catch(() => {});
    } catch { } finally { setSaving(false); }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">My Tickets</h1>
        <button onClick={() => setShowForm(true)}
          className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white hover:bg-sky-600">
          + New Ticket
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30" onClick={() => setShowForm(false)}>
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-4 text-sm font-semibold text-gray-900">New Ticket</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Subject *</label>
                <input type="text" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200" required />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Description</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200" rows={3} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Priority</label>
                  <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none">
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Category</label>
                  <input type="text" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none" placeholder="e.g. Billing" />
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setShowForm(false)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700">Cancel</button>
                <button type="submit" disabled={saving}
                  className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
                  {saving ? "Creating..." : "Create Ticket"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {tickets.length === 0 ? (
        <div className="rounded-xl bg-white py-10 text-center text-sm text-gray-400 shadow-sm ring-1 ring-gray-200">No tickets</div>
      ) : (
        <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-200">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                {["Subject", "Status", "Priority", "Category"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tickets.map((t) => (
                <tr key={t.id} className="border-b border-gray-50 transition hover:bg-gray-50">
                  <td className="px-4 py-2.5 text-sm font-medium text-gray-900">{t.subject}</td>
                  <td className="px-4 py-2.5 text-sm text-gray-700">{t.status}</td>
                  <td className="px-4 py-2.5 text-sm text-gray-700">{t.priority}</td>
                  <td className="px-4 py-2.5 text-sm text-gray-700">{t.category || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
