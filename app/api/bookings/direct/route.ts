import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withAuth } from "@/lib/api/handler";
import { ok, ApiError } from "@/lib/api/response";
import { directBookingSchema } from "@/lib/validations/booking";
import { getValidAccessToken } from "@/lib/google/connection";
import { queryFreeBusy, createCalendarEventWithMeet } from "@/lib/google/calendar";
import { buildICS } from "@/lib/utils/ics";
import { sendEmail } from "@/lib/email/resend";

/**
 * POST /api/bookings/direct
 * Host-initiated call — schedules straight to "confirmed" with a real
 * Calendar event + Meet link immediately (no pending/confirm step, since the
 * host is authorizing it themselves rather than a public visitor requesting it).
 */
export const POST = withAuth(async (req: NextRequest, { user }) => {
  const body = await req.json().catch(() => null);
  if (!body) return ApiError.badRequest("Request body is required");
  const parsed = directBookingSchema.safeParse(body);
  if (!parsed.success) return ApiError.badRequest(parsed.error.issues[0]?.message ?? "Invalid input");
  const { requester_name, requester_email, participant_emails, note, start_at, end_at } = parsed.data;

  if (new Date(end_at).getTime() <= new Date(start_at).getTime()) {
    return ApiError.badRequest("end_at must be after start_at");
  }

  const connection = await getValidAccessToken(user.id);
  if (!connection) return ApiError.badRequest("Connect Google Calendar first");

  let busy;
  try {
    busy = await queryFreeBusy(connection.accessToken, connection.calendarId, start_at, end_at);
  } catch (err) {
    console.error("[bookings/direct] freebusy check failed", err);
    return ApiError.internal();
  }
  if (busy.length > 0) {
    return ApiError.badRequest("You already have something on your calendar at that time.");
  }

  const attendeeEmails = [requester_email, ...(participant_emails ?? [])];

  let event;
  try {
    event = await createCalendarEventWithMeet(connection.accessToken, connection.calendarId, {
      summary: `Call with ${requester_name}`,
      description: note ?? undefined,
      startISO: start_at,
      endISO: end_at,
      attendeeEmails,
    });
  } catch (err) {
    console.error("[bookings/direct] calendar event creation failed", err);
    return ApiError.internal();
  }

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: booking, error } = await (supabase as any)
    .from("bookings")
    .insert({
      host_id: user.id,
      requester_name,
      requester_email,
      participant_emails: participant_emails ?? [],
      note: note ?? null,
      start_at,
      end_at,
      status: "confirmed",
      google_event_id: event.eventId,
      meet_link: event.meetLink,
    })
    .select("*")
    .single();

  if (error) { console.error("[bookings/direct] insert failed", error); return ApiError.internal(); }

  const whenLabel = new Date(start_at).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "full",
    timeStyle: "short",
  });
  const ics = buildICS({
    uid: `${booking.id}@taskco`,
    summary: `Call with ${user.user_metadata?.full_name ?? "TaskCo"}`,
    description: event.meetLink ? `Join: ${event.meetLink}` : undefined,
    startISO: start_at,
    endISO: end_at,
    organizerEmail: user.email ?? "noreply@taskco.app",
    attendeeEmails,
  });
  const emailResult = await sendEmail({
    to: attendeeEmails,
    subject: "You've been invited to a call",
    html: `
      <p>Hi ${requester_name},</p>
      <p>${user.user_metadata?.full_name ?? "Someone"} has scheduled a call with you for ${whenLabel} IST.</p>
      ${event.meetLink ? `<p><a href="${event.meetLink}">Join with Google Meet</a></p>` : ""}
      <p>A calendar invite (.ics) is attached.</p>
    `,
    attachments: [{ filename: "invite.ics", content: Buffer.from(ics).toString("base64") }],
  });
  if (!emailResult.ok) console.error("[bookings/direct] email send failed", emailResult.error);

  return ok(booking, 201);
});
