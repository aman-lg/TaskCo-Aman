import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withAuth } from "@/lib/api/handler";
import { ok, ApiError } from "@/lib/api/response";
import { createTaskSchema } from "@/lib/validations/tasks";

/**
 * GET /api/tasks?project_id=<uuid>
 * Lists tasks. project_id query param is required.
 * RLS: team-read â€” every authenticated user sees all tasks.
 */
export const GET = withAuth(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("project_id");
  if (!projectId) return ApiError.badRequest("project_id query param is required");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .select(
      `*, creator:profiles!created_by(id, full_name, avatar_url),
       task_assignees(user_id, assignee:profiles!user_id(id, full_name, avatar_url)),
       task_checklist_items(id, is_done)`
    )
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (error) return ApiError.internal(error.message);
  return ok(data ?? []);
});

/**
 * POST /api/tasks
 * Creates a new task. created_by is set to the authenticated user.
 *
 * Security:
 *   - withAuth() verifies JWT
 *   - created_by injected server-side
 *   - RLS INSERT policy enforces created_by = auth.uid()
 */
export const POST = withAuth(async (req: NextRequest, { user }) => {
  const body = await req.json().catch(() => null);
  if (!body) return ApiError.badRequest("Request body is required");

  const parsed = createTaskSchema.safeParse(body);
  if (!parsed.success) {
    return ApiError.badRequest(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const { data, error } = await db
    .from("tasks")
    .insert({ ...parsed.data, created_by: user.id })
    .select(
      `*, creator:profiles!created_by(id, full_name, avatar_url),
       task_assignees(user_id, assignee:profiles!user_id(id, full_name, avatar_url)),
       task_checklist_items(id, is_done)`
    )
    .single();

  if (error) return ApiError.internal(error.message);
  return ok(data, 201);
});
