import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withAdmin } from "@/lib/api/handler";
import { ok, ApiError } from "@/lib/api/response";
import { todayISTDateString } from "@/lib/utils/dates-ist";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// GET /api/worklog/team?date=YYYY-MM-DD — everyone in the org, left-joined to
// their worklog entry for that date. People with no row show as "not marked"
// rather than being silently omitted — the actual point of a team view.
export const GET = withAdmin(async (req: NextRequest) => {
  const dateParam = req.nextUrl.searchParams.get("date");
  const date = dateParam && DATE_RE.test(dateParam) ? dateParam : todayISTDateString();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = (await createClient()) as any;

  const [{ data: members, error: me }, { data: entries, error: ee }] = await Promise.all([
    db.from("org_unit_members").select("user_id, profile:profiles!user_id(id, full_name, avatar_url, email)"),
    db.from("worklog_entries").select("user_id, presence_type, notes").eq("ist_date", date),
  ]);

  if (me) { console.error("[worklog/team members]", me); return ApiError.internal(); }
  if (ee) { console.error("[worklog/team entries]", ee); return ApiError.internal(); }

  const entryByUser = new Map(
    (entries ?? []).map((e: { user_id: string; presence_type: string; notes: string | null }) => [e.user_id, e])
  );

  const seen = new Set<string>();
  const people: Array<{ user_id: string; full_name: string | null; avatar_url: string | null; email: string | null; presence_type: string | null; notes: string | null }> = [];
  for (const m of members ?? []) {
    if (seen.has(m.user_id)) continue;
    seen.add(m.user_id);
    const entry = entryByUser.get(m.user_id) as { presence_type: string; notes: string | null } | undefined;
    people.push({
      user_id: m.user_id,
      full_name: m.profile?.full_name ?? null,
      avatar_url: m.profile?.avatar_url ?? null,
      email: m.profile?.email ?? null,
      presence_type: entry?.presence_type ?? null,
      notes: entry?.notes ?? null,
    });
  }
  people.sort((a, b) => (a.full_name ?? "").localeCompare(b.full_name ?? ""));

  return ok({ date, people });
});
