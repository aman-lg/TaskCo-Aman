// SERVER ONLY — never import from "use client" files.
// Thin wrapper over Google's OAuth2 + Calendar v3 REST APIs. We only need
// token exchange/refresh, a freeBusy query, and event creation with a Meet
// link, so this avoids pulling in the full `googleapis` SDK.

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const CALENDAR_API = "https://www.googleapis.com/calendar/v3";

// calendar.events would be enough to create events, but freeBusy.query requires
// the broader calendar (or calendar.readonly) scope — one scope covers both.
// userinfo.email is also requested so we can show which Google account is
// connected (getGoogleUserEmail below) — without it that call 403s.
export const GOOGLE_CALENDAR_SCOPE =
  "https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/userinfo.email";

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

export function getGoogleAuthUrl(state: string, redirectUri: string) {
  const params = new URLSearchParams({
    client_id: requireEnv("GOOGLE_CLIENT_ID"),
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GOOGLE_CALENDAR_SCOPE,
    access_type: "offline",
    prompt: "consent", // forces Google to always return a refresh_token, even on re-connect
    state,
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export async function exchangeCodeForTokens(code: string, redirectUri: string): Promise<TokenResponse> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: requireEnv("GOOGLE_CLIENT_ID"),
      client_secret: requireEnv("GOOGLE_CLIENT_SECRET"),
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`Google token exchange failed (${res.status}): ${await res.text()}`);
  return res.json();
}

export async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: requireEnv("GOOGLE_CLIENT_ID"),
      client_secret: requireEnv("GOOGLE_CLIENT_SECRET"),
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Google token refresh failed (${res.status}): ${await res.text()}`);
  return res.json();
}

export async function getGoogleUserEmail(accessToken: string): Promise<string | null> {
  const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const json = await res.json();
  return json.email ?? null;
}

export interface BusyInterval {
  start: string;
  end: string;
}

export async function queryFreeBusy(
  accessToken: string,
  calendarId: string,
  timeMinISO: string,
  timeMaxISO: string
): Promise<BusyInterval[]> {
  const res = await fetch(`${CALENDAR_API}/freeBusy`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ timeMin: timeMinISO, timeMax: timeMaxISO, items: [{ id: calendarId }] }),
  });
  if (!res.ok) throw new Error(`Google freeBusy query failed (${res.status}): ${await res.text()}`);
  const json = await res.json();
  return json.calendars?.[calendarId]?.busy ?? [];
}

export interface CalendarEventSummary {
  id: string;
  summary: string;
  start: string | null; // null for all-day events lacking a dateTime
  end: string | null;
  allDay: boolean;
  htmlLink: string;
  meetLink: string | null;
}

export async function listUpcomingEvents(
  accessToken: string,
  calendarId: string,
  timeMinISO: string,
  timeMaxISO: string
): Promise<CalendarEventSummary[]> {
  const params = new URLSearchParams({
    timeMin: timeMinISO,
    timeMax: timeMaxISO,
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "50",
  });
  const res = await fetch(`${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Google events list failed (${res.status}): ${await res.text()}`);
  const json = await res.json();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (json.items ?? []).map((item: any) => {
    const meetEntry = item.conferenceData?.entryPoints?.find(
      (e: { entryPointType: string }) => e.entryPointType === "video"
    );
    return {
      id: item.id,
      summary: item.summary ?? "(No title)",
      start: item.start?.dateTime ?? null,
      end: item.end?.dateTime ?? null,
      allDay: !item.start?.dateTime && !!item.start?.date,
      htmlLink: item.htmlLink,
      meetLink: meetEntry?.uri ?? item.hangoutLink ?? null,
    };
  });
}

export interface CreatedMeetEvent {
  eventId: string;
  meetLink: string | null;
  htmlLink: string;
}

export async function createCalendarEventWithMeet(
  accessToken: string,
  calendarId: string,
  opts: { summary: string; description?: string; startISO: string; endISO: string; attendeeEmail: string }
): Promise<CreatedMeetEvent> {
  const url =
    `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events` +
    `?conferenceDataVersion=1&sendUpdates=all`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({
      summary: opts.summary,
      description: opts.description,
      start: { dateTime: opts.startISO },
      end: { dateTime: opts.endISO },
      attendees: [{ email: opts.attendeeEmail }],
      conferenceData: {
        createRequest: {
          requestId: crypto.randomUUID(),
          conferenceSolutionKey: { type: "hangoutsMeet" },
        },
      },
    }),
  });
  if (!res.ok) throw new Error(`Google event creation failed (${res.status}): ${await res.text()}`);
  const json = await res.json();
  const meetEntry = json.conferenceData?.entryPoints?.find(
    (e: { entryPointType: string }) => e.entryPointType === "video"
  );
  return {
    eventId: json.id,
    meetLink: meetEntry?.uri ?? json.hangoutLink ?? null,
    htmlLink: json.htmlLink,
  };
}

export async function patchCalendarEventTime(
  accessToken: string,
  calendarId: string,
  eventId: string,
  startISO: string,
  endISO: string
): Promise<void> {
  const url =
    `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}` +
    `?sendUpdates=all`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ start: { dateTime: startISO }, end: { dateTime: endISO } }),
  });
  if (!res.ok) throw new Error(`Google event reschedule failed (${res.status}): ${await res.text()}`);
}

export async function deleteCalendarEvent(accessToken: string, calendarId: string, eventId: string): Promise<void> {
  const url =
    `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}` +
    `?sendUpdates=all`;
  const res = await fetch(url, { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } });
  // 410 Gone = already deleted on Google's side — treat as success (idempotent).
  if (!res.ok && res.status !== 410) {
    throw new Error(`Google event delete failed (${res.status}): ${await res.text()}`);
  }
}
