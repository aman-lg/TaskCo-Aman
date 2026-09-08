import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withAuth } from "@/lib/api/handler";
import { ok, ApiError } from "@/lib/api/response";
import { todayISTDateString } from "@/lib/utils/dates-ist";
import { markWorklogSchema } from "@/lib/validations/worklog";

// POST /api/worklog/mark — upsert the caller's own entry for today. The date
// is always server-computed (never trust a client-sent date) so someone
// can't backfill/spoof a different day's presence through this route.
export const POST = withAuth(async (req: NextRequest, { user }) => {
  const body = await req.json().catch(() => null);
  const parsed = markWorklogSchema.safeParse(body);
  if (!parsed.success) return ApiError.badRequest(parsed.error.issues[0].message);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = (await createClient()) as any;
  const today = todayISTDateString();

  const { data, error } = await db
    .from("worklog_entries")
    .upsert(
      {
        user_id: user.id,
        ist_date: today,
        presence_type: parsed.data.presence_type,
        notes: parsed.data.notes ?? null,
      },
      { onConflict: "user_id,ist_date" }
    )
    .select("id, ist_date, presence_type, notes")
    .single();

  if (error) { console.error("[worklog/mark]", error); return ApiError.internal(); }
  return ok(data);
});
