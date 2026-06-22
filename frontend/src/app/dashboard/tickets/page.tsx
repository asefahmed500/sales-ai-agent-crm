"use client";

import { Fragment, useEffect, useState, useMemo } from "react";
import { api } from "@/lib/api";
import type { Ticket } from "@/lib/types";

const STATUSES = ["ALL", "OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"];
const PRIORITIES = ["ALL", "LOW", "MEDIUM", "HIGH", "URGENT"];

const priorityBadge: Record<string, string> = {
  LOW: "bg-gray-100 text-gray-700",
  MEDIUM: "bg-blue-100 text-blue-700",
  HIGH: "bg-amber-100 text-amber-700",
  URGENT: "bg-red-100 text-red-700",
};

const statusBadge: Record<string, string> = {
  OPEN: "bg-yellow-100 text-yellow-800",
  IN_PROGRESS: "bg-blue-100 text-blue-700",
  RESOLVED: "bg-green-100 text-green-700",
  CLOSED: "bg-gray-100 text-gray-500",
};

const defaultBadge = "bg-gray-100 text-gray-600";

export default function TicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [priorityFilter, setPriorityFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ status: "", priority: "" });

  const [toast, setToast] = useState("");

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  }

  function load() {
    setLoading(true);
    const params: { page?: number; status?: string } = { page };
    if (statusFilter !== "ALL") params.status = statusFilter;
    api.getCrmTickets(params)
      .then((res) => {
        setTickets(res.items);
        setTotal(res.total);
        setPage(res.page);
        setTotalPages(res.totalPages);
      })
      .catch(() => showToast("Failed to load tickets"))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [page, statusFilter]);

  const filteredTickets = useMemo(() => {
    if (priorityFilter === "ALL") return tickets;
    return tickets.filter((t) => t.priority === priorityFilter);
  }, [tickets, priorityFilter]);

  function expandRow(ticket: Ticket) {
    if (expandedId === ticket.id) {
      setExpandedId(null);
    } else {
      setExpandedId(ticket.id);
      setEditForm({ status: ticket.status, priority: ticket.priority });
    }
  }

  async function handleSave(ticket: Ticket) {
    try {
      await api.updateTicket(ticket.id, {
        status: editForm.status,
        priority: editForm.priority,
      } as Partial<Ticket>);
      setExpandedId(null);
      showToast("Ticket updated");
      load();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Update failed");
    }
  }

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed right-6 top-20 z-50 rounded-lg bg-gray-900 px-4 py-2.5 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s === "ALL" ? "All Statuses" : s.replace("_", " ")}</option>
            ))}
          </select>
          <select
            value={priorityFilter}
            onChange={(e) => { setPriorityFilter(e.target.value); setPage(1); }}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
          >
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>{p === "ALL" ? "All Priorities" : p}</option>
            ))}
          </select>
        </div>
        <div className="text-sm text-gray-500">{total} total tickets</div>
      </div>

      <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-200">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <svg className="h-6 w-6 animate-spin text-sky-500" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity="0.25" />
              <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
            </svg>
          </div>
        ) : filteredTickets.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-sm text-gray-400">No tickets found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  {["Subject", "Contact", "Company", "Priority", "Status", "Created"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredTickets.map((ticket) => (
                  <Fragment key={ticket.id}>
                    <tr
                      key={ticket.id}
                      className="cursor-pointer border-b border-gray-100 transition hover:bg-gray-50"
                      onClick={() => expandRow(ticket)}
                    >
                      <td className="max-w-[200px] truncate px-4 py-2.5 text-sm font-medium text-gray-900">
                        {ticket.subject}
                      </td>
                      <td className="px-4 py-2.5 text-sm text-gray-500">{ticket.contact?.name || "—"}</td>
                      <td className="px-4 py-2.5 text-sm text-gray-500">{ticket.company?.name || "—"}</td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${priorityBadge[ticket.priority] || defaultBadge}`}>
                          {ticket.priority}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadge[ticket.status] || defaultBadge}`}>
                          {ticket.status === "IN_PROGRESS" ? "In Progress" : ticket.status}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-sm text-gray-500">
                        {new Date(ticket.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                    {expandedId === ticket.id && (
                      <tr key={`${ticket.id}-edit`}>
                        <td colSpan={6} className="bg-gray-50 px-4 py-4">
                          <div className="mb-3">
                            <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Description</h4>
                            <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700">{ticket.description || "No description"}</p>
                          </div>
                          <div className="grid gap-4 sm:grid-cols-2">
                            <div>
                              <label className="mb-1 block text-xs font-medium text-gray-600">Status</label>
                              <select value={editForm.status}
                                onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                                className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200">
                                {STATUSES.filter((s) => s !== "ALL").map((s) => (
                                  <option key={s} value={s}>{s === "IN_PROGRESS" ? "In Progress" : s}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="mb-1 block text-xs font-medium text-gray-600">Priority</label>
                              <select value={editForm.priority}
                                onChange={(e) => setEditForm({ ...editForm, priority: e.target.value })}
                                className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200">
                                {PRIORITIES.filter((p) => p !== "ALL").map((p) => (
                                  <option key={p} value={p}>{p}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                          <div className="mt-3 flex justify-end gap-2">
                            <button onClick={() => setExpandedId(null)}
                              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-50">Cancel</button>
                            <button onClick={() => handleSave(ticket)}
                              className="rounded-lg bg-sky-500 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-sky-600">Save</button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">Showing {filteredTickets.length} of {total} tickets</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Previous
            </button>
            <span className="text-sm text-gray-600">Page {page} of {totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
