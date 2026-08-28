import { type NextRequest } from "next/server";
import { withAuth } from "@/lib/api/handler";
import { ok, ApiError } from "@/lib/api/response";
import { createClient } from "@/lib/supabase/server";
import { isValidUUID } from "@/lib/utils/validate";
import { getAllTasks, getTaskStats } from "@/lib/queries/tasks";
import { getProjects } from "@/lib/queries/projects";
import { generateContent } from "@/lib/ai/gemini";

const TTL_MS = 6 * 60 * 60 * 1000; // 6h — never regenerate just because a page was opened
const MIN_FORCE_INTERVAL_MS = 60_000; // a manual "Refresh" can't out-cost itself via rapid re-clicks

// GET /api/ai/insights?scope=tasks|dashboard&project_id=
// Cached, read-only. Regenerated at most once per TTL — opening the page
// never itself triggers a Gemini call unless the cache is genuinely stale.
export const GET = withAuth(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const scope = searchParams.get("scope");
  const projectId = searchParams.get("project_id");
  const force = searchParams.get("force") === "1";
  if (scope !== "tasks" && scope !== "dashboard") return ApiError.badRequest("scope must be 'tasks' or 'dashboard'");
  if (projectId && !isValidUUID(projectId)) return ApiError.badRequest("Invalid project_id");

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  let query = db.from("ai_insights").select("*").eq("scope", scope);
  query = projectId ? query.eq("project_id", projectId) : query.is("project_id", null);
  const { data: existing } = await query.maybeSingle();

  const ageMs = existing ? Date.now() - new Date(existing.generated_at).getTime() : Infinity;
  const isFresh = ageMs < TTL_MS;
  const canForce = ageMs >= MIN_FORCE_INTERVAL_MS;
  if (isFresh && !(force && canForce)) {
    return ok({ content: existing.content, generated_at: existing.generated_at, cached: true });
  }

  const content = await generateInsight(supabase, scope, projectId);

  const row = existing
    ? await db.from("ai_insights").update({ content, generated_at: new Date().toISOString() }).eq("id", existing.id).select("content, generated_at").single()
    : await db.from("ai_insights").insert({ scope, project_id: projectId, content }).select("content, generated_at").single();

  if (row.error || !row.data) {
    console.error("[ai/insights GET] cache write failed", row.error);
    return ok({ content, generated_at: new Date().toISOString(), cached: false });
  }

  return ok({ content: row.data.content, generated_at: row.data.generated_at, cached: false });
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function generateInsight(supabase: any, scope: "tasks" | "dashboard", projectId: string | null): Promise<string> {
  const [tasks, stats, projects] = await Promise.all([getAllTasks(supabase), getTaskStats(supabase), getProjects(supabase)]);
  const scoped = projectId ? tasks.filter((t) => t.project_id === projectId) : tasks;

  const now = Date.now();
  const overdue = scoped.filter((t) => t.status !== "done" && t.deadline && new Date(t.deadline).getTime() < now);
  const urgent = scoped.filter((t) => t.status !== "done" && (t.urgency === "urgent" || t.urgency === "high"));
  const unassigned = scoped.filter((t) => t.status !== "done" && (t.task_assignees?.length ?? 0) === 0);

  const summary = {
    scope,
    project: projectId ? projects.find((p) => p.id === projectId)?.title : undefined,
    total_open: scoped.filter((t) => t.status !== "done").length,
    overdue: overdue.slice(0, 10).map((t) => ({ name: t.name, deadline: t.deadline })),
    urgent: urgent.slice(0, 10).map((t) => ({ name: t.name, urgency: t.urgency, deadline: t.deadline })),
    unassigned_count: unassigned.length,
    status_breakdown: scope === "dashboard" ? stats.statusBreakdown : undefined,
    project_count: scope === "dashboard" ? projects.length : undefined,
  };

  const prompt =
    scope === "dashboard"
      ? "Here is a snapshot of all team tasks/projects as JSON. Write a 2-4 sentence plain-text summary highlighting what needs attention (overdue/urgent items, anything unassigned). No markdown, no headers, just prose a busy manager can skim."
      : "Here is a snapshot of this task list as JSON. Write a 2-4 sentence plain-text summary of what needs attention (overdue/urgent items, anything unassigned) and one concrete suggestion. No markdown, no headers, just prose.";

  try {
    const result = await generateContent({
      contents: [{ role: "user", parts: [{ text: `${prompt}\n\n${JSON.stringify(summary)}` }] }],
    });
    return result.text?.trim() || "Nothing notable to report right now.";
  } catch (err) {
    console.error("[ai/insights] generateInsight failed", err);
    return "Insights are temporarily unavailable.";
  }
}
