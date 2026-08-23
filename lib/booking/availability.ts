// Pure slot-generation logic for the public booking page. Hardcoded defaults —
// IST business hours, Mon–Fri, 30-minute slots, next 14 days, 2-hour minimum
// notice. No settings UI yet; adjust the constants below if that's ever needed.

export interface Slot {
  startISO: string;
  endISO: string;
}

export interface BusyInterval {
  start: string;
  end: string;
}

const WORK_START_HOUR = 9;
const WORK_END_HOUR = 18;
const SLOT_MINUTES = 30;
const DAYS_AHEAD = 14;
const MIN_NOTICE_MS = 2 * 60 * 60 * 1000; // don't offer slots starting within the next 2 hours
const WORKING_WEEKDAYS = new Set([1, 2, 3, 4, 5]); // Mon–Fri
const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000; // IST is a fixed UTC+5:30, no DST

function istDateTimeToUTC(dateStr: string, hour: number, minute: number): Date {
  const utcMs =
    Date.UTC(
      Number(dateStr.slice(0, 4)),
      Number(dateStr.slice(5, 7)) - 1,
      Number(dateStr.slice(8, 10)),
      hour,
      minute,
      0
    ) - IST_OFFSET_MS;
  return new Date(utcMs);
}

export function generateCandidateSlots(now: Date = new Date()): Slot[] {
  const slots: Slot[] = [];
  const earliestStart = now.getTime() + MIN_NOTICE_MS;

  for (let dayOffset = 0; dayOffset < DAYS_AHEAD; dayOffset++) {
    const day = new Date(now.getTime() + dayOffset * 86_400_000);
    const dateStr = day.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }); // "YYYY-MM-DD"
    const weekday = new Date(`${dateStr}T00:00:00Z`).getUTCDay();
    if (!WORKING_WEEKDAYS.has(weekday)) continue;

    for (let minutes = WORK_START_HOUR * 60; minutes < WORK_END_HOUR * 60; minutes += SLOT_MINUTES) {
      const start = istDateTimeToUTC(dateStr, Math.floor(minutes / 60), minutes % 60);
      if (start.getTime() < earliestStart) continue;
      const end = new Date(start.getTime() + SLOT_MINUTES * 60_000);
      slots.push({ startISO: start.toISOString(), endISO: end.toISOString() });
    }
  }
  return slots;
}

export function filterAvailableSlots(candidates: Slot[], busy: BusyInterval[]): Slot[] {
  return candidates.filter((slot) => {
    const slotStart = new Date(slot.startISO).getTime();
    const slotEnd = new Date(slot.endISO).getTime();
    return !busy.some((b) => {
      const busyStart = new Date(b.start).getTime();
      const busyEnd = new Date(b.end).getTime();
      return slotStart < busyEnd && slotEnd > busyStart; // overlap test
    });
  });
}
