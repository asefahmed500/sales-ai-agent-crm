"use client";

import { Fragment, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Company } from "@/lib/types";

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: "", domain: "", industry: "", size: "", website: "" });
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", domain: "", industry: "", size: "", website: "" });

  const [toast, setToast] = useState("");

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  }

  function load() {
    setLoading(true);
    const params: { page?: number; search?: string } = { page };
    if (search) params.search = search;
    api.getCrmCompanies(params)
      .then((res) => {
        setCompanies(res.items);
        setTotal(res.total);
        setPage(res.page);
        setTotalPages(res.totalPages);
      })
      .catch(() => showToast("Failed to load companies"))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [page, search]);

  async function handleCreate(ev: React.FormEvent) {
    ev.preventDefault();
    setFormError("");
    if (!form.name) {
      setFormError("Company name is required");
      return;
    }
    setSaving(true);
    try {
      await api.createCompany({
        name: form.name,
        domain: form.domain || undefined,
        industry: form.industry || undefined,
        size: form.size || undefined,
        website: form.website || undefined,
      } as Partial<Company>);
      setShowModal(false);
      setForm({ name: "", domain: "", industry: "", size: "", website: "" });
      showToast("Company created");
      load();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Failed to create company");
    } finally {
      setSaving(false);
    }
  }

  function expandRow(company: Company) {
    if (expandedId === company.id) {
      setExpandedId(null);
    } else {
      setExpandedId(company.id);
      setEditForm({
        name: company.name,
        domain: company.domain ?? "",
        industry: company.industry ?? "",
        size: company.size ?? "",
        website: company.website ?? "",
      });
    }
  }

  async function handleSave(company: Company) {
    try {
      await api.updateCompany(company.id, {
        name: editForm.name,
        domain: editForm.domain || null,
        industry: editForm.industry || null,
        size: editForm.size || null,
        website: editForm.website || null,
      } as Partial<Company>);
      showToast("Company updated");
      setExpandedId(null);
      load();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Update failed");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this company?")) return;
    try {
      await api.deleteCompany(id);
      showToast("Company deleted");
      load();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Delete failed");
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
        <div className="relative">
          <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search companies..."
            className="w-64 rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
          />
        </div>
        <button
          onClick={() => { setShowModal(true); setFormError(""); }}
          className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-600"
        >
          + New Company
        </button>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30" onClick={() => setShowModal(false)}>
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">New Company</h3>
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
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200" placeholder="Acme Corp" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Domain</label>
                  <input type="text" value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200" placeholder="acme.com" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Industry</label>
                  <input type="text" value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200" placeholder="Technology" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Size</label>
                  <select value={form.size} onChange={(e) => setForm({ ...form, size: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200">
                    <option value="">Select size</option>
                    <option value="1-10">1-10</option>
                    <option value="11-50">11-50</option>
                    <option value="51-200">51-200</option>
                    <option value="201-1000">201-1000</option>
                    <option value="1001+">1001+</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-medium text-gray-600">Website</label>
                  <input type="text" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200" placeholder="https://acme.com" />
                </div>
              </div>
              {formError && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{formError}</div>}
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setShowModal(false)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={saving}
                  className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-600 disabled:opacity-60">
                  {saving ? "Saving..." : "Create Company"}
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
        ) : companies.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-sm text-gray-400">No companies found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  {["Name", "Domain", "Industry", "Size", "Score", "Actions"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {companies.map((company) => (
                  <Fragment key={company.id}>
                    <tr
                      className="cursor-pointer border-b border-gray-100 transition hover:bg-gray-50"
                      onClick={() => expandRow(company)}
                    >
                      <td className="px-4 py-2.5 text-sm font-medium text-gray-900">{company.name}</td>
                      <td className="px-4 py-2.5 text-sm text-gray-500">{company.domain || "—"}</td>
                      <td className="px-4 py-2.5 text-sm text-gray-700">{company.industry || "—"}</td>
                      <td className="px-4 py-2.5 text-sm text-gray-700">{company.size || "—"}</td>
                      <td className="px-4 py-2.5 text-sm text-gray-700">{company.score ?? "—"}</td>
                      <td className="px-4 py-2.5">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(company.id); }}
                          className="rounded bg-red-50 px-2 py-1 text-xs font-medium text-red-600 transition hover:bg-red-100"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                    {expandedId === company.id && (
                      <tr key={`${company.id}-edit`}>
                        <td colSpan={6} className="bg-gray-50 px-4 py-4">
                          <div className="grid gap-4 sm:grid-cols-5">
                            <div>
                              <label className="mb-1 block text-xs font-medium text-gray-600">Name</label>
                              <input type="text" value={editForm.name}
                                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200" />
                            </div>
                            <div>
                              <label className="mb-1 block text-xs font-medium text-gray-600">Domain</label>
                              <input type="text" value={editForm.domain}
                                onChange={(e) => setEditForm({ ...editForm, domain: e.target.value })}
                                className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200" />
                            </div>
                            <div>
                              <label className="mb-1 block text-xs font-medium text-gray-600">Industry</label>
                              <input type="text" value={editForm.industry}
                                onChange={(e) => setEditForm({ ...editForm, industry: e.target.value })}
                                className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200" />
                            </div>
                            <div>
                              <label className="mb-1 block text-xs font-medium text-gray-600">Size</label>
                              <select value={editForm.size}
                                onChange={(e) => setEditForm({ ...editForm, size: e.target.value })}
                                className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200">
                                <option value="">Select</option>
                                <option value="1-10">1-10</option>
                                <option value="11-50">11-50</option>
                                <option value="51-200">51-200</option>
                                <option value="201-1000">201-1000</option>
                                <option value="1001+">1001+</option>
                              </select>
                            </div>
                            <div>
                              <label className="mb-1 block text-xs font-medium text-gray-600">Website</label>
                              <input type="text" value={editForm.website}
                                onChange={(e) => setEditForm({ ...editForm, website: e.target.value })}
                                className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200" />
                            </div>
                          </div>
                          <div className="mt-3 flex justify-end gap-2">
                            <button onClick={() => setExpandedId(null)}
                              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-50">Cancel</button>
                            <button onClick={() => handleSave(company)}
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
          <span className="text-gray-500">Showing {companies.length} of {total} companies</span>
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
