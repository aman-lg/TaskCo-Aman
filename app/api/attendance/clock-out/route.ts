import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withAuth } from "@/lib/api/handler";
import { ok, ApiError } from "@/lib/api/response";

export const POST = withAuth(async (_req: NextRequest, { user }) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = (await createClient()) as any;

  const { data: open } = await db
    .from("attendance_sessions")
    .select("id")
    .eq("user_id", user.id)
    .is("check_out_at", null)
    .maybeSingle();

  if (!open) return ApiError.badRequest("No open session to clock out");

  const now = new Date().toISOString();
  const { data, error } = await db
    .from("attendance_sessions")
    .update({ check_out_at: now })
    .eq("id", open.id)
    .select("id, check_in_at, check_out_at, ist_date")
    .single();

  if (error) return ApiError.internal(error.message);
  return ok(data);
});
