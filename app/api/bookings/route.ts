import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withAuth } from "@/lib/api/handler";
import { ok, ApiError } from "@/lib/api/response";

/**
 * GET /api/bookings
 * The authenticated user's own booking requests (as host), most recent first.
 */
export const GET = withAuth(async (_req: NextRequest, { user }) => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bookings")
    .select("*")
    .eq("host_id", user.id)
    .order("start_at", { ascending: true });

  if (error) { console.error("[bookings GET]", error); return ApiError.internal(); }
  return ok(data ?? []);
});
