import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withAuth } from "@/lib/api/handler";
import { ok, ApiError } from "@/lib/api/response";
import { todayISTDateString } from "@/lib/utils/dates-ist";

// GET /api/worklog/today — the caller's own worklog entry for today, or null
export const GET = withAuth(async (_req: NextRequest, { user }) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = (await createClient()) as any;
  const today = todayISTDateString();

  const { data, error } = await db
    .from("worklog_entries")
    .select("id, ist_date, presence_type, notes")
    .eq("user_id", user.id)
    .eq("ist_date", today)
    .maybeSingle();

  if (error) { console.error("[worklog/today]", error); return ApiError.internal(); }
  return ok({ entry: data ?? null, today });
});
