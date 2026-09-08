"use client";

import { useState } from "react";
import { Home, Building2, CalendarOff, CalendarClock, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useWorklogPrompt } from "@/lib/hooks/use-worklog-prompt";
import type { WorklogPresenceType } from "@/lib/validations/worklog";

const OPTIONS: Array<{ value: WorklogPresenceType; label: string; icon: React.ReactNode }> = [
  { value: "wfh", label: "Work from Home", icon: <Home className="w-4 h-4" /> },
  { value: "wfo", label: "Work from Office", icon: <Building2 className="w-4 h-4" /> },
  { value: "leave_full", label: "On Leave — Full Day", icon: <CalendarOff className="w-4 h-4" /> },
  { value: "leave_half", label: "On Leave — Half Day", icon: <CalendarClock className="w-4 h-4" /> },
];

export function WorklogPromptBanner() {
  const { show, dismiss, mark } = useWorklogPrompt();
  const [submitting, setSubmitting] = useState<WorklogPresenceType | null>(null);

  if (!show) return null;

  async function handleMark(value: WorklogPresenceType) {
    setSubmitting(value);
    const okRes = await mark(value);
    setSubmitting(null);
    if (!okRes) toast.error("Couldn't save — try again");
  }

  return (
    <div
      className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3 md:px-10"
      style={{ background: "var(--navy-l)", borderBottom: "1px solid var(--line)" }}
    >
      <p className="text-[13px] font-semibold whitespace-nowrap" style={{ color: "var(--ink)" }}>
        Today, are you —
      </p>
      <div className="flex-1 flex items-center gap-2 overflow-x-auto">
        {OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => void handleMark(opt.value)}
            disabled={submitting !== null}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12.5px] font-semibold whitespace-nowrap disabled:opacity-60"
            style={{ background: "var(--surface-bg)", color: "var(--navy)", border: "1px solid var(--line)" }}
          >
            {submitting === opt.value ? <Loader2 className="w-4 h-4 animate-spin" /> : opt.icon}
            {opt.label}
          </button>
        ))}
      </div>
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        className="inline-flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0"
        style={{ color: "var(--text-muted)" }}
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
