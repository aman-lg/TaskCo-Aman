import { istDateString } from "@/lib/utils/dates-ist";

// Server-computed period buckets for form-response rollups — never trust a
// client-sent period, same principle as worklog's server-computed ist_date.
// All math is done on the IST calendar date (floating UTC-midnight Date, no
// further timezone concerns once we have y/m/d) so week/month/quarter
// boundaries match how the rest of the app already reasons about "today."

function istCalendarDate(now: Date): Date {
  const [y, m, d] = istDateString(now).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

// Standard ISO 8601 week algorithm (Monday-based, week 1 contains Jan 4).
function isoWeek(date: Date): { year: number; week: number } {
  const d = new Date(date.getTime());
  const dayNum = (d.getUTCDay() + 6) % 7; // Mon=0..Sun=6
  d.setUTCDate(d.getUTCDate() - dayNum + 3); // Thursday of this ISO week
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
  const week = 1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * 86400000));
  return { year: d.getUTCFullYear(), week };
}

function mondayOfISOWeek(isoYear: number, week: number): Date {
  const jan4 = new Date(Date.UTC(isoYear, 0, 4));
  const jan4DayNum = (jan4.getUTCDay() + 6) % 7;
  const week1Monday = new Date(jan4.getTime() - jan4DayNum * 86400000);
  return new Date(week1Monday.getTime() + (week - 1) * 7 * 86400000);
}

export function computePeriodKey(cadence: "weekly" | "monthly" | "quarterly", now: Date = new Date()): string {
  const cal = istCalendarDate(now);
  if (cadence === "weekly") {
    const { year, week } = isoWeek(cal);
    return `${year}-W${String(week).padStart(2, "0")}`;
  }
  if (cadence === "monthly") {
    return `${cal.getUTCFullYear()}-${String(cal.getUTCMonth() + 1).padStart(2, "0")}`;
  }
  const quarter = Math.floor(cal.getUTCMonth() / 3) + 1;
  return `${cal.getUTCFullYear()}-Q${quarter}`;
}

// Which month bucket a weekly period_key belongs to, for weekly -> monthly
// rollups. A week can span two months at the boundary — assigned here by
// the month of that week's Monday (an accepted simplification, not a
// business-precision requirement).
export function monthKeyForWeekKey(weekKey: string): string {
  const [yearStr, weekStr] = weekKey.split("-W");
  const monday = mondayOfISOWeek(Number(yearStr), Number(weekStr));
  return `${monday.getUTCFullYear()}-${String(monday.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function quarterKeyForMonthKey(monthKey: string): string {
  const [yearStr, monthStr] = monthKey.split("-");
  const quarter = Math.floor((Number(monthStr) - 1) / 3) + 1;
  return `${yearStr}-Q${quarter}`;
}

export function quarterKeyForWeekKey(weekKey: string): string {
  return quarterKeyForMonthKey(monthKeyForWeekKey(weekKey));
}

// The 3 month keys ("YYYY-MM") that make up a quarter key ("YYYY-Q#").
export function monthKeysInQuarter(quarterKey: string): string[] {
  const [yearStr, qStr] = quarterKey.split("-Q");
  const firstMonth = (Number(qStr) - 1) * 3 + 1;
  return [0, 1, 2].map((i) => `${yearStr}-${String(firstMonth + i).padStart(2, "0")}`);
}
