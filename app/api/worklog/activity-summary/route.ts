import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withAuth } from "@/lib/api/handler";
import { ok, ApiError } from "@/lib/api/response";
import { todayISTDateString, istDayBoundsUtc } from "@/lib/utils/dates-ist";
import { isValidUUID } from "@/lib/utils/validate";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// GET /api/worklog/activity-summary?date=YYYY-MM-DD&user_id=
// Auto-populated "what did you work on" — derived from activity_log's
// existing status_changed events rather than requiring manual entry.
// Defaults to the caller's own day; a different user_id is only readable by
// an admin (this is what backs the admin team drill-down as well as the
// caller's own personal-page summary).
export const GET = withAuth(async (req: NextRequest, { user }) => {
  const dateParam = req.nextUrl.searchParams.get("date");
  const date = dateParam && DATE_RE.test(dateParam) ? dateParam : todayISTDateString();

  const requestedUserId = req.nextUrl.searchParams.get("user_id") ?? user.id;
  if (!isValidUUID(requestedUserId)) return ApiError.badRequest("Invalid user id");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = (await createClient()) as any;

  if (requestedUserId !== user.id) {
    const { data: profile } = await db.from("profiles").select("is_admin").eq("id", user.id).single();
    if (!profile?.is_admin) return ApiError.forbidden();
  }

  const { startUtc, endUtc } = istDayBoundsUtc(date);
  const { data: events, error } = await db
    .from("activity_log")
    .select("id, entity_type, entity_id, metadata, created_at")
    .eq("actor_id", requestedUserId)
    .eq("action", "status_changed")
    .in("entity_type", ["task", "project"])
    .gte("created_at", startUtc)
    .lt("created_at", endUtc)
    .order("created_at", { ascending: true });

  if (error) { console.error("[worklog/activity-summary]", error); return ApiError.internal(); }

  const rows = events ?? [];
  const taskIds = rows.filter((r: { entity_type: string }) => r.entity_type === "task").map((r: { entity_id: string }) => r.entity_id);
  const projectIds = rows.filter((r: { entity_type: string }) => r.entity_type === "project").map((r: { entity_id: string }) => r.entity_id);

  const [{ data: tasks }, { data: projects }] = await Promise.all([
    taskIds.length
      ? db.from("tasks").select("id, name").in("id", taskIds)
      : Promise.resolve({ data: [] }),
    projectIds.length
      ? db.from("projects").select("id, title").in("id", projectIds)
      : Promise.resolve({ data: [] }),
  ]);
  const taskNames = new Map((tasks ?? []).map((t: { id: string; name: string }) => [t.id, t.name]));
  const projectTitles = new Map((projects ?? []).map((p: { id: string; title: string }) => [p.id, p.title]));

  const summary = rows.map((r: { id: string; entity_type: string; entity_id: string; metadata: { from?: string; to?: string }; created_at: string }) => ({
    id: r.id,
    entityType: r.entity_type,
    title:
      r.entity_type === "task"
        ? taskNames.get(r.entity_id) ?? "(deleted task)"
        : projectTitles.get(r.entity_id) ?? "(deleted project)",
    from: r.metadata?.from ?? null,
    to: r.metadata?.to ?? null,
    at: r.created_at,
  }));

  return ok({ date, summary });
});
