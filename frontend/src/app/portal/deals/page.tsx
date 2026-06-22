"use client";

import { Fragment, useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import type { Deal, Interaction } from "@/lib/types";

export default function PortalDeals() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [comments, setComments] = useState<Interaction[]>([]);
  const [newComment, setNewComment] = useState("");
  const [commenting, setCommenting] = useState("");

  const fetchDeals = useCallback(() => { api.getClientDeals().then(setDeals).catch(() => {}); }, []);

  useEffect(() => { fetchDeals(); }, [fetchDeals]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !amount) return;
    setSubmitting(true);
    try {
      await api.createClientDeal({ name, amount: Number(amount), notes });
      setName(""); setAmount(""); setNotes("");
      setShowForm(false);
      await fetchDeals();
    } catch {} finally { setSubmitting(false); }
  };

  const openComments = async (deal: Deal) => {
    setSelectedDeal(deal);
    setComments([]);
    try {
      setComments(await api.getClientDealComments(deal.id));
    } catch {}
  };

  const addComment = async (dealId: string) => {
    if (!newComment.trim()) return;
    setCommenting(dealId);
    try {
      await api.addClientDealComment(dealId, newComment.trim());
      setNewComment("");
      const updated = await api.getClientDealComments(dealId);
      setComments(updated);
    } catch {} finally { setCommenting(""); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">My Deals</h1>
        <button onClick={() => setShowForm(true)} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700">Submit Offer</button>
      </div>

      {showForm && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">New Deal Offer</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Deal Name *</label>
              <input value={name} onChange={e => setName(e.target.value)} required className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Amount ($) *</label>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)} required min={0} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Notes</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none" />
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={submitting} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50">{submitting ? "Submitting..." : "Submit"}</button>
              <button type="button" onClick={() => setShowForm(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {deals.length === 0 ? (
        <div className="rounded-xl bg-white py-10 text-center text-sm text-gray-400 shadow-sm ring-1 ring-gray-200">No deals found</div>
      ) : (
        <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-200">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                {["Name", "Amount", "Stage", "Status", "Feedback"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {deals.map((d) => (
                <tr key={d.id} className="border-b border-gray-50 transition hover:bg-gray-50">
                  <td className="px-4 py-2.5 text-sm font-medium text-gray-900">{d.name}</td>
                  <td className="px-4 py-2.5 text-sm text-gray-700">${d.amount?.toLocaleString() || "—"}</td>
                  <td className="px-4 py-2.5 text-sm text-gray-700">{d.stage}</td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      d.status === "WON" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"
                    }`}>{d.status}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <button onClick={() => openComments(d)} className="text-sm font-medium text-blue-600 transition hover:text-blue-800">
                      {d.id === selectedDeal?.id ? `${comments.length} comments` : "View"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedDeal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setSelectedDeal(null)}>
          <div className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">{selectedDeal.name} — Feedback</h2>
              <button onClick={() => setSelectedDeal(null)} className="text-gray-400 hover:text-gray-600">&times;</button>
            </div>
            <div className="mb-4 space-y-3">
              {comments.length === 0 && <p className="text-sm text-gray-400">No feedback yet</p>}
              {comments.map((c) => (
                <Fragment key={c.id}>
                  <div className={`rounded-lg p-3 text-sm ${c.direction === "OUTBOUND" ? "ml-8 bg-blue-50 text-blue-900" : "mr-8 bg-gray-50 text-gray-800"}`}>
                    <p className="text-xs text-gray-400">{c.direction === "OUTBOUND" ? "Admin" : "You"} &middot; {new Date(c.createdAt).toLocaleDateString()}</p>
                    <p className="mt-1">{c.content}</p>
                  </div>
                </Fragment>
              ))}
            </div>
            <div className="flex gap-2">
              <input value={newComment} onChange={e => setNewComment(e.target.value)} placeholder="Add a comment..." className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
              <button onClick={() => addComment(selectedDeal.id)} disabled={!newComment.trim() || commenting === selectedDeal.id} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50">Send</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
