import { type NextRequest } from "next/server";
import { withAuth } from "@/lib/api/handler";
import { ok, ApiError } from "@/lib/api/response";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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
  if (scope !== "tasks" && scope !== "dashboard" && scope !== "marketing_youtube") {
    return ApiError.badRequest("scope must be 'tasks', 'dashboard', or 'marketing_youtube'");
  }
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

  // ai_insights has no client insert/update policy (server-written only,
  // see 040_ai_foundation.sql) — the cache write has to go through the
  // admin client even though the read above is fine on the user's own.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const row = existing
    ? await admin.from("ai_insights").update({ content, generated_at: new Date().toISOString() }).eq("id", existing.id).select("content, generated_at").single()
    : await admin.from("ai_insights").insert({ scope, project_id: projectId, content }).select("content, generated_at").single();

  if (row.error || !row.data) {
    console.error("[ai/insights GET] cache write failed", row.error);
    return ok({ content, generated_at: new Date().toISOString(), cached: false });
  }

  return ok({ content: row.data.content, generated_at: row.data.generated_at, cached: false });
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function generateInsight(supabase: any, scope: "tasks" | "dashboard" | "marketing_youtube", projectId: string | null): Promise<string> {
  if (scope === "marketing_youtube") return generateYoutubeInsight(supabase);

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

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function generateYoutubeInsight(supabase: any): Promise<string> {
  const { data: videos } = await supabase
    .from("youtube_videos")
    .select("title, published_at, tags, category_name, views, likes, comments, shares, impressions, impressions_ctr")
    .order("views", { ascending: false, nullsFirst: false });

  if (!videos || videos.length === 0) {
    return "No videos synced yet — click Sync Now once YouTube is connected.";
  }

  // Capped rather than sent in full — a channel with thousands of uploads
  // would otherwise blow up the prompt for no real gain; sorted by views
  // first (already done in the query above) so the cap keeps the videos
  // that actually matter for "what's working", at some cost to full
  // historical time-of-day coverage for very large channels.
  type VideoRow = {
    title: string; published_at: string; tags: string[] | null; category_name: string | null;
    views: number | null; likes: number | null; comments: number | null; shares: number | null;
    impressions: number | null; impressions_ctr: number | null;
  };
  const capped = (videos as VideoRow[]).slice(0, 200).map((v) => {
    const published = new Date(v.published_at);
    return {
      title: v.title.slice(0, 80),
      published_day: DAY_NAMES[published.getUTCDay()],
      published_hour_utc: published.getUTCHours(),
      category: v.category_name,
      tags: (v.tags ?? []).slice(0, 5),
      views: v.views, likes: v.likes, comments: v.comments, shares: v.shares,
      impressions: v.impressions, impressions_ctr: v.impressions_ctr,
    };
  });

  const prompt = `Here is per-video YouTube performance data as JSON (published_hour_utc is the hour of day, 0-23, UTC). Write a structured plain-text analysis with exactly these three labeled sections:

Top themes: which topics/subjects (based on titles/tags/category) are performing best, with 1-2 concrete examples.
Best format: what type/style of video (based on category/title patterns) is outperforming the rest, if a pattern is visible.
Best time to post: which day(s) of the week and time of day (UTC) correlate with the strongest views/engagement, based on published_day/published_hour_utc versus views/likes/comments.

If the data is too sparse or inconsistent for a confident claim in any section, say so plainly in that section instead of guessing. No markdown headers/bullets — plain sentences under each label.`;

  try {
    const result = await generateContent({
      contents: [{ role: "user", parts: [{ text: `${prompt}\n\n${JSON.stringify(capped)}` }] }],
    });
    return result.text?.trim() || "Nothing notable to report right now.";
  } catch (err) {
    console.error("[ai/insights] generateYoutubeInsight failed", err);
    return "Insights are temporarily unavailable.";
  }
}
