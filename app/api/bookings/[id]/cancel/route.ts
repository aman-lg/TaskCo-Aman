import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withAuth } from "@/lib/api/handler";
import { ok, ApiError } from "@/lib/api/response";
import { isValidUUID } from "@/lib/utils/validate";
import { getValidAccessToken } from "@/lib/google/connection";
import { deleteCalendarEvent } from "@/lib/google/calendar";
import { buildICS } from "@/lib/utils/ics";
import { sendEmail } from "@/lib/email/resend";

/**
 * POST /api/bookings/:id/cancel
 * Cancels an already-confirmed booking: removes the Google Calendar event
 * (Google notifies the attendee directly via sendUpdates=all) and marks the
 * booking cancelled. For a still-pending request, use /decline instead.
 */
export const POST = withAuth(async (_req: NextRequest, { user, params }) => {
  const id = params?.id;
  if (!id || !isValidUUID(id)) return ApiError.badRequest("Invalid booking ID");

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
    return ApiError.badRequest(`Only confirmed bookings can be cancelled (this one is ${booking.status})`);
  }

  if (booking.google_event_id) {
    const connection = await getValidAccessToken(user.id);
    if (connection) {
      try {
        await deleteCalendarEvent(connection.accessToken, connection.calendarId, booking.google_event_id);
      } catch (err) {
        console.error("[bookings/cancel] calendar delete failed", err);
        return ApiError.internal();
      }
    }
  }

  const { data: updated, error: updateErr } = await db
    .from("bookings")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();

  if (updateErr) { console.error("[bookings/cancel] update failed", updateErr); return ApiError.internal(); }

  // Best-effort — Google already notifies the attendee directly; this is a
  // belt-and-braces copy plus a CANCEL .ics so it clears from their calendar app.
  const whenLabel = new Date(booking.start_at).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "full",
    timeStyle: "short",
  });
  const attendeeEmails = [booking.requester_email, ...(booking.participant_emails ?? [])];
  const ics = buildICS({
    uid: `${booking.id}@taskco`,
    summary: `Call with ${user.user_metadata?.full_name ?? "TaskCo"}`,
    startISO: booking.start_at,
    endISO: booking.end_at,
    organizerEmail: user.email ?? "noreply@taskco.app",
    attendeeEmails,
    method: "CANCEL",
    sequence: 1,
  });
  const emailResult = await sendEmail({
    to: attendeeEmails,
    subject: "Your call has been cancelled",
    html: `
      <p>Hi ${booking.requester_name},</p>
      <p>Your call scheduled for ${whenLabel} IST has been cancelled.</p>
    `,
    attachments: [{ filename: "cancel.ics", content: Buffer.from(ics).toString("base64") }],
  });
  if (!emailResult.ok) console.error("[bookings/cancel] email send failed", emailResult.error);

  return ok(updated);
});
