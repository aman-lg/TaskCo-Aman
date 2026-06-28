import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withAuth } from "@/lib/api/handler";
import { ok, ApiError } from "@/lib/api/response";

function getISTDateString() {
  return new Date()
    .toLocaleDateString("en-IN", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
    .split("/")
    .reverse()
    .join("-");
}

export const POST = withAuth(async (_req: NextRequest, { user }) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = (await createClient()) as any;

  const { data: open } = await db
    .from("attendance_sessions")
    .select("id")
    .eq("user_id", user.id)
    .is("check_out_at", null)
    .maybeSingle();

  if (open) return ApiError.badRequest("A work session is already open");

  const now = new Date().toISOString();
  const { data, error } = await db
    .from("attendance_sessions")
    .insert({ user_id: user.id, check_in_at: now, ist_date: getISTDateString() })
    .select("id, check_in_at, check_out_at, ist_date")
    .single();

  if (error) { console.error("[attendance/clock-in]", error); return ApiError.internal(); }
  return ok(data, 201);
});
