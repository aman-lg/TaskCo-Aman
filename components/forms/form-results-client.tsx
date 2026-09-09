"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Subject { id: string; full_name: string | null }

interface QuestionResult {
  question_id: string;
  label: string;
  cadence: "weekly" | "monthly" | "quarterly";
  weekly: Record<string, number>;
  monthly: Record<string, number>;
  quarterly: number | null;
}

function currentQuarterKey(): string {
  const now = new Date();
  const q = Math.floor(now.getMonth() / 3) + 1;
  return `${now.getFullYear()}-Q${q}`;
}

function shiftQuarter(quarter: string, delta: number): string {
  const [yearStr, qStr] = quarter.split("-Q");
  let year = Number(yearStr);
  let q = Number(qStr) + delta;
  while (q > 4) { q -= 4; year += 1; }
  while (q < 1) { q += 4; year -= 1; }
  return `${year}-Q${q}`;
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

export function FormResultsClient({ formId, subjects }: { formId: string; subjects: Subject[] }) {
  const [subjectId, setSubjectId] = useState(subjects[0]?.id ?? "");
  const [quarter, setQuarter] = useState(currentQuarterKey());
  const [results, setResults] = useState<QuestionResult[] | null>(null);

  const load = useCallback(async (sid: string, q: string) => {
    if (!sid) { setResults([]); return; }
    setResults(null);
    const res = await fetch(`/api/forms/${formId}/results?subject_user_id=${sid}&quarter=${q}`, { credentials: "same-origin" });
    const json = await res.json().catch(() => null);
    if (res.ok) setResults(json.data.questions);
  }, [formId]);

  useEffect(() => { void load(subjectId, quarter); }, [subjectId, quarter, load]);

  if (subjects.length === 0) {
    return <p className="text-[13px] py-8 text-center" style={{ color: "var(--text-fine)" }}>No rated responses yet.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3 flex-wrap">
        <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}
          className="h-9 px-3 rounded-lg text-[13px]" style={{ border: "1px solid var(--line)", background: "var(--surface-bg)", color: "var(--ink)" }}>
          {subjects.map((s) => <option key={s.id} value={s.id}>{s.full_name ?? "Unnamed"}</option>)}
        </select>
        <div className="flex items-center gap-1">
          <button onClick={() => setQuarter((q) => shiftQuarter(q, -1))} className="w-7 h-7 flex items-center justify-center rounded-md" style={{ color: "var(--text-muted)" }}><ChevronLeft className="w-4 h-4" /></button>
          <span className="text-[13px] font-semibold w-16 text-center" style={{ color: "var(--ink)" }}>{quarter}</span>
          <button onClick={() => setQuarter((q) => shiftQuarter(q, 1))} className="w-7 h-7 flex items-center justify-center rounded-md" style={{ color: "var(--text-muted)" }}><ChevronRight className="w-4 h-4" /></button>
        </div>
      </div>

      {results === null ? (
        <p className="text-[13px] py-8 text-center" style={{ color: "var(--text-muted)" }}>Loading…</p>
      ) : results.length === 0 ? (
        <p className="text-[13px] py-8 text-center" style={{ color: "var(--text-fine)" }}>No rating questions with data for this quarter.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {results.map((r) => (
            <div key={r.question_id} className="rounded-xl p-4" style={{ background: "var(--surface-bg)" }}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[13.5px] font-semibold" style={{ color: "var(--ink)" }}>{r.label}</p>
                <span className="text-[18px] font-bold" style={{ color: "var(--navy)" }}>{r.quarterly !== null ? round(r.quarterly) : "—"}</span>
              </div>
              {r.cadence === "weekly" && Object.keys(r.weekly).length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {Object.entries(r.weekly).sort(([a], [b]) => a.localeCompare(b)).map(([wk, v]) => (
                    <span key={wk} className="text-[11.5px] px-2 py-1 rounded-md" style={{ background: "var(--page-bg)", color: "var(--text-muted)" }}>{wk}: {round(v)}</span>
                  ))}
                </div>
              )}
              {Object.keys(r.monthly).length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {Object.entries(r.monthly).sort(([a], [b]) => a.localeCompare(b)).map(([mk, v]) => (
                    <span key={mk} className="text-[11.5px] px-2 py-1 rounded-md font-medium" style={{ background: "var(--navy-l)", color: "var(--navy)" }}>{mk}: {round(v)}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
