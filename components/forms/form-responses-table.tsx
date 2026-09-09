"use client";

import { useEffect, useMemo, useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";

interface QuestionCol {
  id: string;
  label: string;
  question_type: string;
  position: number;
}

interface Answer {
  id: string;
  question_id: string;
  value_text: string | null;
  value_number: number | null;
  value_options: string[] | null;
  file_name: string | null;
}

interface ResponseRow {
  id: string;
  subject_user_id: string | null;
  subject_name: string | null;
  cadence: string | null;
  period_key: string | null;
  filler_name: string;
  filler_email: string;
  filler_phone: string | null;
  submitted_at: string;
  answers: Answer[];
}

const CADENCE_LABEL: Record<string, string> = {
  one_time: "One-time", weekly: "Weekly", monthly: "Monthly", quarterly: "Quarterly",
};

function answerDisplay(a: Answer | undefined): string {
  if (!a) return "—";
  if (a.value_text) return a.value_text;
  if (a.value_number !== null) return String(a.value_number);
  if (a.value_options && a.value_options.length > 0) return a.value_options.join(", ");
  if (a.file_name) return a.file_name;
  return "—";
}

export function FormResponsesTable({ formId }: { formId: string }) {
  const [questions, setQuestions] = useState<QuestionCol[] | null>(null);
  const [responses, setResponses] = useState<ResponseRow[] | null>(null);

  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("");
  const [cadenceFilter, setCadenceFilter] = useState("");

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/forms/${formId}/responses`, { credentials: "same-origin" });
      const json = await res.json().catch(() => null);
      if (res.ok) { setQuestions(json.data.questions); setResponses(json.data.responses); }
    })();
  }, [formId]);

  const subjectOptions = useMemo(
    () => Array.from(new Set((responses ?? []).map((r) => r.subject_name).filter((n): n is string => !!n))).sort(),
    [responses]
  );
  const cadenceOptions = useMemo(
    () => Array.from(new Set((responses ?? []).map((r) => r.cadence).filter((c): c is string => !!c))),
    [responses]
  );

  const filtered = useMemo(() => {
    if (!responses) return null;
    const searchLower = search.trim().toLowerCase();
    return responses.filter((r) => {
      if (subjectFilter && r.subject_name !== subjectFilter) return false;
      if (cadenceFilter && r.cadence !== cadenceFilter) return false;
      if (dateFrom && r.submitted_at.slice(0, 10) < dateFrom) return false;
      if (dateTo && r.submitted_at.slice(0, 10) > dateTo) return false;
      if (searchLower) {
        const haystack = [
          r.filler_name, r.filler_email, r.subject_name ?? "",
          ...r.answers.map((a) => answerDisplay(a)),
        ].join(" ").toLowerCase();
        if (!haystack.includes(searchLower)) return false;
      }
      return true;
    });
  }, [responses, search, subjectFilter, cadenceFilter, dateFrom, dateTo]);

  async function downloadFile(answerId: string) {
    const res = await fetch(`/api/forms/${formId}/response-files/${answerId}`, { credentials: "same-origin" });
    const json = await res.json().catch(() => null);
    if (!res.ok) { toast.error("Couldn't get file"); return; }
    window.open(json.data.url, "_blank");
  }

  if (responses === null || questions === null) return <p className="text-[13px] py-8 text-center" style={{ color: "var(--text-muted)" }}>Loading…</p>;
  if (responses.length === 0) return <p className="text-[13px] py-8 text-center" style={{ color: "var(--text-fine)" }}>No responses yet.</p>;

  const inputStyle = { border: "1px solid var(--line)", background: "var(--surface-bg)", color: "var(--ink)" } as const;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <input placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)}
          className="h-9 px-3 rounded-lg text-[13px] w-48" style={inputStyle} />
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
          className="h-9 px-3 rounded-lg text-[13px]" style={inputStyle} title="From date" />
        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
          className="h-9 px-3 rounded-lg text-[13px]" style={inputStyle} title="To date" />
        {subjectOptions.length > 0 && (
          <select value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)} className="h-9 px-3 rounded-lg text-[13px]" style={inputStyle}>
            <option value="">All subjects</option>
            {subjectOptions.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        )}
        {cadenceOptions.length > 0 && (
          <select value={cadenceFilter} onChange={(e) => setCadenceFilter(e.target.value)} className="h-9 px-3 rounded-lg text-[13px]" style={inputStyle}>
            <option value="">All cadences</option>
            {cadenceOptions.map((c) => <option key={c} value={c}>{CADENCE_LABEL[c] ?? c}</option>)}
          </select>
        )}
        <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>{filtered?.length ?? 0} of {responses.length}</span>
      </div>

      <div className="rounded-xl overflow-hidden" style={{ background: "var(--surface-bg)" }}>
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px]" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--line)" }}>
                <th className="text-left px-3 py-2 font-semibold whitespace-nowrap" style={{ color: "var(--text-muted)" }}>Submitted</th>
                <th className="text-left px-3 py-2 font-semibold whitespace-nowrap" style={{ color: "var(--text-muted)" }}>Filler</th>
                {subjectOptions.length > 0 && <th className="text-left px-3 py-2 font-semibold whitespace-nowrap" style={{ color: "var(--text-muted)" }}>Subject</th>}
                {cadenceOptions.length > 0 && <th className="text-left px-3 py-2 font-semibold whitespace-nowrap" style={{ color: "var(--text-muted)" }}>Period</th>}
                {questions.map((q) => (
                  <th key={q.id} className="text-left px-3 py-2 font-semibold whitespace-nowrap" style={{ color: "var(--text-muted)" }}>{q.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(filtered ?? []).map((r) => {
                const answerByQuestion = new Map(r.answers.map((a) => [a.question_id, a]));
                return (
                  <tr key={r.id} style={{ borderBottom: "1px solid var(--line)" }}>
                    <td className="px-3 py-2 whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>{new Date(r.submitted_at).toLocaleString()}</td>
                    <td className="px-3 py-2 whitespace-nowrap" style={{ color: "var(--ink)" }}>
                      {r.filler_name}
                      <div className="text-[11px]" style={{ color: "var(--text-fine)" }}>{r.filler_email}</div>
                    </td>
                    {subjectOptions.length > 0 && <td className="px-3 py-2 whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>{r.subject_name ?? "—"}</td>}
                    {cadenceOptions.length > 0 && (
                      <td className="px-3 py-2 whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>
                        {r.cadence ? `${CADENCE_LABEL[r.cadence] ?? r.cadence} · ${r.period_key}` : "—"}
                      </td>
                    )}
                    {questions.map((q) => {
                      const a = answerByQuestion.get(q.id);
                      return (
                        <td key={q.id} className="px-3 py-2 max-w-[240px] truncate" style={{ color: "var(--text-secondary)" }} title={answerDisplay(a)}>
                          {q.question_type === "upload" && a?.file_name ? (
                            <button onClick={() => void downloadFile(a.id)} className="inline-flex items-center gap-1 underline" style={{ color: "var(--navy)" }}>
                              <Download className="w-3 h-3" /> {a.file_name}
                            </button>
                          ) : answerDisplay(a)}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
