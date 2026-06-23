"use client";

import { FormEvent, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Contact, Company, OnboardingLink } from "@/lib/types";

interface CrmUser {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  createdAt: string;
}

export default function ClientsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [links, setLinks] = useState<OnboardingLink[]>([]);
  const [users, setUsers] = useState<CrmUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState("");

  const [form, setForm] = useState({ name: "", email: "", companyId: "" });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [notifyTarget, setNotifyTarget] = useState<CrmUser | null>(null);
  const [notifyForm, setNotifyForm] = useState({ title: "", message: "" });
  const [notifySending, setNotifySending] = useState(false);

  function load() {
    setLoading(true);
    Promise.all([
      api.getCrmContacts().catch(() => ({ items: [] as Contact[] })),
      api.getCrmCompanies().catch(() => ({ items: [] as Company[] })),
      api.getOnboardingLinks().catch(() => []),
      api.getCrmUsers().catch(() => []),
    ])
      .then(([c, co, l, u]) => {
        setContacts(Array.isArray(c) ? c : ((c as { items: Contact[] }).items ?? []));
        setCompanies(Array.isArray(co) ? co : ((co as { items: Company[] }).items ?? []));
        setLinks(Array.isArray(l) ? l : []);
        setUsers(Array.isArray(u) ? u.filter((x: CrmUser) => x.role === "CLIENT") : []);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function handleInvite(ev: FormEvent) {
    ev.preventDefault();
    setFormError("");
    setGeneratedUrl("");

    if (!form.name || !form.email || !form.companyId) {
      setFormError("All fields are required");
      return;
    }

    setSaving(true);
    try {
      const contact = await api.createContact({
        name: form.name,
        email: form.email,
      } as Partial<Contact>);

      const link = await api.generateOnboardingLink(contact.id, form.companyId);
      setGeneratedUrl(link.portalUrl);
      setForm({ name: "", email: "", companyId: "" });
      load();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Failed to create invitation");
    } finally {
      setSaving(false);
    }
  }

  async function toggleBlock(user: CrmUser) {
    try {
      await api.updateUser(user.id, { isActive: !user.isActive });
      load();
    } catch {
      alert("Failed to update user");
    }
  }

  async function deleteClientUser(user: CrmUser) {
    if (!confirm(`Delete user "${user.name}" (${user.email})? This cannot be undone.`)) return;
    try {
      await api.deleteUser(user.id);
      load();
    } catch {
      alert("Failed to delete user");
    }
  }

  async function sendNotify(ev: FormEvent) {
    ev.preventDefault();
    if (!notifyTarget || !notifyForm.title || !notifyForm.message) return;
    setNotifySending(true);
    try {
      await api.sendNotification(notifyTarget.id, notifyForm.title, notifyForm.message, "/portal");
      setNotifyTarget(null);
      setNotifyForm({ title: "", message: "" });
    } catch {
      alert("Failed to send notification");
    } finally {
      setNotifySending(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Client Management</h2>
          <p className="text-sm text-gray-500">Manage client users and invitation links</p>
        </div>
        <button
          onClick={() => { setShowForm(!showForm); setGeneratedUrl(""); }}
          className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-600"
        >
          {showForm ? "Cancel" : "Invite Client"}
        </button>
      </div>

      {showForm && (
        <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
          <h3 className="mb-4 text-sm font-semibold text-gray-900">New Client Invitation</h3>
          <form onSubmit={handleInvite} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Contact Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                  placeholder="Jane Doe"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Contact Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                  placeholder="jane@client.com"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Company</label>
                <select
                  value={form.companyId}
                  onChange={(e) => setForm({ ...form, companyId: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                >
                  <option value="">Select company</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {formError && (
              <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{formError}</div>
            )}

            {generatedUrl && (
              <div className="rounded-xl bg-sky-50 p-4">
                <p className="mb-1 text-xs font-medium text-sky-700">Portal URL (share with client):</p>
                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    value={generatedUrl}
                    className="flex-1 rounded-lg border border-sky-200 bg-white px-3 py-2 text-sm text-gray-700"
                  />
                  <button
                    type="button"
                    onClick={() => navigator.clipboard.writeText(generatedUrl)}
                    className="rounded-lg bg-sky-500 px-3 py-2 text-xs font-medium text-white hover:bg-sky-600"
                  >
                    Copy
                  </button>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-600 disabled:opacity-60"
            >
              {saving ? "Creating..." : "Generate Invitation"}
            </button>
          </form>
        </div>
      )}

      <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200">
        <div className="border-b border-gray-100 px-4 py-3">
          <h3 className="text-sm font-semibold text-gray-900">Existing Invitations</h3>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <svg className="h-5 w-5 animate-spin text-sky-500" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity="0.25" />
              <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
            </svg>
          </div>
        ) : links.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-sm text-gray-400">No invitations yet</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  {["Contact", "Email", "Company", "Status", "Expires", "Portal URL"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {links.map((l) => (
                  <tr key={l.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-2.5 text-sm font-medium text-gray-900">{l.contact.name}</td>
                    <td className="px-4 py-2.5 text-sm text-gray-500">{l.contact.email}</td>
                    <td className="px-4 py-2.5 text-sm text-gray-700">{l.company.name}</td>
                    <td className="px-4 py-2.5">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        l.status === "COMPLETED" ? "bg-emerald-100 text-emerald-700" :
                        l.status === "USED" ? "bg-blue-100 text-blue-700" :
                        "bg-amber-100 text-amber-700"
                      }`}>
                        {l.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-sm text-gray-500">
                      {new Date(l.expiresAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-2.5">
                      <button
                        onClick={() => navigator.clipboard.writeText(l.portalUrl)}
                        className="rounded bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-200"
                      >
                        Copy
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200">
        <div className="border-b border-gray-100 px-4 py-3">
          <h3 className="text-sm font-semibold text-gray-900">Client Users (Contacts)</h3>
        </div>
        {contacts.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-sm text-gray-400">No contacts yet</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  {["Name", "Email", "Stage", "Status", "Score"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {contacts.map((c) => (
                  <tr key={c.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-2.5 text-sm font-medium text-gray-900">{c.name}</td>
                    <td className="px-4 py-2.5 text-sm text-gray-500">{c.email}</td>
                    <td className="px-4 py-2.5">
                      <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-medium text-sky-700">{c.stage}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        c.status === "ACTIVE" ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"
                      }`}>{c.status}</span>
                    </td>
                    <td className="px-4 py-2.5 text-sm text-gray-700">{c.score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200">
        <div className="border-b border-gray-100 px-4 py-3">
          <h3 className="text-sm font-semibold text-gray-900">Client Accounts</h3>
        </div>
        {users.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-sm text-gray-400">No client accounts yet</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  {["Name", "Email", "Status", "Created", "Actions"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-2.5 text-sm font-medium text-gray-900">{u.name}</td>
                    <td className="px-4 py-2.5 text-sm text-gray-500">{u.email}</td>
                    <td className="px-4 py-2.5">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        u.isActive ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                      }`}>
                        {u.isActive ? "Active" : "Blocked"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-sm text-gray-500">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleBlock(u)}
                          className={`rounded px-2.5 py-1 text-xs font-medium transition ${
                            u.isActive
                              ? "bg-red-100 text-red-700 hover:bg-red-200"
                              : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                          }`}
                        >
                          {u.isActive ? "Block" : "Unblock"}
                        </button>
                        <button
                          onClick={() => setNotifyTarget(u)}
                          className="rounded bg-sky-100 px-2.5 py-1 text-xs font-medium text-sky-700 transition hover:bg-sky-200"
                        >
                          Notify
                        </button>
                        <button
                          onClick={() => deleteClientUser(u)}
                          className="rounded bg-red-100 px-2.5 py-1 text-xs font-medium text-red-700 transition hover:bg-red-200"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {notifyTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg">
            <h3 className="mb-2 text-sm font-semibold text-gray-900">
              Send Notification to {notifyTarget.name}
            </h3>
            <form onSubmit={sendNotify} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Title</label>
                <input
                  type="text"
                  value={notifyForm.title}
                  onChange={(e) => setNotifyForm({ ...notifyForm, title: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                  placeholder="Announcement"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Message</label>
                <textarea
                  value={notifyForm.message}
                  onChange={(e) => setNotifyForm({ ...notifyForm, message: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                  rows={3}
                  placeholder="Your message to the client..."
                  required
                />
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => { setNotifyTarget(null); setNotifyForm({ title: "", message: "" }); }}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={notifySending}
                  className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-600 disabled:opacity-60"
                >
                  {notifySending ? "Sending..." : "Send"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
