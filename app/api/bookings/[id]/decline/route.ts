import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withAuth } from "@/lib/api/handler";
import { ok, ApiError } from "@/lib/api/response";
import { isValidUUID } from "@/lib/utils/validate";

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
  return ok(data);
});
