"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { api, backendUrl } from "@/lib/api";

interface DocTicket {
  id: string;
  subject: string;
  description: string;
  status: string;
  createdAt: string;
}

const statusBadge: Record<string, string> = {
  PENDING_REVIEW: "bg-amber-100 text-amber-700",
  APPROVED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
};

export default function PortalDocuments() {
  const [docs, setDocs] = useState<DocTicket[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [comments, setComments] = useState<any[]>([]);

  useEffect(() => { api.getMyDocuments().then(setDocs).catch(() => {}); }, []);

  async function handleSubmit(ev: FormEvent) {
    ev.preventDefault();
    if (!title) return;
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("title", title);
      fd.append("description", desc);
      files.forEach((f) => fd.append("files", f));
      await api.uploadDocument(fd);
      setShowForm(false);
      setTitle(""); setDesc(""); setFiles([]);
      const updated = await api.getMyDocuments();
      setDocs(updated);
    } catch (err) { console.error(err); } finally { setSaving(false); }
  }

  async function loadComments(id: string) {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    try {
      const c = await api.getDocumentComments(id);
      setComments(c);
    } catch { setComments([]); }
  }

  function parseDesc(raw: string): { text: string; files: string[] } {
    try { return JSON.parse(raw); } catch { return { text: raw, files: [] }; }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">My Documents</h1>
        <button onClick={() => setShowForm(true)}
          className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white hover:bg-sky-600">
          + Submit Document
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30" onClick={() => setShowForm(false)}>
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-4 text-sm font-semibold text-gray-900">Submit Document for Review</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Title *</label>
                <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200" required />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Description</label>
                <textarea value={desc} onChange={(e) => setDesc(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200" rows={3} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Files (max 5, up to 20MB each)</label>
                <input type="file" multiple ref={fileRef} onChange={(e) => setFiles(Array.from(e.target.files || []))}
                  className="w-full text-sm" />
              </div>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setShowForm(false)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700">Cancel</button>
                <button type="submit" disabled={saving}
                  className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
                  {saving ? "Uploading..." : "Submit"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {docs.length === 0 ? (
        <div className="rounded-xl bg-white py-10 text-center text-sm text-gray-400 shadow-sm ring-1 ring-gray-200">No documents submitted yet</div>
      ) : (
        <div className="space-y-3">
          {docs.map((d) => {
            const p = parseDesc(d.description);
            return (
              <div key={d.id} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">{d.subject}</h3>
                    <p className="mt-0.5 text-xs text-gray-500">{new Date(d.createdAt).toLocaleDateString()}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadge[d.status] || "bg-gray-100 text-gray-700"}`}>
                    {d.status}
                  </span>
                </div>
                {p.text && <p className="mt-2 text-xs text-gray-600">{p.text}</p>}
                {p.files && p.files.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {p.files.map((fp, i) => (
                      <a key={i} href={`${backendUrl}${fp}`} target="_blank" rel="noopener noreferrer"
                        className="rounded bg-blue-50 px-2 py-1 text-xs text-blue-600 hover:bg-blue-100">
                        File {i + 1}
                      </a>
                    ))}
                  </div>
                )}
                <button onClick={() => loadComments(d.id)} className="mt-2 text-xs text-sky-500 hover:text-sky-700">
                  {expandedId === d.id ? "Hide feedback" : "View feedback"}
                </button>
                {expandedId === d.id && (
                  <div className="mt-2 space-y-1 border-t border-gray-100 pt-2">
                    {comments.length === 0 ? (
                      <p className="text-xs text-gray-400">No feedback yet</p>
                    ) : (
                      comments.map((c, i) => {
                        const content = (() => { try { return JSON.parse(c.content); } catch { return { comment: c.content }; } })();
                        return (
                          <div key={i} className="rounded-lg bg-gray-50 px-3 py-2 text-xs">
                            <span className="font-medium text-gray-700">{content.reviewer || "Reviewer"}:</span> {content.comment}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
