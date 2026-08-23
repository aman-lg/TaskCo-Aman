// Minimal iCalendar (RFC 5545) single-VEVENT generator for a booking confirmation
// email attachment. Lets the invitee add the meeting to Outlook/Apple/any
// calendar app, not just Google — no external dependency needed for this.

function toICSDate(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

function escapeICS(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

export interface ICSEventInput {
  uid: string;
  summary: string;
  description?: string;
  location?: string;
  startISO: string;
  endISO: string;
  organizerEmail: string;
  /** One or more invitees. */
  attendeeEmails: string[];
  /** REQUEST for a new/updated invite, CANCEL for a cancellation notice. Defaults to REQUEST. */
  method?: "REQUEST" | "CANCEL";
  /** Bump for each update to the same UID (reschedule, cancel) so calendar apps treat it as a revision, not a duplicate. Defaults to 0. */
  sequence?: number;
}

export function buildICS(opts: ICSEventInput): string {
  const method = opts.method ?? "REQUEST";
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//TaskCo//Booking//EN",
    `METHOD:${method}`,
    "BEGIN:VEVENT",
    `UID:${opts.uid}`,
    `DTSTAMP:${toICSDate(new Date().toISOString())}`,
    `DTSTART:${toICSDate(opts.startISO)}`,
    `DTEND:${toICSDate(opts.endISO)}`,
    `SUMMARY:${escapeICS(opts.summary)}`,
    opts.description ? `DESCRIPTION:${escapeICS(opts.description)}` : null,
    opts.location ? `LOCATION:${escapeICS(opts.location)}` : null,
    `ORGANIZER:mailto:${opts.organizerEmail}`,
    ...opts.attendeeEmails.map((email) => `ATTENDEE;RSVP=TRUE:mailto:${email}`),
    `STATUS:${method === "CANCEL" ? "CANCELLED" : "CONFIRMED"}`,
    `SEQUENCE:${opts.sequence ?? 0}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter((line): line is string => line !== null);
  return lines.join("\r\n");
}
