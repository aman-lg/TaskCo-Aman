import { IST_OFFSET_MS } from "@/lib/constants";

/** Convert a UTC Date or timestamp to the IST Date object */
export function toIST(utc: Date | string | number): Date {
  const ms = typeof utc === "string" ? new Date(utc).getTime() : Number(utc);
  return new Date(ms + IST_OFFSET_MS);
}

/** Return the IST calendar date string (YYYY-MM-DD) for a UTC timestamp */
export function istDateString(utc: Date | string | number): string {
  const d = toIST(utc);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Format a UTC timestamp for display in IST (e.g. "27 Jun 2026, 10:30 AM IST") */
export function formatIST(utc: Date | string | number): string {
  return new Date(utc).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}
