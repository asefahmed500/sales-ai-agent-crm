"use client";

import { Fragment, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Deal, Contact, Company, Interaction } from "@/lib/types";
import { DndContext, useDroppable, useDraggable, DragOverlay, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

const STAGES = ["PROSPECT", "QUALIFIED", "DISCOVERY", "PROPOSAL", "NEGOTIATION", "CLOSED_WON"];

const stageColors: Record<string, string> = {
  PROSPECT: "bg-gray-500",
  QUALIFIED: "bg-blue-500",
  DISCOVERY: "bg-indigo-500",
  PROPOSAL: "bg-amber-500",
  NEGOTIATION: "bg-orange-500",
  CLOSED_WON: "bg-emerald-500",
};

const stageHeaderBg: Record<string, string> = {
  PROSPECT: "bg-gray-100",
  QUALIFIED: "bg-blue-100",
  DISCOVERY: "bg-indigo-100",
  PROPOSAL: "bg-amber-100",
  NEGOTIATION: "bg-orange-100",
  CLOSED_WON: "bg-emerald-100",
};

const stageHeaderText: Record<string, string> = {
  PROSPECT: "text-gray-700",
  QUALIFIED: "text-blue-700",
  DISCOVERY: "text-indigo-700",
  PROPOSAL: "text-amber-700",
  NEGOTIATION: "text-orange-700",
  CLOSED_WON: "text-emerald-700",
};

const stageNext: Record<string, string> = {
  PROSPECT: "QUALIFIED",
  QUALIFIED: "DISCOVERY",
  DISCOVERY: "PROPOSAL",
  PROPOSAL: "NEGOTIATION",
  NEGOTIATION: "CLOSED_WON",
};

function fmtAmount(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function dealAge(createdAt: string): number {
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000);
}

function DroppableColumn({ stage, deals, onDealMoved, onOpenComments }: { stage: string; deals: Deal[]; onDealMoved: () => void; onOpenComments: (deal: Deal) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });

  return (
    <div
      ref={setNodeRef}
      className={`flex w-72 shrink-0 flex-col rounded-xl bg-white shadow-sm ring-1 ring-gray-200 transition ${isOver ? "ring-2 ring-sky-400" : ""}`}
    >
      <div className={`flex items-center justify-between rounded-t-xl px-3 py-2.5 ${stageHeaderBg[stage] || "bg-gray-100"}`}>
        <span className={`text-xs font-semibold uppercase tracking-wider ${stageHeaderText[stage] || "text-gray-700"}`}>
          {stage.replace("_", " ")}
        </span>
        <span className={`rounded-full px-2 py-0.5 text-xs font-bold text-white ${stageColors[stage] || "bg-gray-400"}`}>
          {deals.length}
        </span>
      </div>
      <div className="flex flex-col gap-2 p-2">
        {deals.length === 0 ? (
          <div className="flex items-center justify-center py-6 text-xs text-gray-400">No deals</div>
        ) : (
          deals.map((deal) => <DraggableCard key={deal.id} deal={deal} stage={stage} onMoved={onDealMoved} onOpenComments={onOpenComments} />)
        )}
      </div>
    </div>
  );
}

function DraggableCard({ deal, stage, onMoved, onOpenComments }: { deal: Deal; stage: string; onMoved: () => void; onOpenComments: (deal: Deal) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: deal.id,
    data: { currentStage: stage },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    opacity: isDragging ? 0.4 : 1,
  };

  async function moveToNext() {
    const next = stageNext[stage];
    if (!next) return;
    try {
      await api.updateDeal(deal.id, { stage: next } as Partial<Deal>);
      onMoved();
    } catch {
      /* silently fail */
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`cursor-grab rounded-lg border border-gray-200 bg-white p-3 shadow-sm transition hover:shadow-md active:cursor-grabbing ${isDragging ? "shadow-lg" : ""}`}
    >
      <div className="mb-1 flex items-start justify-between">
        <div className="text-sm font-medium text-gray-900">{deal.name}</div>
        <button
          onClick={(e) => { e.stopPropagation(); onOpenComments(deal); }}
          className="ml-2 shrink-0 rounded p-1 text-gray-400 transition hover:bg-gray-100 hover:text-blue-600"
          title="Feedback"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
        </button>
      </div>
      <div className="mb-2 text-xs text-gray-500">{deal.company?.name || "No company"}</div>
      <div className="mb-1 text-sm font-semibold text-gray-800">{fmtAmount(deal.amount)}</div>
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-gray-400">{dealAge(deal.createdAt)}d</span>
        {stageNext[stage] && (
          <button
            onClick={(e) => { e.stopPropagation(); moveToNext(); }}
            className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600 hover:bg-gray-200"
          >
            Move to {stageNext[stage].replace("_", " ")}
          </button>
        )}
      </div>
    </div>
  );
}

export default function DealsPage() {
  const [pipeline, setPipeline] = useState<Record<string, Deal[]>>({});
  const [loading, setLoading] = useState(true);
  const [activeDeal, setActiveDeal] = useState<Deal | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: "", contactId: "", companyId: "", amount: "", stage: "PROSPECT" });
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);

  const [toast, setToast] = useState("");

  // Feedback modal state
  const [feedbackDeal, setFeedbackDeal] = useState<Deal | null>(null);
  const [feedbackComments, setFeedbackComments] = useState<Interaction[]>([]);
  const [feedbackInput, setFeedbackInput] = useState("");
  const [feedbackSaving, setFeedbackSaving] = useState("");

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  }

  function loadPipeline() {
    setLoading(true);
    api.getPipeline()
      .then(setPipeline)
      .catch(() => showToast("Failed to load pipeline"))
      .finally(() => setLoading(false));
  }

  function loadOptions() {
    api.getCrmContacts({ page: 1 }).then((r) => setContacts(r.items)).catch(() => {});
    api.getCrmCompanies({ page: 1 }).then((r) => setCompanies(r.items)).catch(() => {});
  }

  useEffect(() => { loadPipeline(); loadOptions(); }, []);

  const allDeals = Object.values(pipeline).flat();

  function handleDragStart(event: DragStartEvent) {
    const deal = allDeals.find(d => d.id === event.active.id);
    setActiveDeal(deal ?? null);
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveDeal(null);
    const { active, over } = event;
    if (!over) return;
    const dealId = active.id as string;
    const newStage = over.id as string;
    const currentStage = active.data.current?.currentStage as string | undefined;
    if (!newStage || !STAGES.includes(newStage) || newStage === currentStage) return;
    try {
      await api.updateDeal(dealId, { stage: newStage } as Partial<Deal>);
      showToast("Deal moved to " + newStage.replace("_", " "));
      loadPipeline();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Failed to move deal");
    }
  }

  async function handleCreate(ev: React.FormEvent) {
    ev.preventDefault();
    setFormError("");
    if (!form.name) {
      setFormError("Deal name is required");
      return;
    }
    setSaving(true);
    try {
      await api.createDeal({
        name: form.name,
        amount: Number(form.amount) || 0,
        stage: form.stage,
        contactId: form.contactId || undefined,
        companyId: form.companyId || undefined,
      } as Partial<Deal>);
      setShowModal(false);
      setForm({ name: "", contactId: "", companyId: "", amount: "", stage: "PROSPECT" });
      showToast("Deal created");
      loadPipeline();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Failed to create deal");
    } finally {
      setSaving(false);
    }
  }

  async function openComments(deal: Deal) {
    setFeedbackDeal(deal);
    setFeedbackInput("");
    try {
      setFeedbackComments(await api.getDealComments(deal.id));
    } catch {
      setFeedbackComments([]);
    }
  }

  async function handleFeedbackSubmit(dealId: string) {
    if (!feedbackInput.trim()) return;
    setFeedbackSaving(dealId);
    try {
      await api.addDealComment(dealId, feedbackInput.trim());
      setFeedbackInput("");
      setFeedbackComments(await api.getDealComments(dealId));
      showToast("Comment added");
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Failed to add comment");
    } finally {
      setFeedbackSaving("");
    }
  }

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed right-6 top-20 z-50 rounded-lg bg-gray-900 px-4 py-2.5 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Deal Pipeline</h2>
          <p className="text-sm text-gray-500">Drag deals between stages or use the move buttons</p>
        </div>
        <button
          onClick={() => { setShowModal(true); setFormError(""); }}
          className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-600"
        >
          + New Deal
        </button>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30" onClick={() => setShowModal(false)}>
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">New Deal</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-medium text-gray-600">Deal Name *</label>
                  <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200" placeholder="Enterprise license deal" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Amount</label>
                  <input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200" placeholder="50000" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Stage</label>
                  <select value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200">
                    {STAGES.map((s) => (<option key={s} value={s}>{s.replace("_", " ")}</option>))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Contact</label>
                  <select value={form.contactId} onChange={(e) => setForm({ ...form, contactId: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200">
                    <option value="">No contact</option>
                    {contacts.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Company</label>
                  <select value={form.companyId} onChange={(e) => setForm({ ...form, companyId: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200">
                    <option value="">No company</option>
                    {companies.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
                  </select>
                </div>
              </div>
              {formError && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{formError}</div>}
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setShowModal(false)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={saving}
                  className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-600 disabled:opacity-60">
                  {saving ? "Creating..." : "Create Deal"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <svg className="h-6 w-6 animate-spin text-sky-500" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity="0.25" />
            <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
          </svg>
        </div>
      ) : (
        <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="flex gap-4 overflow-x-auto pb-4">
            {STAGES.map((stage) => (
              <DroppableColumn key={stage} stage={stage} deals={pipeline[stage] ?? []} onDealMoved={loadPipeline} onOpenComments={openComments} />
            ))}
          </div>
          <DragOverlay dropAnimation={null}>
            {activeDeal ? (
              <div className="w-72 rounded-lg border-2 border-sky-400 bg-white p-3 shadow-xl">
                <div className="mb-1 flex items-start justify-between">
                  <div className="text-sm font-medium text-gray-900">{activeDeal.name}</div>
                </div>
                <div className="mb-2 text-xs text-gray-500">{activeDeal.company?.name || "No company"}</div>
                <div className="mb-1 text-sm font-semibold text-gray-800">{fmtAmount(activeDeal.amount)}</div>
                <div className="text-[10px] text-gray-400">{dealAge(activeDeal.createdAt)}d</div>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {feedbackDeal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setFeedbackDeal(null)}>
          <div className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">{feedbackDeal.name} — Feedback</h3>
              <button onClick={() => setFeedbackDeal(null)} className="text-gray-400 hover:text-gray-600">&times;</button>
            </div>
            <div className="mb-4 space-y-3">
              {feedbackComments.length === 0 && <p className="text-sm text-gray-400">No feedback yet</p>}
              {feedbackComments.map((c) => (
                <Fragment key={c.id}>
                  <div className={`rounded-lg p-3 text-sm ${c.direction === "INBOUND" ? "mr-8 bg-gray-50 text-gray-800" : "ml-8 bg-blue-50 text-blue-900"}`}>
                    <p className="text-xs text-gray-400">{c.direction === "INBOUND" ? "Client" : "You"} &middot; {new Date(c.createdAt).toLocaleDateString()}</p>
                    <p className="mt-1">{c.content}</p>
                  </div>
                </Fragment>
              ))}
            </div>
            <div className="flex gap-2">
              <input value={feedbackInput} onChange={e => setFeedbackInput(e.target.value)} placeholder="Reply to client..." className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none" />
              <button onClick={() => handleFeedbackSubmit(feedbackDeal.id)} disabled={!feedbackInput.trim() || feedbackSaving === feedbackDeal.id} className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-600 disabled:opacity-50">Send</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
