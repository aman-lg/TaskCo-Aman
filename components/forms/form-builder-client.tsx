"use client";

import { useState } from "react";
import Link from "next/link";
import { Pencil, Trash2, ChevronUp, ChevronDown, Plus, Copy, FileText, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FormQuestionEditor, TYPE_LABEL, type QuestionDraft } from "./form-question-editor";

interface Question extends QuestionDraft {
  id: string;
  position: number;
}

interface FormMeta {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  requires_login: boolean;
  has_rating_subject: boolean;
  is_published: boolean;
}

const CADENCE_BADGE: Record<string, string> = {
  one_time: "One-time", weekly: "Weekly", monthly: "Monthly", quarterly: "Quarterly",
};

export function FormBuilderClient({ form: initialForm, initialQuestions }: { form: FormMeta; initialQuestions: Question[] }) {
  const [form, setForm] = useState(initialForm);
  const [questions, setQuestions] = useState<Question[]>(initialQuestions);
  const [title, setTitle] = useState(initialForm.title);
  const [description, setDescription] = useState(initialForm.description ?? "");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Question | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Question | null>(null);

  async function patchForm(patch: Record<string, unknown>) {
    const res = await fetch(`/api/forms/${form.id}`, {
      method: "PATCH", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) { toast.error(json?.error?.message ?? "Update failed"); return false; }
    setForm(json.data);
    return true;
  }

  async function saveMeta() {
    await patchForm({ title, description: description || null });
    toast.success("Saved");
  }

  async function saveQuestion(draft: QuestionDraft): Promise<boolean> {
    const url = editing ? `/api/forms/${form.id}/questions/${editing.id}` : `/api/forms/${form.id}/questions`;
    const res = await fetch(url, {
      method: editing ? "PATCH" : "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) { toast.error(json?.error?.message ?? "Save failed"); return false; }
    if (editing) {
      setQuestions((prev) => prev.map((q) => (q.id === editing.id ? json.data : q)));
    } else {
      setQuestions((prev) => [...prev, json.data]);
    }
    setEditing(null);
    return true;
  }

  async function deleteQuestion(q: Question) {
    const res = await fetch(`/api/forms/${form.id}/questions/${q.id}`, { method: "DELETE", credentials: "same-origin" });
    if (!res.ok) { toast.error("Delete failed"); return; }
    setQuestions((prev) => prev.filter((x) => x.id !== q.id));
    setDeleteTarget(null);
  }

  async function moveQuestion(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= questions.length) return;
    const a = questions[index];
    const b = questions[target];
    const reordered = [...questions];
    reordered[index] = { ...b, position: a.position };
    reordered[target] = { ...a, position: b.position };
    reordered.sort((x, y) => x.position - y.position);
    setQuestions(reordered);
    await Promise.all([
      fetch(`/api/forms/${form.id}/questions/${a.id}`, { method: "PATCH", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ position: b.position }) }),
      fetch(`/api/forms/${form.id}/questions/${b.id}`, { method: "PATCH", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ position: a.position }) }),
    ]);
  }

  function copyLink() {
    const url = `${window.location.origin}/form/${form.slug}`;
    navigator.clipboard.writeText(url).then(() => toast.success("Link copied"));
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-xl p-5 flex flex-col gap-3" style={{ background: "var(--surface-bg)" }}>
        <input value={title} onChange={(e) => setTitle(e.target.value)} onBlur={saveMeta}
          className="text-[20px] font-bold bg-transparent outline-none" style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }} />
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} onBlur={saveMeta} rows={2} placeholder="Description (optional)"
          className="text-[13px] bg-transparent outline-none resize-none" style={{ color: "var(--text-secondary)" }} />

        <div className="flex flex-wrap items-center gap-4 pt-2 border-t" style={{ borderColor: "var(--line)" }}>
          <label className="flex items-center gap-2 text-[13px]" style={{ color: "var(--text-secondary)" }}>
            <input type="checkbox" checked={form.requires_login} disabled={form.has_rating_subject}
              onChange={(e) => void patchForm({ requires_login: e.target.checked })} />
            Requires login
          </label>
          <label className="flex items-center gap-2 text-[13px]" style={{ color: "var(--text-secondary)" }}>
            <input type="checkbox" checked={form.has_rating_subject} onChange={(e) => void patchForm({ has_rating_subject: e.target.checked, requires_login: e.target.checked ? true : form.requires_login })} />
            Rating form
          </label>
          <label className="flex items-center gap-2 text-[13px] font-semibold ml-auto" style={{ color: form.is_published ? "var(--clr-green)" : "var(--text-muted)" }}>
            <input type="checkbox" checked={form.is_published} onChange={(e) => void patchForm({ is_published: e.target.checked })} />
            {form.is_published ? "Published" : "Draft"}
          </label>
          <button onClick={copyLink} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12.5px] font-semibold" style={{ border: "1px solid var(--line)", color: "var(--navy)" }}>
            <Copy className="w-3.5 h-3.5" /> Copy fill link
          </button>
          <Link href={`/forms/${form.id}/responses`} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12.5px] font-semibold" style={{ border: "1px solid var(--line)", color: "var(--text-secondary)" }}>
            <FileText className="w-3.5 h-3.5" /> Responses
          </Link>
          {form.has_rating_subject && (
            <Link href={`/forms/${form.id}/results`} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12.5px] font-semibold" style={{ border: "1px solid var(--line)", color: "var(--text-secondary)" }}>
              <BarChart3 className="w-3.5 h-3.5" /> Results
            </Link>
          )}
        </div>
      </div>

      <div className="rounded-xl p-5" style={{ background: "var(--surface-bg)" }}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-[13px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Questions</p>
          <button onClick={() => { setEditing(null); setEditorOpen(true); }} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12.5px] font-semibold text-white" style={{ background: "var(--navy)" }}>
            <Plus className="w-3.5 h-3.5" /> Add Question
          </button>
        </div>

        {questions.length === 0 ? (
          <p className="text-[13px] py-6 text-center" style={{ color: "var(--text-fine)" }}>No questions yet.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {questions.map((q, i) => (
              <li key={q.id} className="flex items-center gap-2 py-2.5 border-t first:border-t-0" style={{ borderColor: "var(--line)" }}>
                <div className="flex flex-col">
                  <button onClick={() => void moveQuestion(i, -1)} disabled={i === 0} className="disabled:opacity-30" style={{ color: "var(--text-muted)" }}><ChevronUp className="w-3.5 h-3.5" /></button>
                  <button onClick={() => void moveQuestion(i, 1)} disabled={i === questions.length - 1} className="disabled:opacity-30" style={{ color: "var(--text-muted)" }}><ChevronDown className="w-3.5 h-3.5" /></button>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13.5px] font-medium truncate" style={{ color: "var(--ink)" }}>{q.label}{q.is_required && <span style={{ color: "var(--clr-red)" }}> *</span>}</p>
                  <p className="text-[11.5px]" style={{ color: "var(--text-muted)" }}>
                    {TYPE_LABEL[q.question_type]}{q.cadence && ` · ${CADENCE_BADGE[q.cadence]}`}
                  </p>
                  {(q.question_type === "single_select" || q.question_type === "multi_select") && q.config.options && q.config.options.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {q.config.options.map((opt) => (
                        <span key={opt} className="text-[11px] px-2 py-0.5 rounded-md" style={{ background: "var(--page-bg)", color: "var(--text-secondary)" }}>{opt}</span>
                      ))}
                    </div>
                  )}
                </div>
                <button onClick={() => { setEditing(q); setEditorOpen(true); }} className="w-8 h-8 flex items-center justify-center rounded-lg" style={{ color: "var(--text-muted)" }}><Pencil className="w-4 h-4" /></button>
                <button onClick={() => setDeleteTarget(q)} className="w-8 h-8 flex items-center justify-center rounded-lg" style={{ color: "var(--clr-red)" }}><Trash2 className="w-4 h-4" /></button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <FormQuestionEditor open={editorOpen} onOpenChange={setEditorOpen} initial={editing ?? undefined} onSave={saveQuestion} />
      <ConfirmDialog
        open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}
        title={`Delete "${deleteTarget?.label}"?`} description="This can't be undone." confirmLabel="Delete" destructive
        onConfirm={() => deleteTarget && void deleteQuestion(deleteTarget)}
      />
    </div>
  );
}
