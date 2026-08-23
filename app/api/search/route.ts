import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withAuth } from "@/lib/api/handler";
import { ok, ApiError } from "@/lib/api/response";

/**
 * GET /api/search?q=...
 * Global search across tasks and projects — same team-read RLS as their own
 * list endpoints applies, so this can't surface anything the user couldn't
 * already see by browsing.
 */
export const GET = withAuth(async (req: NextRequest) => {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return ok({ tasks: [], projects: [] });

  const supabase = await createClient();
  const pattern = `%${q}%`;

  const [tasksRes, projectsRes] = await Promise.all([
    supabase
      .from("tasks")
      .select("id, name, status, project_id, project:projects!project_id(title)")
      .ilike("name", pattern)
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("projects")
      .select("id, title, status")
      .ilike("title", pattern)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  if (tasksRes.error || projectsRes.error) {
    console.error("[search GET]", tasksRes.error ?? projectsRes.error);
    return ApiError.internal();
  }

  return ok({ tasks: tasksRes.data ?? [], projects: projectsRes.data ?? [] });
});
