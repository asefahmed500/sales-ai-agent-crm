"use client";

import { useEffect, useState } from "react";
import { api, backendUrl } from "@/lib/api";

interface DocTicket {
  id: string;
  subject: string;
  description: string;
  status: string;
  createdAt: string;
  contact: { name: string; email: string } | null;
}

const statusBadge: Record<string, string> = {
  PENDING_REVIEW: "bg-amber-100 text-amber-700",
  APPROVED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
};

export default function AdminDocumentsPage() {
  const [docs, setDocs] = useState<DocTicket[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [reviewComment, setReviewComment] = useState("");
  const [toast, setToast] = useState("");

  useEffect(() => { api.getDocumentReviews().then(setDocs).catch(() => {}); }, []);

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(""), 2500); }

  async function loadComments(id: string) {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    setReviewComment("");
    try { setComments(await api.getDocumentComments(id)); } catch { setComments([]); }
  }

  async function handleReview(id: string, status: string) {
    try {
      await api.reviewDocument(id, { status, comment: reviewComment });
      showToast(`Document ${status.toLowerCase()}`);
      setReviewComment("");
      setDocs(await api.getDocumentReviews());
      const c = await api.getDocumentComments(id);
      setComments(c);
    } catch { showToast("Review failed"); }
  }

  function parseDesc(raw: string): { text: string; files: string[] } {
    try { return JSON.parse(raw); } catch { return { text: raw, files: [] }; }
  }

  return (
    <div className="space-y-4">
      {toast && <div className="fixed right-6 top-20 z-50 rounded-lg bg-gray-900 px-4 py-2.5 text-sm text-white shadow-lg">{toast}</div>}
      <h1 className="text-xl font-bold text-gray-900">Document Reviews</h1>

      {docs.length === 0 ? (
        <div className="rounded-xl bg-white py-10 text-center text-sm text-gray-400 shadow-sm ring-1 ring-gray-200">No documents submitted</div>
      ) : (
        <div className="space-y-3">
          {docs.map((d) => {
            const p = parseDesc(d.description);
            return (
              <div key={d.id} className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200">
                <div className="flex items-start justify-between p-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-gray-900">{d.subject}</h3>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadge[d.status] || "bg-gray-100 text-gray-700"}`}>{d.status}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {d.contact?.name || "Unknown"} &lt;{d.contact?.email || "?"}&gt; &middot; {new Date(d.createdAt).toLocaleDateString()}
                    </p>
                    {p.text && <p className="mt-2 text-xs text-gray-600">{p.text}</p>}
                    {p.files && p.files.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {p.files.map((fp, i) => (
                          <a key={i} href={`${backendUrl}${fp}`} target="_blank" rel="noopener noreferrer"
                            className="rounded bg-blue-50 px-2 py-1 text-xs text-blue-600 hover:bg-blue-100">File {i + 1}</a>
                        ))}
                      </div>
                    )}
                  </div>
                  <button onClick={() => loadComments(d.id)} className="ml-3 text-xs text-sky-500 hover:text-sky-700 shrink-0">
                    {expandedId === d.id ? "Close" : "Review"}
                  </button>
                </div>

                {expandedId === d.id && (
                  <div className="border-t border-gray-100 px-4 py-3">
                    <div className="mb-3 space-y-1">
                      <p className="text-xs font-medium text-gray-600">Feedback</p>
                      {comments.length === 0 ? (
                        <p className="text-xs text-gray-400">No comments yet</p>
                      ) : (
                        comments.map((c, i) => {
                          const ct = (() => { try { return JSON.parse(c.content); } catch { return { comment: c.content }; } })();
                          return (
                            <div key={i} className="rounded-lg bg-gray-50 px-3 py-2 text-xs">
                              <span className="font-medium text-gray-700">{ct.reviewer || "Reviewer"}:</span> {ct.comment}
                            </div>
                          );
                        })
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <input type="text" value={reviewComment} onChange={(e) => setReviewComment(e.target.value)}
                        className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs outline-none focus:border-sky-500"
                        placeholder="Add feedback comment..." />
                      <button onClick={() => handleReview(d.id, "APPROVED")}
                        className="rounded-lg bg-green-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-600">Approve</button>
                      <button onClick={() => handleReview(d.id, "REJECTED")}
                        className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-600">Reject</button>
                    </div>
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
