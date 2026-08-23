import { type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ok, ApiError } from "@/lib/api/response";
import { getValidAccessToken } from "@/lib/google/connection";
import { queryFreeBusy, type BusyInterval } from "@/lib/google/calendar";
import { generateCandidateSlots, filterAvailableSlots } from "@/lib/booking/availability";

/**
 * GET /api/booking/:slug/availability
 * Public — no auth. Returns the host's open slots for the next 14 days,
 * excluding both their real Google Calendar busy time and any of our own
 * pending/confirmed booking requests (which Google doesn't know about yet).
 */
export async function GET(_req: NextRequest, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const admin = createAdminClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: host } = await (admin as any)
    .from("profiles")
    .select("id, full_name")
    .eq("booking_slug", slug)
    .maybeSingle();
  if (!host) return ApiError.notFound("Booking page not found");

  const connection = await getValidAccessToken(host.id);
  if (!connection) return ApiError.badRequest("This host hasn't connected Google Calendar yet");

  const candidates = generateCandidateSlots();
  if (candidates.length === 0) return ok({ hostName: host.full_name, slots: [] });

  const timeMin = candidates[0].startISO;
  const timeMax = candidates[candidates.length - 1].endISO;

  try {
    const [busy, { data: pendingBookings }] = await Promise.all([
      queryFreeBusy(connection.accessToken, connection.calendarId, timeMin, timeMax),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (admin as any)
        .from("bookings")
        .select("start_at, end_at")
        .eq("host_id", host.id)
        .in("status", ["pending", "confirmed"])
        .lt("start_at", timeMax)
        .gt("end_at", timeMin),
    ]);

    const bookingBusy: BusyInterval[] = (pendingBookings ?? []).map(
      (b: { start_at: string; end_at: string }) => ({ start: b.start_at, end: b.end_at })
    );
    const available = filterAvailableSlots(candidates, [...busy, ...bookingBusy]);
    return ok({ hostName: host.full_name, slots: available });
  } catch (err) {
    console.error("[booking availability]", err);
    return ApiError.internal();
  }
}
