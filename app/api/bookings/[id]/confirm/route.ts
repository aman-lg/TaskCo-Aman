import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withAuth } from "@/lib/api/handler";
import { ok, ApiError } from "@/lib/api/response";
import { isValidUUID } from "@/lib/utils/validate";
import { getValidAccessToken } from "@/lib/google/connection";
import { createCalendarEventWithMeet } from "@/lib/google/calendar";
import { buildICS } from "@/lib/utils/ics";
import { sendEmail } from "@/lib/email/resend";

/**
 * POST /api/bookings/:id/confirm
 * Only now — on explicit host confirmation — is a real Google Calendar event
 * created and a Meet link generated. Pending bookings never touch Google.
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
  if (booking.status !== "pending") return ApiError.badRequest(`Booking is already ${booking.status}`);

  const connection = await getValidAccessToken(user.id);
  if (!connection) return ApiError.badRequest("Connect Google Calendar first");

  const attendeeEmails = [booking.requester_email, ...(booking.participant_emails ?? [])];

  let event;
  try {
    event = await createCalendarEventWithMeet(connection.accessToken, connection.calendarId, {
      summary: `Call with ${booking.requester_name}`,
      description: booking.note ?? undefined,
      startISO: booking.start_at,
      endISO: booking.end_at,
      attendeeEmails,
    });
  } catch (err) {
    console.error("[bookings/confirm] calendar event creation failed", err);
    return ApiError.internal();
  }

  const { data: updated, error: updateErr } = await db
    .from("bookings")
    .update({
      status: "confirmed",
      google_event_id: event.eventId,
      meet_link: event.meetLink,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();

  if (updateErr) { console.error("[bookings/confirm] update failed", updateErr); return ApiError.internal(); }

  // Best-effort — Google also emails the attendee directly (sendUpdates=all),
  // this is a belt-and-braces copy with the .ics attached in case that lands
  // in spam or the requester's client doesn't render Google's invite well.
  const whenLabel = new Date(booking.start_at).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "full",
    timeStyle: "short",
  });
  const ics = buildICS({
    uid: `${booking.id}@taskco`,
    summary: `Call with ${user.user_metadata?.full_name ?? "TaskCo"}`,
    description: event.meetLink ? `Join: ${event.meetLink}` : undefined,
    startISO: booking.start_at,
    endISO: booking.end_at,
    organizerEmail: user.email ?? "noreply@taskco.app",
    attendeeEmails,
  });
  const emailResult = await sendEmail({
    to: attendeeEmails,
    subject: "Your call is confirmed",
    html: `
      <p>Hi ${booking.requester_name},</p>
      <p>Your call is confirmed for ${whenLabel} IST.</p>
      ${event.meetLink ? `<p><a href="${event.meetLink}">Join with Google Meet</a></p>` : ""}
      <p>A calendar invite (.ics) is attached — it'll open in Google Calendar, Outlook, or Apple Calendar.</p>
    `,
    attachments: [{ filename: "invite.ics", content: Buffer.from(ics).toString("base64") }],
  });
  if (!emailResult.ok) console.error("[bookings/confirm] email send failed", emailResult.error);

  return ok(updated);
});
