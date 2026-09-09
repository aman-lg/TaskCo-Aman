"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Upload, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

type QuestionType = "text" | "long_text" | "numeric" | "single_select" | "multi_select" | "rating" | "upload";
type Cadence = "one_time" | "weekly" | "monthly" | "quarterly";

interface QuestionDef {
  id: string;
  label: string;
  question_type: QuestionType;
  config: { options?: string[]; min?: number; max?: number; max_size_mb?: number };
  is_required: boolean;
  cadence: Cadence | null;
  page_break_before: boolean;
}

interface FormDef {
  id: string;
  title: string;
  description: string | null;
  requires_login: boolean;
  has_rating_subject: boolean;
}

interface Subject {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
}

interface AnswerState {
  value_text?: string;
  value_number?: number;
  value_options?: string[];
  file?: { file_storage_path: string; file_name: string; file_size: number; file_mime: string | null };
  uploading?: boolean;
}

const CADENCE_LABEL: Record<Exclude<Cadence, "one_time">, string> = {
  weekly: "Weekly", monthly: "Monthly", quarterly: "Quarterly",
};

function hasValue(a: AnswerState | undefined): boolean {
  return !!a && (
    (!!a.value_text && a.value_text.length > 0) ||
    (a.value_number !== undefined && a.value_number !== null) ||
    (!!a.value_options && a.value_options.length > 0) ||
    !!a.file
  );
}

export function FormFillClient({ form, questions }: { form: FormDef; questions: QuestionDef[] }) {
  const [subjects, setSubjects] = useState<Subject[] | null>(null);
  const [subjectId, setSubjectId] = useState<string>("");
  const [cadence, setCadence] = useState<Exclude<Cadence, "one_time"> | null>(null);
  const [answers, setAnswers] = useState<Record<string, AnswerState>>({});
  const [answeredOneTimeThisSession, setAnsweredOneTimeThisSession] = useState<Set<string>>(new Set());
  const [fillerName, setFillerName] = useState("");
  const [fillerEmail, setFillerEmail] = useState("");
  const [fillerPhone, setFillerPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [justSubmitted, setJustSubmitted] = useState(false);
  const [pageIndex, setPageIndex] = useState(0);

  const cadenceTabs = useMemo(
    () => Array.from(new Set(questions.map((q) => q.cadence).filter((c): c is Exclude<Cadence, "one_time"> => c === "weekly" || c === "monthly" || c === "quarterly"))),
    [questions]
  );

  useEffect(() => {
    if (cadenceTabs.length > 0 && !cadence) setCadence(cadenceTabs[0]);
  }, [cadenceTabs, cadence]);

  useEffect(() => {
    if (!form.has_rating_subject) return;
    (async () => {
      const res = await fetch(`/api/forms/${form.id}/subjects`, { credentials: "same-origin" });
      const json = await res.json().catch(() => null);
      if (res.ok) setSubjects(json.data);
    })();
  }, [form.id, form.has_rating_subject]);

  const activeQuestions = useMemo(() => {
    return questions.filter((q) =>
      q.cadence === null ||
      (cadence && q.cadence === cadence) ||
      (q.cadence === "one_time" && !answeredOneTimeThisSession.has(q.id))
    );
  }, [questions, cadence, answeredOneTimeThisSession]);

  // Split into pages wherever a question is marked page_break_before.
  const pages = useMemo(() => {
    const result: QuestionDef[][] = [];
    let current: QuestionDef[] = [];
    for (const q of activeQuestions) {
      if (q.page_break_before && current.length > 0) {
        result.push(current);
        current = [];
      }
      current.push(q);
    }
    result.push(current);
    return result;
  }, [activeQuestions]);

  // Switching cadence tab (or the subject, which changes which one_time
  // questions are still pending) changes the whole active-question set —
  // always start back on page 1 rather than an index that may no longer exist.
  useEffect(() => { setPageIndex(0); }, [cadence, subjectId]);

  const currentPageQuestions = pages[Math.min(pageIndex, pages.length - 1)] ?? [];
  const isLastPage = pageIndex >= pages.length - 1;

  function updateAnswer(questionId: string, patch: Partial<AnswerState>) {
    setAnswers((prev) => ({ ...prev, [questionId]: { ...prev[questionId], ...patch } }));
  }

  async function handleFileChange(question: QuestionDef, file: File | null) {
    if (!file) return;
    updateAnswer(question.id, { uploading: true });
    const fd = new FormData();
    fd.append("question_id", question.id);
    fd.append("file", file);
    const res = await fetch(`/api/forms/${form.id}/upload`, { method: "POST", credentials: "same-origin", body: fd });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(json?.error?.message ?? "Upload failed");
      updateAnswer(question.id, { uploading: false, file: undefined });
      return;
    }
    updateAnswer(question.id, { uploading: false, file: json.data });
  }

  function handleNext() {
    const missing = currentPageQuestions.find((q) => q.is_required && !hasValue(answers[q.id]));
    if (missing) { toast.error(`"${missing.label}" is required`); return; }
    setPageIndex((p) => p + 1);
  }

  async function handleSubmit() {
    if (form.has_rating_subject && !subjectId) { toast.error("Please select who you're rating"); return; }
    if (!form.requires_login && (!fillerName.trim() || !fillerEmail.trim())) {
      toast.error("Name and email are required"); return;
    }
    const missing = currentPageQuestions.find((q) => q.is_required && !hasValue(answers[q.id]));
    if (missing) { toast.error(`"${missing.label}" is required`); return; }
    if (activeQuestions.some((q) => answers[q.id]?.uploading)) { toast.error("Please wait for the upload to finish"); return; }

    setSubmitting(true);
    const res = await fetch(`/api/forms/${form.id}/submit`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subject_user_id: form.has_rating_subject ? subjectId : undefined,
        cadence,
        filler_name: fillerName,
        filler_email: fillerEmail,
        filler_phone: fillerPhone || undefined,
        answers: activeQuestions.map((q) => ({ question_id: q.id, ...answers[q.id] })),
      }),
    });
    const json = await res.json().catch(() => ({}));
    setSubmitting(false);
    if (!res.ok) { toast.error(json?.error?.message ?? "Submit failed"); return; }

    setAnsweredOneTimeThisSession((prev) => {
      const next = new Set(prev);
      for (const q of activeQuestions) if (q.cadence === "one_time") next.add(q.id);
      return next;
    });
    setAnswers({});
    setPageIndex(0);
    setJustSubmitted(true);
    toast.success("Response submitted");
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--page-bg)" }}>
      <header className="h-14 flex items-center px-6 flex-shrink-0" style={{ background: "var(--navy)" }}>
        <span className="text-[18px] font-bold tracking-tight" style={{ color: "#fff", fontFamily: "'Space Grotesk', sans-serif" }}>
          Task<span style={{ color: "var(--accent-brand)" }}>Co</span>
        </span>
        <span className="ml-3 pl-3 text-[12px] font-medium" style={{ color: "rgba(255,255,255,0.5)", borderLeft: "1px solid rgba(255,255,255,0.2)" }}>Form</span>
      </header>

      <div className="flex-1 flex items-start justify-center px-4 py-10 md:py-14">
        <div className="w-full max-w-3xl rounded-xl overflow-hidden" style={{ background: "var(--surface-bg)", boxShadow: "0 1px 8px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.03)" }}>
          <div className="h-1.5" style={{ background: "var(--accent-brand)" }} />
          <div className="p-6 md:p-10">
            <h1 className="text-[22px] font-bold" style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}>{form.title}</h1>
            {form.description && <p className="mt-2 text-[13.5px]" style={{ color: "var(--text-secondary)" }}>{form.description}</p>}

            {justSubmitted ? (
              <div className="mt-8 flex flex-col items-center gap-3 py-6 text-center">
                <CheckCircle2 className="w-10 h-10" style={{ color: "var(--clr-green)" }} />
                <p className="text-[14px] font-semibold" style={{ color: "var(--ink)" }}>Thanks — your response was recorded.</p>
                {form.has_rating_subject && (
                  <button
                    onClick={() => { setJustSubmitted(false); setSubjectId(""); }}
                    className="mt-2 h-9 px-4 rounded-lg text-[13px] font-semibold text-white"
                    style={{ background: "var(--navy)" }}
                  >
                    Rate someone else
                  </button>
                )}
              </div>
            ) : (
              <div className="mt-6 flex flex-col gap-5">
                {pages.length > 1 && (
                  <p className="text-[12px] font-semibold" style={{ color: "var(--text-muted)" }}>Page {pageIndex + 1} of {pages.length}</p>
                )}

                {pageIndex === 0 && !form.requires_login && (
                  <div className="flex flex-col gap-3">
                    <input placeholder="Your name" value={fillerName} onChange={(e) => setFillerName(e.target.value)}
                      className="h-10 px-3 rounded-lg text-[13.5px]" style={{ border: "1px solid var(--line)", background: "var(--page-bg)", color: "var(--ink)" }} />
                    <input placeholder="Your email" type="email" value={fillerEmail} onChange={(e) => setFillerEmail(e.target.value)}
                      className="h-10 px-3 rounded-lg text-[13.5px]" style={{ border: "1px solid var(--line)", background: "var(--page-bg)", color: "var(--ink)" }} />
                    <input placeholder="Your phone (optional)" value={fillerPhone} onChange={(e) => setFillerPhone(e.target.value)}
                      className="h-10 px-3 rounded-lg text-[13.5px]" style={{ border: "1px solid var(--line)", background: "var(--page-bg)", color: "var(--ink)" }} />
                  </div>
                )}

                {pageIndex === 0 && form.has_rating_subject && (
                  <div>
                    <label className="text-[12.5px] font-semibold" style={{ color: "var(--text-muted)" }}>Who are you rating?</label>
                    <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}
                      className="mt-1 w-full h-10 px-3 rounded-lg text-[13.5px]" style={{ border: "1px solid var(--line)", background: "var(--page-bg)", color: "var(--ink)" }}>
                      <option value="">{subjects === null ? "Loading…" : "Select a team member"}</option>
                      {(subjects ?? []).map((s) => <option key={s.id} value={s.id}>{s.full_name ?? "Unnamed"}</option>)}
                    </select>
                  </div>
                )}

                {pageIndex === 0 && cadenceTabs.length > 1 && (
                  <div className="flex gap-2">
                    {cadenceTabs.map((c) => (
                      <button key={c} onClick={() => setCadence(c)}
                        className="h-9 px-4 rounded-lg text-[13px] font-semibold"
                        style={{ background: cadence === c ? "var(--navy)" : "var(--page-bg)", color: cadence === c ? "#fff" : "var(--text-muted)", border: "1px solid var(--line)" }}>
                        {CADENCE_LABEL[c]}
                      </button>
                    ))}
                  </div>
                )}

                {currentPageQuestions.map((q) => (
                  <div key={q.id} className="flex flex-col gap-1.5">
                    <label className="text-[13px] font-semibold" style={{ color: "var(--ink)" }}>
                      {q.label}{q.is_required && <span style={{ color: "var(--clr-red)" }}> *</span>}
                    </label>

                    {q.question_type === "text" && (
                      <input value={answers[q.id]?.value_text ?? ""} onChange={(e) => updateAnswer(q.id, { value_text: e.target.value })}
                        className="h-10 px-3 rounded-lg text-[13.5px]" style={{ border: "1px solid var(--line)", background: "var(--page-bg)", color: "var(--ink)" }} />
                    )}

                    {q.question_type === "long_text" && (
                      <textarea rows={5} value={answers[q.id]?.value_text ?? ""} onChange={(e) => updateAnswer(q.id, { value_text: e.target.value })}
                        className="px-3 py-2 rounded-lg text-[13.5px]" style={{ border: "1px solid var(--line)", background: "var(--page-bg)", color: "var(--ink)" }} />
                    )}

                    {q.question_type === "numeric" && (
                      <input type="number" min={q.config.min} max={q.config.max} value={answers[q.id]?.value_number ?? ""}
                        onChange={(e) => updateAnswer(q.id, { value_number: e.target.value === "" ? undefined : Number(e.target.value) })}
                        className="h-10 px-3 rounded-lg text-[13.5px]" style={{ border: "1px solid var(--line)", background: "var(--page-bg)", color: "var(--ink)" }} />
                    )}

                    {q.question_type === "rating" && (
                      <div className="flex gap-1.5">
                        {Array.from({ length: q.config.max ?? 5 }, (_, i) => i + 1).map((n) => (
                          <button key={n} onClick={() => updateAnswer(q.id, { value_number: n })}
                            className="w-9 h-9 rounded-lg text-[13.5px] font-semibold"
                            style={{ background: answers[q.id]?.value_number === n ? "var(--navy)" : "var(--page-bg)", color: answers[q.id]?.value_number === n ? "#fff" : "var(--text-muted)", border: "1px solid var(--line)" }}>
                            {n}
                          </button>
                        ))}
                      </div>
                    )}

                    {q.question_type === "single_select" && (
                      <select value={answers[q.id]?.value_options?.[0] ?? ""} onChange={(e) => updateAnswer(q.id, { value_options: e.target.value ? [e.target.value] : [] })}
                        className="h-10 px-3 rounded-lg text-[13.5px]" style={{ border: "1px solid var(--line)", background: "var(--page-bg)", color: "var(--ink)" }}>
                        <option value="">Select…</option>
                        {(q.config.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    )}

                    {q.question_type === "multi_select" && (
                      <div className="flex flex-wrap gap-2">
                        {(q.config.options ?? []).map((o) => {
                          const selected = (answers[q.id]?.value_options ?? []).includes(o);
                          return (
                            <button key={o} type="button"
                              onClick={() => {
                                const current = answers[q.id]?.value_options ?? [];
                                updateAnswer(q.id, { value_options: selected ? current.filter((x) => x !== o) : [...current, o] });
                              }}
                              className="h-8 px-3 rounded-lg text-[12.5px] font-medium"
                              style={{ background: selected ? "var(--navy)" : "var(--page-bg)", color: selected ? "#fff" : "var(--text-muted)", border: "1px solid var(--line)" }}>
                              {o}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {q.question_type === "upload" && (
                      <label className="inline-flex items-center gap-2 h-10 px-3 rounded-lg text-[13px] font-medium cursor-pointer w-fit"
                        style={{ border: "1px solid var(--line)", color: "var(--text-secondary)" }}>
                        {answers[q.id]?.uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                        {answers[q.id]?.file?.file_name ?? "Choose file"}
                        <input type="file" className="hidden" onChange={(e) => handleFileChange(q, e.target.files?.[0] ?? null)} />
                      </label>
                    )}
                  </div>
                ))}

                <div className="flex items-center gap-2">
                  {pageIndex > 0 && (
                    <button onClick={() => setPageIndex((p) => p - 1)}
                      className="h-10 px-5 rounded-lg text-[13.5px] font-semibold"
                      style={{ border: "1px solid var(--line)", color: "var(--text-secondary)" }}>
                      Back
                    </button>
                  )}
                  {isLastPage ? (
                    <button onClick={() => void handleSubmit()} disabled={submitting}
                      className="h-10 px-5 rounded-lg text-[13.5px] font-semibold text-white disabled:opacity-60"
                      style={{ background: "var(--navy)" }}>
                      {submitting ? "Submitting…" : "Submit"}
                    </button>
                  ) : (
                    <button onClick={handleNext}
                      className="h-10 px-5 rounded-lg text-[13.5px] font-semibold text-white"
                      style={{ background: "var(--navy)" }}>
                      Next
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
