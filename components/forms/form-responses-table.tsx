"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Download } from "lucide-react";
import { toast } from "sonner";

interface Answer {
  id: string;
  question_id: string;
  value_text: string | null;
  value_number: number | null;
  value_options: string[] | null;
  file_name: string | null;
  question: { label: string; question_type: string } | null;
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

function answerDisplay(a: Answer): string {
  if (a.value_text) return a.value_text;
  if (a.value_number !== null) return String(a.value_number);
  if (a.value_options && a.value_options.length > 0) return a.value_options.join(", ");
  if (a.file_name) return a.file_name;
  return "—";
}

export function FormResponsesTable({ formId }: { formId: string }) {
  const [responses, setResponses] = useState<ResponseRow[] | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/forms/${formId}/responses`, { credentials: "same-origin" });
      const json = await res.json().catch(() => null);
      if (res.ok) setResponses(json.data);
    })();
  }, [formId]);

  async function downloadFile(answerId: string) {
    const res = await fetch(`/api/forms/${formId}/response-files/${answerId}`, { credentials: "same-origin" });
    const json = await res.json().catch(() => null);
    if (!res.ok) { toast.error("Couldn't get file"); return; }
    window.open(json.data.url, "_blank");
  }

  if (responses === null) return <p className="text-[13px] py-8 text-center" style={{ color: "var(--text-muted)" }}>Loading…</p>;
  if (responses.length === 0) return <p className="text-[13px] py-8 text-center" style={{ color: "var(--text-fine)" }}>No responses yet.</p>;

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: "var(--surface-bg)" }}>
      <ul>
        {responses.map((r) => (
          <li key={r.id} className="border-t first:border-t-0" style={{ borderColor: "var(--line)" }}>
            <button onClick={() => setExpanded(expanded === r.id ? null : r.id)} className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left flex-wrap">
              <span className="flex items-center gap-2 min-w-0">
                {expanded === r.id ? <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" />}
                <span className="text-[13px] font-medium truncate" style={{ color: "var(--ink)" }}>
                  {r.subject_name ? `${r.filler_name} → ${r.subject_name}` : r.filler_name}
                </span>
              </span>
              <span className="text-[11.5px]" style={{ color: "var(--text-muted)" }}>
                {r.cadence ? `${r.cadence} · ${r.period_key}` : new Date(r.submitted_at).toLocaleString()}
              </span>
            </button>
            {expanded === r.id && (
              <div className="px-4 pb-3 pl-9 flex flex-col gap-2">
                <p className="text-[11.5px]" style={{ color: "var(--text-muted)" }}>{r.filler_email}{r.filler_phone ? ` · ${r.filler_phone}` : ""}</p>
                {r.answers.map((a) => (
                  <div key={a.id} className="text-[12.5px]" style={{ color: "var(--text-secondary)" }}>
                    <span className="font-semibold" style={{ color: "var(--ink)" }}>{a.question?.label ?? "Question"}: </span>
                    {a.question?.question_type === "upload" && a.file_name ? (
                      <button onClick={() => void downloadFile(a.id)} className="inline-flex items-center gap-1 underline" style={{ color: "var(--navy)" }}>
                        <Download className="w-3 h-3" /> {a.file_name}
                      </button>
                    ) : answerDisplay(a)}
                  </div>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
