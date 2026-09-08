"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { WorklogPresenceType } from "@/lib/validations/worklog";

interface Person {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  email: string | null;
  presence_type: WorklogPresenceType | null;
  notes: string | null;
}

interface ActivitySummaryItem {
  id: string;
  title: string;
  from: string | null;
  to: string | null;
}

const PRESENCE_LABEL: Record<WorklogPresenceType, { label: string; color: string; bg: string }> = {
  wfh: { label: "Work from Home", color: "var(--navy)", bg: "var(--navy-l)" },
  wfo: { label: "Work from Office", color: "var(--clr-green)", bg: "var(--clr-green-bg)" },
  leave_full: { label: "On Leave — Full Day", color: "var(--clr-red)", bg: "var(--clr-red-bg)" },
  leave_half: { label: "On Leave — Half Day", color: "var(--clr-amber)", bg: "var(--clr-amber-bg)" },
};

function todayISTDate(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

function ActivityRow({ userId, date }: { userId: string; date: string }) {
  const [items, setItems] = useState<ActivitySummaryItem[] | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/worklog/activity-summary?date=${date}&user_id=${userId}`, { credentials: "same-origin" });
      const json = await res.json().catch(() => null);
      if (res.ok) setItems(json.data.summary);
    })();
  }, [userId, date]);

  if (items === null) return <p className="text-[12px] py-2 pl-7" style={{ color: "var(--text-fine)" }}>Loading…</p>;
  if (items.length === 0) return <p className="text-[12px] py-2 pl-7" style={{ color: "var(--text-fine)" }}>No task activity recorded.</p>;

  return (
    <ul className="flex flex-col gap-1 py-2 pl-7">
      {items.map((it) => (
        <li key={it.id} className="text-[12px]" style={{ color: "var(--text-secondary)" }}>
          {it.title}: {it.from ?? "—"} → {it.to ?? "—"}
        </li>
      ))}
    </ul>
  );
}

export function AdminWorklogClient() {
  const [date, setDate] = useState(todayISTDate());
  const [people, setPeople] = useState<Person[] | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async (d: string) => {
    setPeople(null);
    const res = await fetch(`/api/worklog/team?date=${d}`, { credentials: "same-origin" });
    const json = await res.json().catch(() => null);
    if (res.ok) setPeople(json.data.people);
  }, []);

  useEffect(() => { void load(date); }, [date, load]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <label className="text-[13px] font-semibold" style={{ color: "var(--text-secondary)" }}>Date</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="h-9 px-3 rounded-lg text-[13px]"
          style={{ background: "var(--surface-bg)", border: "1px solid var(--line)", color: "var(--ink)" }}
        />
      </div>

      <div className="rounded-xl overflow-hidden" style={{ background: "var(--surface-bg)" }}>
        {people === null ? (
          <p className="text-[13px] py-8 text-center" style={{ color: "var(--text-muted)" }}>Loading…</p>
        ) : people.length === 0 ? (
          <p className="text-[13px] py-8 text-center" style={{ color: "var(--text-fine)" }}>No one in the org chart yet.</p>
        ) : (
          <ul>
            {people.map((p) => (
              <li key={p.user_id} className="border-t first:border-t-0" style={{ borderColor: "var(--line)" }}>
                <button
                  onClick={() => setExpanded(expanded === p.user_id ? null : p.user_id)}
                  className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
                >
                  <span className="flex items-center gap-2 min-w-0">
                    {expanded === p.user_id ? <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" />}
                    <span className="text-[13px] font-medium truncate" style={{ color: "var(--ink)" }}>{p.full_name ?? p.email ?? "Unknown"}</span>
                  </span>
                  {p.presence_type ? (
                    <span
                      className="inline-flex items-center h-7 px-2.5 rounded-md text-[12px] font-semibold flex-shrink-0"
                      style={{ color: PRESENCE_LABEL[p.presence_type].color, background: PRESENCE_LABEL[p.presence_type].bg }}
                    >
                      {PRESENCE_LABEL[p.presence_type].label}
                    </span>
                  ) : (
                    <span className="text-[12px] font-medium flex-shrink-0" style={{ color: "var(--text-fine)" }}>Not marked</span>
                  )}
                </button>
                {expanded === p.user_id && (
                  <div className="pb-1">
                    {p.notes && <p className="text-[12px] pl-7 pb-1 italic" style={{ color: "var(--text-secondary)" }}>&ldquo;{p.notes}&rdquo;</p>}
                    <ActivityRow userId={p.user_id} date={date} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
