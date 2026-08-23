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
  attendeeEmail: string;
}

export function buildICS(opts: ICSEventInput): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//TaskCo//Booking//EN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${opts.uid}`,
    `DTSTAMP:${toICSDate(new Date().toISOString())}`,
    `DTSTART:${toICSDate(opts.startISO)}`,
    `DTEND:${toICSDate(opts.endISO)}`,
    `SUMMARY:${escapeICS(opts.summary)}`,
    opts.description ? `DESCRIPTION:${escapeICS(opts.description)}` : null,
    opts.location ? `LOCATION:${escapeICS(opts.location)}` : null,
    `ORGANIZER:mailto:${opts.organizerEmail}`,
    `ATTENDEE;RSVP=TRUE:mailto:${opts.attendeeEmail}`,
    "STATUS:CONFIRMED",
    "SEQUENCE:0",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter((line): line is string => line !== null);
  return lines.join("\r\n");
}
