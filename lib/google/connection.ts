// SERVER ONLY — never import from "use client" files.
import { createAdminClient } from "@/lib/supabase/admin";
import { refreshAccessToken } from "@/lib/google/calendar";

export interface ActiveConnection {
  accessToken: string;
  calendarId: string;
}

/**
 * Returns a valid (non-expired) Google access token for the given user,
 * refreshing and persisting it first if the cached one has expired.
 * Returns null if the user hasn't connected Google Calendar.
 */
export async function getValidAccessToken(userId: string): Promise<ActiveConnection | null> {
  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: conn } = await (admin as any)
    .from("google_calendar_connections")
    .select("access_token, refresh_token, token_expiry, calendar_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (!conn) return null;

  const expiryMs = conn.token_expiry ? new Date(conn.token_expiry).getTime() : 0;
  const stillValid = conn.access_token && expiryMs - Date.now() > 60_000; // 60s safety margin
  if (stillValid) {
    return { accessToken: conn.access_token, calendarId: conn.calendar_id };
  }

  const refreshed = await refreshAccessToken(conn.refresh_token);
  const newExpiry = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin as any)
    .from("google_calendar_connections")
    .update({ access_token: refreshed.access_token, token_expiry: newExpiry, updated_at: new Date().toISOString() })
    .eq("user_id", userId);

  return { accessToken: refreshed.access_token, calendarId: conn.calendar_id };
}
