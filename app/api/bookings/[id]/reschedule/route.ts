import { type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { withAuth } from "@/lib/api/handler";
import { ok, ApiError } from "@/lib/api/response";
import { isValidUUID } from "@/lib/utils/validate";
import { getValidAccessToken } from "@/lib/google/connection";
import { queryFreeBusy, patchCalendarEventTime } from "@/lib/google/calendar";
import { buildICS } from "@/lib/utils/ics";
import { sendEmail } from "@/lib/email/resend";

const rescheduleSchema = z.object({
  start_at: z.string().datetime({ offset: true, message: "Must be a valid ISO datetime" }),
  end_at: z.string().datetime({ offset: true, message: "Must be a valid ISO datetime" }),
});

/**
 * POST /api/bookings/:id/reschedule
 * Moves an already-confirmed booking to a new time: re-validates the new
 * slot against the host's real calendar (and other bookings), patches the
 * existing Google Calendar event in place (same Meet link, new time), and
 * notifies the requester.
 */
export const POST = withAuth(async (req: NextRequest, { user, params }) => {
  const id = params?.id;
  if (!id || !isValidUUID(id)) return ApiError.badRequest("Invalid booking ID");

  const body = await req.json().catch(() => null);
  if (!body) return ApiError.badRequest("Request body is required");
  const parsed = rescheduleSchema.safeParse(body);
  if (!parsed.success) return ApiError.badRequest(parsed.error.issues[0]?.message ?? "Invalid input");
  const { start_at, end_at } = parsed.data;
  if (new Date(end_at).getTime() <= new Date(start_at).getTime()) {
    return ApiError.badRequest("end_at must be after start_at");
  }

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const { data: booking, error: fetchErr } = await db
    .from("bookings")
    .select("*")
    .eq("id", id)
    .eq("host_id", user.id)
    .single();

  if (fetchErr || !booking) return ApiError.notFound("Booking not found");
  if (booking.status !== "confirmed") {
    return ApiError.badRequest(`Only confirmed bookings can be rescheduled (this one is ${booking.status})`);
  }

  const connection = await getValidAccessToken(user.id);
  if (!connection) return ApiError.badRequest("Connect Google Calendar first");

  // Re-validate the new slot is free. Note: the event being moved still
  // occupies its OLD time slot until patched below, so it only self-conflicts
  // if old and new ranges overlap — an edge case we accept for simplicity.
  let busy;
  try {
    busy = await queryFreeBusy(connection.accessToken, connection.calendarId, start_at, end_at);
  } catch (err) {
    console.error("[bookings/reschedule] freebusy check failed", err);
    return ApiError.internal();
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: overlapping } = await (db as any)
    .from("bookings")
    .select("id")
    .eq("host_id", user.id)
    .neq("id", id)
    .in("status", ["pending", "confirmed"])
    .lt("start_at", end_at)
    .gt("end_at", start_at);

  if (busy.length > 0 || (overlapping && overlapping.length > 0)) {
    return ApiError.badRequest("That time isn't available — please pick another.");
  }

  if (booking.google_event_id) {
    try {
      await patchCalendarEventTime(connection.accessToken, connection.calendarId, booking.google_event_id, start_at, end_at);
    } catch (err) {
      console.error("[bookings/reschedule] calendar patch failed", err);
      return ApiError.internal();
    }
  }

  const { data: updated, error: updateErr } = await db
    .from("bookings")
    .update({ start_at, end_at, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();

  if (updateErr) { console.error("[bookings/reschedule] update failed", updateErr); return ApiError.internal(); }

  const whenLabel = new Date(start_at).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "full",
    timeStyle: "short",
  });
  const ics = buildICS({
    uid: `${booking.id}@taskco`,
    summary: `Call with ${user.user_metadata?.full_name ?? "TaskCo"}`,
    description: booking.meet_link ? `Join: ${booking.meet_link}` : undefined,
    startISO: start_at,
    endISO: end_at,
    organizerEmail: user.email ?? "noreply@taskco.app",
    attendeeEmail: booking.requester_email,
    sequence: 1,
  });
  const emailResult = await sendEmail({
    to: booking.requester_email,
    subject: "Your call has been rescheduled",
    html: `
      <p>Hi ${booking.requester_name},</p>
      <p>Your call has been moved to ${whenLabel} IST.</p>
      ${booking.meet_link ? `<p><a href="${booking.meet_link}">Join with Google Meet</a></p>` : ""}
      <p>An updated calendar invite is attached.</p>
    `,
    attachments: [{ filename: "invite.ics", content: Buffer.from(ics).toString("base64") }],
  });
  if (!emailResult.ok) console.error("[bookings/reschedule] email send failed", emailResult.error);

  return ok(updated);
});
