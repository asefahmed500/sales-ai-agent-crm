"use client";

import { Fragment, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Contact, Company } from "@/lib/types";

const STAGES = ["ALL", "LEAD", "DISCOVERY", "PROPOSAL", "NEGOTIATION", "WON", "LOST"];

const stageBadge: Record<string, string> = {
  LEAD: "bg-gray-100 text-gray-700",
  DISCOVERY: "bg-blue-100 text-blue-700",
  PROPOSAL: "bg-amber-100 text-amber-700",
  NEGOTIATION: "bg-orange-100 text-orange-700",
  WON: "bg-green-100 text-green-700",
  LOST: "bg-red-100 text-red-700",
};

const defaultBadge = "bg-gray-100 text-gray-600";

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", role: "", stage: "LEAD", companyId: "" });
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const [companies, setCompanies] = useState<Company[]>([]);
  const [companySearch, setCompanySearch] = useState("");

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", email: "", phone: "", role: "", stage: "" });

  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set());
  const [creds, setCreds] = useState<Record<string, { email: string; password: string }>>({});

  const [toast, setToast] = useState("");

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  }

  function loadContacts() {
    setLoading(true);
    const params: { page?: number; search?: string; stage?: string } = { page };
    if (search) params.search = search;
    if (stageFilter !== "ALL") params.stage = stageFilter;
    api.getCrmContacts(params)
      .then((res) => {
        setContacts(res.items);
        setTotal(res.total);
        setPage(res.page);
        setTotalPages(res.totalPages);
      })
      .catch(() => showToast("Failed to load contacts"))
      .finally(() => setLoading(false));
  }

  function loadCompanies() {
    api.getCrmCompanies({ page: 1 })
      .then((res) => setCompanies(res.items))
      .catch(() => {});
  }

  useEffect(() => { loadContacts(); }, [page, search, stageFilter]);
  useEffect(() => { loadCompanies(); }, []);

  async function handleCreate(ev: React.FormEvent) {
    ev.preventDefault();
    setFormError("");
    if (!form.name || !form.email) {
      setFormError("Name and email are required");
      return;
    }
    setSaving(true);
    try {
      await api.createContact({
        name: form.name,
        email: form.email,
        phone: form.phone || undefined,
        role: form.role || undefined,
        stage: form.stage,
        companyId: form.companyId || undefined,
      } as Partial<Contact>);
      setShowModal(false);
      setForm({ name: "", email: "", phone: "", role: "", stage: "LEAD", companyId: "" });
      showToast("Contact created");
      loadContacts();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Failed to create contact");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveEdit(contact: Contact) {
    try {
      await api.updateContact(contact.id, {
        name: editForm.name,
        email: editForm.email,
        phone: editForm.phone || null,
        role: editForm.role || null,
        stage: editForm.stage,
      } as Partial<Contact>);
      setExpandedId(null);
      showToast("Contact updated");
      loadContacts();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Update failed");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this contact?")) return;
    try {
      await api.deleteContact(id);
      showToast("Contact deleted");
      loadContacts();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Delete failed");
    }
  }

  async function handleInvite(contact: Contact) {
    if (!contact.company?.id) {
      showToast("Contact has no company assigned");
      return;
    }
    try {
      const link = await api.generateOnboardingLink(contact.id, contact.company.id);
      await navigator.clipboard.writeText(link.portalUrl);
      setInvitedIds((prev) => new Set(prev).add(contact.id));
      if (link.credentials) {
        setCreds((prev) => ({ ...prev, [contact.id]: link.credentials! }));
      }
      showToast("Credentials generated & email sent");
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Failed to generate invite");
    }
  }

  async function handleResend(contact: Contact) {
    if (!contact.company?.id) {
      showToast("Contact has no company assigned");
      return;
    }
    try {
      const link = await api.generateOnboardingLink(contact.id, contact.company.id);
      if (link.credentials) {
        setCreds((prev) => ({ ...prev, [contact.id]: link.credentials! }));
      }
      showToast("New credentials generated & email resent");
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Failed to resend");
    }
  }

  function expandRow(contact: Contact) {
    if (expandedId === contact.id) {
      setExpandedId(null);
    } else {
      setExpandedId(contact.id);
      setEditForm({
        name: contact.name,
        email: contact.email,
        phone: contact.phone ?? "",
        role: contact.role ?? "",
        stage: contact.stage,
      });
    }
  }

  const filteredCompanies = companies.filter(
    (c) => !companySearch || c.name.toLowerCase().includes(companySearch.toLowerCase()) || c.domain?.toLowerCase().includes(companySearch.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed right-6 top-20 z-50 rounded-lg bg-gray-900 px-4 py-2.5 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search by name or email..."
              className="w-64 rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
            />
          </div>
          <select
            value={stageFilter}
            onChange={(e) => { setStageFilter(e.target.value); setPage(1); }}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
          >
            {STAGES.map((s) => (
              <option key={s} value={s}>{s === "ALL" ? "All Stages" : s}</option>
            ))}
          </select>
        </div>
        <button
          onClick={() => { setShowModal(true); setFormError(""); }}
          className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-600"
        >
          + New Contact
        </button>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30" onClick={() => setShowModal(false)}>
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">New Contact</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Name *</label>
                  <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200" placeholder="Jane Doe" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Email *</label>
                  <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200" placeholder="jane@acme.com" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Phone</label>
                  <input type="text" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200" placeholder="+1 555-0123" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Role</label>
                  <input type="text" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200" placeholder="CEO" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Stage</label>
                  <select value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200">
                    {STAGES.filter((s) => s !== "ALL").map((s) => (<option key={s} value={s}>{s}</option>))}
                  </select>
                </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">Company</label>
                    <input type="text" value={companySearch} onChange={(e) => setCompanySearch(e.target.value)}
                      className="mb-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200" placeholder="Search & select..." />
                    <div className="max-h-32 overflow-y-auto rounded-lg border border-gray-200">
                      {filteredCompanies.length === 0 ? (
                        <div className="px-3 py-2 text-xs text-gray-400">No companies match</div>
                      ) : (
                        filteredCompanies.map((c) => (
                          <button key={c.id} type="button"
                            onClick={() => { setForm({ ...form, companyId: c.id }); setCompanySearch(""); }}
                            className={`block w-full px-3 py-1.5 text-left text-sm transition hover:bg-sky-50 ${form.companyId === c.id ? "bg-sky-100 font-medium text-sky-700" : "text-gray-700"}`}>
                            {c.name}{c.domain ? ` (${c.domain})` : ""}
                          </button>
                        ))
                      )}
                    </div>
                    {form.companyId && (
                      <button type="button" onClick={() => setForm({ ...form, companyId: "" })}
                        className="mt-1 text-xs text-red-500 hover:text-red-700">Clear selection</button>
                    )}
                  </div>
              </div>
              {formError && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{formError}</div>}
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setShowModal(false)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={saving}
                  className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-600 disabled:opacity-60">
                  {saving ? "Saving..." : "Create Contact"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-200">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <svg className="h-6 w-6 animate-spin text-sky-500" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity="0.25" />
              <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
            </svg>
          </div>
        ) : contacts.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-sm text-gray-400">No contacts found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  {["Name", "Email", "Role", "Stage", "Score", "Actions"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {contacts.map((contact) => (
                  <Fragment key={contact.id}>
                    <tr
                      key={contact.id}
                      className="cursor-pointer border-b border-gray-100 transition hover:bg-gray-50"
                      onClick={() => expandRow(contact)}
                    >
                      <td className="px-4 py-2.5 text-sm font-medium text-gray-900">{contact.name}</td>
                      <td className="px-4 py-2.5 text-sm text-gray-500">{contact.email}</td>
                      <td className="px-4 py-2.5 text-sm text-gray-700">{contact.role || "—"}</td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${stageBadge[contact.stage] || defaultBadge}`}>
                          {contact.stage}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-sm text-gray-700">{contact.score ?? "—"}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          {invitedIds.has(contact.id) ? (
                            <span className="flex items-center gap-1">
                              <button
                                onClick={() => handleResend(contact)}
                                disabled={!contact.company?.id}
                                className="rounded bg-amber-50 px-2 py-1 text-xs font-medium text-amber-600 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-40"
                                title={contact.company?.id ? "Resend invitation email" : "No company assigned"}
                              >
                                Resend
                              </button>
                              <span className="text-[10px] text-green-500">Sent</span>
                            </span>
                          ) : (
                            <button
                              onClick={() => handleInvite(contact)}
                              disabled={!contact.company?.id}
                              className="rounded bg-sky-50 px-2 py-1 text-xs font-medium text-sky-600 transition hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-40"
                              title={contact.company?.id ? "Copy invite link" : "No company assigned"}
                            >
                              Invite
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(contact.id)}
                            className="rounded bg-red-50 px-2 py-1 text-xs font-medium text-red-600 transition hover:bg-red-100"
                          >
                            Delete
                          </button>
                        </div>
                        {creds[contact.id] && (
                          <div className="mt-1 flex items-center gap-1 text-[10px] text-gray-500">
                            <span className="font-mono">{creds[contact.id].email}</span>
                            <span className="text-gray-300">|</span>
                            <span className="font-mono">{creds[contact.id].password}</span>
                            <button
                              onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(`Email: ${creds[contact.id].email}\nPassword: ${creds[contact.id].password}`); showToast("Credentials copied"); }}
                              className="text-blue-500 hover:text-blue-700"
                            >Copy</button>
                          </div>
                        )}
                      </td>
                    </tr>
                    {expandedId === contact.id && (
                      <tr key={`${contact.id}-edit`}>
                        <td colSpan={6} className="bg-gray-50 px-4 py-4">
                          <div className="grid gap-4 sm:grid-cols-5">
                            <div>
                              <label className="mb-1 block text-xs font-medium text-gray-600">Name</label>
                              <input type="text" value={editForm.name}
                                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200" />
                            </div>
                            <div>
                              <label className="mb-1 block text-xs font-medium text-gray-600">Email</label>
                              <input type="email" value={editForm.email}
                                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                                className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200" />
                            </div>
                            <div>
                              <label className="mb-1 block text-xs font-medium text-gray-600">Phone</label>
                              <input type="text" value={editForm.phone}
                                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                                className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200" />
                            </div>
                            <div>
                              <label className="mb-1 block text-xs font-medium text-gray-600">Role</label>
                              <input type="text" value={editForm.role}
                                onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                                className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200" />
                            </div>
                            <div>
                              <label className="mb-1 block text-xs font-medium text-gray-600">Stage</label>
                              <select value={editForm.stage}
                                onChange={(e) => setEditForm({ ...editForm, stage: e.target.value })}
                                className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200">
                                {STAGES.filter((s) => s !== "ALL").map((s) => (
                                  <option key={s} value={s}>{s}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                          <div className="mt-3 flex justify-end gap-2">
                            <button onClick={() => setExpandedId(null)}
                              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-50">Cancel</button>
                            <button onClick={() => handleSaveEdit(contact)}
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
          <span className="text-gray-500">Showing {contacts.length} of {total} contacts</span>
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
