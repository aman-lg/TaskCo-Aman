import { type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ok, ApiError } from "@/lib/api/response";
import { createBookingSchema } from "@/lib/validations/booking";
import { getValidAccessToken } from "@/lib/google/connection";
import { queryFreeBusy } from "@/lib/google/calendar";

/**
 * POST /api/booking/:slug
 * Public — no auth. Creates a *pending* booking request; no Google Meet link
 * exists yet. The host must explicitly confirm (see /api/bookings/:id/confirm)
 * before a real calendar event + Meet link is created.
 */
export async function POST(req: NextRequest, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const body = await req.json().catch(() => null);
  if (!body) return ApiError.badRequest("Request body is required");

  const parsed = createBookingSchema.safeParse(body);
  if (!parsed.success) return ApiError.badRequest(parsed.error.issues[0]?.message ?? "Invalid input");
  const { start_at, end_at, requester_name, requester_email, participant_emails, note } = parsed.data;

  if (new Date(end_at).getTime() <= new Date(start_at).getTime()) {
    return ApiError.badRequest("end_at must be after start_at");
  }

  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: host } = await (admin as any)
    .from("profiles")
    .select("id")
    .eq("booking_slug", slug)
    .maybeSingle();
  if (!host) return ApiError.notFound("Booking page not found");

  const connection = await getValidAccessToken(host.id);
  if (!connection) return ApiError.badRequest("This host hasn't connected Google Calendar yet");

  // Re-validate the slot is actually still free — the list the visitor saw can
  // be stale (another visitor grabbed it, or the host's calendar changed since).
  let busy;
  try {
    busy = await queryFreeBusy(connection.accessToken, connection.calendarId, start_at, end_at);
  } catch (err) {
    console.error("[booking POST] freebusy check failed", err);
    return ApiError.internal();
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: overlapping } = await (admin as any)
    .from("bookings")
    .select("id")
    .eq("host_id", host.id)
    .in("status", ["pending", "confirmed"])
    .lt("start_at", end_at)
    .gt("end_at", start_at);

  if (busy.length > 0 || (overlapping && overlapping.length > 0)) {
    return ApiError.badRequest("That slot is no longer available — please pick another.");
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: booking, error } = await (admin as any)
    .from("bookings")
    .insert({
      host_id: host.id,
      requester_name,
      requester_email,
      participant_emails: participant_emails ?? [],
      note: note ?? null,
      start_at,
      end_at,
    })
    .select("id")
    .single();

  if (error) { console.error("[booking POST]", error); return ApiError.internal(); }

  const whenLabel = new Date(start_at).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: notifErr } = await (admin as any).from("notifications").insert({
    user_id: host.id,
    type: "booking_request",
    title: "New booking request",
    body: `${requester_name}${participant_emails?.length ? ` (+${participant_emails.length})` : ""} requested a call for ${whenLabel} IST`,
    entity_type: "booking",
    entity_id: booking.id,
  });
  if (notifErr) console.error("[booking POST] notification insert failed", notifErr);

  return ok({ id: booking.id }, 201);
}
