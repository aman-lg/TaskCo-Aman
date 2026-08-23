"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface CalendarBooking {
  start_at: string;
  status: string;
}

interface Props {
  bookings: CalendarBooking[];
  onDayClick: (dateStr: string) => void;
}

const DAYS_SHORT = ["S", "M", "T", "W", "T", "F", "S"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function istDateKey(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

export function MonthCalendar({ bookings, onDayClick }: Props) {
  const today = new Date();
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));

  const year = month.getFullYear();
  const m = month.getMonth();
  const firstDayOfWeek = new Date(year, m, 1).getDay();
  const daysInMonth = new Date(year, m + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const dateMap = new Map<string, number>();
  for (const b of bookings) {
    if (b.status !== "confirmed" && b.status !== "pending") continue;
    const key = istDateKey(b.start_at);
    dateMap.set(key, (dateMap.get(key) ?? 0) + 1);
  }
  const todayStr = today.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

  return (
    <div
      className="rounded-xl p-5 flex flex-col gap-3"
      style={{ background: "var(--surface-bg)", boxShadow: "0 1px 8px rgba(0,0,0,0.07), 0 0 0 1px rgba(0,0,0,0.04)" }}
    >
      <div className="flex items-center justify-between">
        <span className="text-[14px] font-bold" style={{ color: "var(--ink)" }}>{MONTHS[m]} {year}</span>
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => setMonth(new Date(year, m - 1, 1))}
            className="p-1.5 rounded-lg transition-colors hover:bg-[var(--line-soft)]"
            style={{ color: "var(--text-muted)" }}
            aria-label="Previous month"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setMonth(new Date(today.getFullYear(), today.getMonth(), 1))}
            className="px-2 h-6 rounded text-[11px] font-semibold transition-colors hover:bg-[var(--line-soft)]"
            style={{ color: "var(--navy)" }}
          >
            Today
          </button>
          <button
            onClick={() => setMonth(new Date(year, m + 1, 1))}
            className="p-1.5 rounded-lg transition-colors hover:bg-[var(--line-soft)]"
            style={{ color: "var(--text-muted)" }}
            aria-label="Next month"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7">
        {DAYS_SHORT.map((d, i) => (
          <div key={i} className="text-center text-[11px] font-bold py-1" style={{ color: "var(--text-muted)" }}>{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-y-1">
        {cells.map((day, i) => {
          if (!day) return <div key={`e-${i}`} />;
          const ds = `${year}-${String(m + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const count = dateMap.get(ds) ?? 0;
          const isToday = ds === todayStr;
          return (
            <button
              key={ds}
              onClick={() => onDayClick(ds)}
              className="relative h-11 w-full rounded-lg text-[13px] font-medium flex flex-col items-center justify-center transition-colors"
              style={isToday ? { background: "var(--navy)", color: "#fff" } : { color: "var(--ink)" }}
              onMouseEnter={(e) => { if (!isToday) (e.currentTarget as HTMLElement).style.background = "var(--panel-bg)"; }}
              onMouseLeave={(e) => { if (!isToday) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
            >
              {day}
              {count > 0 && (
                <span
                  className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                  style={{ background: isToday ? "rgba(255,255,255,0.8)" : "var(--navy)" }}
                />
              )}
            </button>
          );
        })}
      </div>
      <p className="text-[11px] text-center pt-1" style={{ color: "var(--text-muted)" }}>Click a day to schedule a call</p>
    </div>
  );
}
