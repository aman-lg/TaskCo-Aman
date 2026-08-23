import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withAuth } from "@/lib/api/handler";
import { ok, ApiError } from "@/lib/api/response";

/**
 * GET /api/search?q=...
 * Global search across tasks, projects, and the user's own meetings/bookings.
 * Tasks/projects rely on the same team-read RLS as their own list endpoints —
 * this can't surface anything the user couldn't already see by browsing.
 * Bookings are host-only by RLS, so this only ever returns the caller's own.
 */
export const GET = withAuth(async (req: NextRequest, { user }) => {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return ok({ tasks: [], projects: [], bookings: [] });

  const supabase = await createClient();
  const pattern = `%${q}%`;

  const [tasksRes, projectsRes, bookingsRes] = await Promise.all([
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
    supabase
      .from("bookings")
      .select("id, requester_name, requester_email, status, start_at")
      .eq("host_id", user.id)
      .or(`requester_name.ilike.${pattern},requester_email.ilike.${pattern}`)
      .order("start_at", { ascending: false })
      .limit(5),
  ]);

  if (tasksRes.error || projectsRes.error || bookingsRes.error) {
    console.error("[search GET]", tasksRes.error ?? projectsRes.error ?? bookingsRes.error);
    return ApiError.internal();
  }

  return ok({
    tasks: tasksRes.data ?? [],
    projects: projectsRes.data ?? [],
    bookings: bookingsRes.data ?? [],
  });
});
