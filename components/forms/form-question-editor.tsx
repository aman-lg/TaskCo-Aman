"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

export type QuestionType = "text" | "numeric" | "single_select" | "multi_select" | "rating" | "upload";
export type Cadence = "one_time" | "weekly" | "monthly" | "quarterly";

export interface QuestionConfig {
  options?: string[];
  min?: number;
  max?: number;
  max_size_mb?: number;
  allowed_mime?: string[];
}

export interface QuestionDraft {
  label: string;
  question_type: QuestionType;
  config: QuestionConfig;
  is_required: boolean;
  cadence: Cadence | null;
}

const TYPE_LABEL: Record<QuestionType, string> = {
  text: "Text", numeric: "Numeric", single_select: "Single-select", multi_select: "Multi-select",
  rating: "Rating (1-5)", upload: "File upload",
};
const CADENCE_LABEL: Record<Cadence, string> = {
  one_time: "One-time", weekly: "Weekly", monthly: "Monthly", quarterly: "Quarterly",
};

const EMPTY_DRAFT: QuestionDraft = { label: "", question_type: "text", config: {}, is_required: true, cadence: null };

export function FormQuestionEditor({
  open, onOpenChange, initial, onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: QuestionDraft;
  onSave: (draft: QuestionDraft) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState<QuestionDraft>(initial ?? EMPTY_DRAFT);
  const [optionsText, setOptionsText] = useState((initial?.config.options ?? []).join("\n"));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setDraft(initial ?? EMPTY_DRAFT);
      setOptionsText((initial?.config.options ?? []).join("\n"));
    }
  }, [open, initial]);

  const needsOptions = draft.question_type === "single_select" || draft.question_type === "multi_select";

  async function handleSave() {
    if (!draft.label.trim()) { toast.error("Label is required"); return; }
    const config: QuestionConfig = { ...draft.config };
    if (needsOptions) {
      config.options = optionsText.split("\n").map((s) => s.trim()).filter(Boolean);
      if (config.options.length === 0) { toast.error("Add at least one option"); return; }
    }
    setSaving(true);
    const success = await onSave({ ...draft, config });
    setSaving(false);
    if (success) onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit Question" : "Add Question"}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <input placeholder="Question label" value={draft.label} onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
            className="h-9 px-3 rounded-lg text-[13.5px]" style={{ border: "1px solid var(--line)", background: "var(--page-bg)", color: "var(--ink)" }} />

          <select value={draft.question_type} onChange={(e) => setDraft((d) => ({ ...d, question_type: e.target.value as QuestionType }))}
            className="h-9 px-3 rounded-lg text-[13.5px]" style={{ border: "1px solid var(--line)", background: "var(--page-bg)", color: "var(--ink)" }}>
            {(Object.keys(TYPE_LABEL) as QuestionType[]).map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
          </select>

          {needsOptions && (
            <textarea rows={3} placeholder="One option per line" value={optionsText} onChange={(e) => setOptionsText(e.target.value)}
              className="px-3 py-2 rounded-lg text-[13.5px]" style={{ border: "1px solid var(--line)", background: "var(--page-bg)", color: "var(--ink)" }} />
          )}

          {draft.question_type === "numeric" && (
            <div className="flex gap-2">
              <input type="number" placeholder="Min (optional)" value={draft.config.min ?? ""} onChange={(e) => setDraft((d) => ({ ...d, config: { ...d.config, min: e.target.value === "" ? undefined : Number(e.target.value) } }))}
                className="h-9 px-3 rounded-lg text-[13.5px] flex-1" style={{ border: "1px solid var(--line)", background: "var(--page-bg)", color: "var(--ink)" }} />
              <input type="number" placeholder="Max (optional)" value={draft.config.max ?? ""} onChange={(e) => setDraft((d) => ({ ...d, config: { ...d.config, max: e.target.value === "" ? undefined : Number(e.target.value) } }))}
                className="h-9 px-3 rounded-lg text-[13.5px] flex-1" style={{ border: "1px solid var(--line)", background: "var(--page-bg)", color: "var(--ink)" }} />
            </div>
          )}

          {draft.question_type === "rating" && (
            <input type="number" min={2} max={10} placeholder="Scale max (default 5)" value={draft.config.max ?? ""} onChange={(e) => setDraft((d) => ({ ...d, config: { ...d.config, max: e.target.value === "" ? undefined : Number(e.target.value) } }))}
              className="h-9 px-3 rounded-lg text-[13.5px]" style={{ border: "1px solid var(--line)", background: "var(--page-bg)", color: "var(--ink)" }} />
          )}

          {draft.question_type === "upload" && (
            <input type="number" min={1} max={25} placeholder="Max size MB (default 10)" value={draft.config.max_size_mb ?? ""} onChange={(e) => setDraft((d) => ({ ...d, config: { ...d.config, max_size_mb: e.target.value === "" ? undefined : Number(e.target.value) } }))}
              className="h-9 px-3 rounded-lg text-[13.5px]" style={{ border: "1px solid var(--line)", background: "var(--page-bg)", color: "var(--ink)" }} />
          )}

          <select value={draft.cadence ?? ""} onChange={(e) => setDraft((d) => ({ ...d, cadence: e.target.value ? (e.target.value as Cadence) : null }))}
            className="h-9 px-3 rounded-lg text-[13.5px]" style={{ border: "1px solid var(--line)", background: "var(--page-bg)", color: "var(--ink)" }}>
            <option value="">No cadence (plain question)</option>
            {(Object.keys(CADENCE_LABEL) as Cadence[]).map((c) => <option key={c} value={c}>{CADENCE_LABEL[c]}</option>)}
          </select>

          <label className="flex items-center gap-2 text-[13px]" style={{ color: "var(--text-secondary)" }}>
            <input type="checkbox" checked={draft.is_required} onChange={(e) => setDraft((d) => ({ ...d, is_required: e.target.checked }))} />
            Required
          </label>
        </div>
        <DialogFooter>
          <button onClick={() => void handleSave()} disabled={saving}
            className="h-9 px-4 rounded-lg text-[13px] font-semibold text-white disabled:opacity-60" style={{ background: "var(--navy)" }}>
            {saving ? "Saving…" : "Save"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
