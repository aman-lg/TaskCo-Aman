"use client";

import { useCallback, useEffect, useState } from "react";
import { Home, Building2, CalendarOff, CalendarClock, ChevronDown, ChevronRight, ChevronLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { WorklogPresenceType } from "@/lib/validations/worklog";

interface WorklogEntry {
  id: string;
  ist_date: string;
  presence_type: WorklogPresenceType;
  notes: string | null;
}

interface ActivitySummaryItem {
  id: string;
  entityType: string;
  title: string;
  from: string | null;
  to: string | null;
  at: string;
}

const PRESENCE_META: Record<WorklogPresenceType, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
  wfh: { label: "Work from Home", icon: <Home className="w-3.5 h-3.5" />, color: "var(--navy)", bg: "var(--navy-l)" },
  wfo: { label: "Work from Office", icon: <Building2 className="w-3.5 h-3.5" />, color: "var(--clr-green)", bg: "var(--clr-green-bg)" },
  leave_full: { label: "On Leave — Full Day", icon: <CalendarOff className="w-3.5 h-3.5" />, color: "var(--clr-red)", bg: "var(--clr-red-bg)" },
  leave_half: { label: "On Leave — Half Day", icon: <CalendarClock className="w-3.5 h-3.5" />, color: "var(--clr-amber)", bg: "var(--clr-amber-bg)" },
};

function todayISTDate(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

function PresenceBadge({ type }: { type: WorklogPresenceType }) {
  const meta = PRESENCE_META[type];
  return (
    <span
      className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[12px] font-semibold"
      style={{ color: meta.color, background: meta.bg }}
    >
      {meta.icon} {meta.label}
    </span>
  );
}

function ActivitySummaryList({ date, userId }: { date: string; userId?: string }) {
  const [items, setItems] = useState<ActivitySummaryItem[] | null>(null);

  useEffect(() => {
    (async () => {
      const params = new URLSearchParams({ date, ...(userId ? { user_id: userId } : {}) });
      const res = await fetch(`/api/worklog/activity-summary?${params}`, { credentials: "same-origin" });
      const json = await res.json().catch(() => null);
      if (res.ok) setItems(json.data.summary);
    })();
  }, [date, userId]);

  if (items === null) return <p className="text-[12.5px] py-2" style={{ color: "var(--text-fine)" }}>Loading…</p>;
  if (items.length === 0) return <p className="text-[12.5px] py-2" style={{ color: "var(--text-fine)" }}>No task activity recorded for this day.</p>;

  return (
    <ul className="flex flex-col gap-1.5 py-2">
      {items.map((it) => (
        <li key={it.id} className="text-[12.5px]" style={{ color: "var(--text-secondary)" }}>
          Moved <span className="font-semibold" style={{ color: "var(--ink)" }}>{it.title}</span> from{" "}
          <span className="font-semibold">{it.from ?? "—"}</span> to <span className="font-semibold">{it.to ?? "—"}</span>
        </li>
      ))}
    </ul>
  );
}

export function WorklogPageClient() {
  const today = todayISTDate();
  const [todayEntry, setTodayEntry] = useState<WorklogEntry | null | undefined>(undefined);
  const [marking, setMarking] = useState<WorklogPresenceType | null>(null);
  const [month, setMonth] = useState(today.slice(0, 7));
  const [entries, setEntries] = useState<WorklogEntry[] | null>(null);
  const [expandedDate, setExpandedDate] = useState<string | null>(null);

  const loadToday = useCallback(async () => {
    const res = await fetch("/api/worklog/today", { credentials: "same-origin" });
    const json = await res.json().catch(() => null);
    if (res.ok) setTodayEntry(json.data.entry);
  }, []);

  const loadMonth = useCallback(async (m: string) => {
    setEntries(null);
    const res = await fetch(`/api/worklog/mine?month=${m}`, { credentials: "same-origin" });
    const json = await res.json().catch(() => null);
    if (res.ok) setEntries(json.data.entries);
  }, []);

  useEffect(() => { void loadToday(); }, [loadToday]);
  useEffect(() => { void loadMonth(month); }, [month, loadMonth]);

  async function markToday(type: WorklogPresenceType) {
    setMarking(type);
    const res = await fetch("/api/worklog/mark", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ presence_type: type }),
    });
    setMarking(null);
    if (!res.ok) { toast.error("Couldn't save — try again"); return; }
    toast.success("Saved");
    await loadToday();
    await loadMonth(month);
  }

  function shiftMonth(delta: number) {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(Date.UTC(y, m - 1 + delta, 1));
    setMonth(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Today */}
      <div className="rounded-xl p-5" style={{ background: "var(--surface-bg)" }}>
        <p className="text-[13px] font-bold uppercase tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>Today</p>
        {todayEntry === undefined ? (
          <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>Loading…</p>
        ) : todayEntry ? (
          <div className="flex flex-col gap-3">
            <PresenceBadge type={todayEntry.presence_type} />
            <ActivitySummaryList date={today} />
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {(Object.keys(PRESENCE_META) as WorklogPresenceType[]).map((type) => (
              <button
                key={type}
                onClick={() => void markToday(type)}
                disabled={marking !== null}
                className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-[13px] font-semibold disabled:opacity-60"
                style={{ background: "var(--navy)", color: "#fff" }}
              >
                {marking === type ? <Loader2 className="w-4 h-4 animate-spin" /> : PRESENCE_META[type].icon}
                {PRESENCE_META[type].label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* History */}
      <div className="rounded-xl p-5" style={{ background: "var(--surface-bg)" }}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-[13px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>History</p>
          <div className="flex items-center gap-1">
            <button onClick={() => shiftMonth(-1)} className="w-7 h-7 flex items-center justify-center rounded-md" style={{ color: "var(--text-muted)" }}>
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-[13px] font-semibold w-24 text-center" style={{ color: "var(--ink)" }}>
              {new Date(`${month}-01T00:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })}
            </span>
            <button onClick={() => shiftMonth(1)} className="w-7 h-7 flex items-center justify-center rounded-md" style={{ color: "var(--text-muted)" }}>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {entries === null ? (
          <p className="text-[13px] py-4 text-center" style={{ color: "var(--text-muted)" }}>Loading…</p>
        ) : entries.length === 0 ? (
          <p className="text-[13px] py-4 text-center" style={{ color: "var(--text-fine)" }}>No entries this month.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {entries.map((e) => (
              <li key={e.id} className="border-t first:border-t-0" style={{ borderColor: "var(--line)" }}>
                <button
                  onClick={() => setExpandedDate(expandedDate === e.ist_date ? null : e.ist_date)}
                  className="w-full flex items-center justify-between gap-3 py-2.5 text-left"
                >
                  <span className="flex items-center gap-2">
                    {expandedDate === e.ist_date ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    <span className="text-[13px] font-medium" style={{ color: "var(--ink)" }}>
                      {new Date(`${e.ist_date}T00:00:00Z`).toLocaleDateString("en-US", { weekday: "short", day: "2-digit", month: "short", timeZone: "UTC" })}
                    </span>
                  </span>
                  <PresenceBadge type={e.presence_type} />
                </button>
                {expandedDate === e.ist_date && (
                  <div className="pl-5 pb-2">
                    {e.notes && <p className="text-[12.5px] mb-1.5 italic" style={{ color: "var(--text-secondary)" }}>&ldquo;{e.notes}&rdquo;</p>}
                    <ActivitySummaryList date={e.ist_date} />
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
