import { type NextRequest } from "next/server";
import { withAuth } from "@/lib/api/handler";
import { ok, ApiError } from "@/lib/api/response";
import { getValidAccessToken } from "@/lib/google/connection";
import { listUpcomingEvents } from "@/lib/google/calendar";

/**
 * GET /api/meetings/calendar-events
 * The connected user's own upcoming Google Calendar events (today through
 * the next 7 days) — separate from the booking system's pending/confirmed
 * requests, this is just a read-only view of what's already on their calendar.
 */
export const GET = withAuth(async (_req: NextRequest, { user }) => {
  const connection = await getValidAccessToken(user.id);
  if (!connection) return ok({ events: [] });

  const now = new Date();
  const timeMin = now.toISOString();
  const timeMax = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

  try {
    const events = await listUpcomingEvents(connection.accessToken, connection.calendarId, timeMin, timeMax);
    return ok({ events });
  } catch (err) {
    console.error("[meetings/calendar-events]", err);
    return ApiError.internal();
  }
});
