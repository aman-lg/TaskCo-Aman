import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withAuth } from "@/lib/api/handler";
import { ok, ApiError } from "@/lib/api/response";
import { isValidUUID } from "@/lib/utils/validate";
import { sendEmail } from "@/lib/email/resend";

// Declining a still-pending request never had a Google Calendar event
// created for it (that only happens on confirm), so there's nothing for
// Google to notify the requester about — we have to send this ourselves.
export const POST = withAuth(async (_req: NextRequest, { user, params }) => {
  const id = params?.id;
  if (!id || !isValidUUID(id)) return ApiError.badRequest("Invalid booking ID");

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("bookings")
    .update({ status: "declined", updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("host_id", user.id)
    .eq("status", "pending")
    .select("*")
    .single();

  if (error) return ApiError.notFound("Booking not found or already actioned");

  const emailResult = await sendEmail({
    to: data.requester_email,
    subject: "Your call request wasn't accepted",
    html: `
      <p>Hi ${data.requester_name},</p>
      <p>Unfortunately your requested call for ${new Date(data.start_at).toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        dateStyle: "full",
        timeStyle: "short",
      })} IST wasn't accepted. Feel free to request a different time.</p>
    `,
  });
  if (!emailResult.ok) console.error("[bookings/decline] email send failed", emailResult.error);

  return ok(data);
});
