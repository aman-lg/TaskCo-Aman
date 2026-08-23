import { type NextRequest } from "next/server";
import { withAuth } from "@/lib/api/handler";
import { ok, ApiError } from "@/lib/api/response";
import { createAdminClient } from "@/lib/supabase/admin";

export const POST = withAuth(async (_req: NextRequest, { user }) => {
  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any)
    .from("google_calendar_connections")
    .delete()
    .eq("user_id", user.id);

  if (error) { console.error("[google/disconnect]", error); return ApiError.internal(); }
  return ok({ disconnected: true });
});
