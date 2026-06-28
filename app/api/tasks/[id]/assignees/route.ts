import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withAuth } from "@/lib/api/handler";
import { ok, ApiError } from "@/lib/api/response";
import { assignTaskSchema } from "@/lib/validations/tasks";
import { isValidUUID } from "@/lib/utils/validate";

/**
 * GET /api/tasks/:id/assignees
 */
export const GET = withAuth(async (_req: NextRequest, { params }) => {
  const taskId = params?.id;
  if (!taskId) return ApiError.badRequest("Task ID is required");
  if (!isValidUUID(taskId)) return ApiError.badRequest("Invalid ID");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("task_assignees")
    .select("user_id, assigned_at, assignee:profiles!user_id(id, full_name, avatar_url)")
    .eq("task_id", taskId);

  if (error) { console.error("[tasks/[id]/assignees GET]", error); return ApiError.internal(); }
  return ok(data ?? []);
});

/**
 * POST /api/tasks/:id/assignees
 * Assigns a user to a task.
 *
 * Security:
 *   - withAuth() verifies JWT
 *   - assigned_by is set server-side from the authenticated user
 *   - RLS: task creator or existing assignee may add new assignees
 */
export const POST = withAuth(async (req: NextRequest, { user, params }) => {
  const taskId = params?.id;
  if (!taskId) return ApiError.badRequest("Task ID is required");
  if (!isValidUUID(taskId)) return ApiError.badRequest("Invalid ID");

  const body = await req.json().catch(() => null);
  if (!body) return ApiError.badRequest("Request body is required");

  const parsed = assignTaskSchema.safeParse(body);
  if (!parsed.success) {
    return ApiError.badRequest(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const { data, error } = await db
    .from("task_assignees")
    .insert({ task_id: taskId, user_id: parsed.data.user_id, assigned_by: user.id })
    .select("user_id, assigned_at, assignee:profiles!user_id(id, full_name, avatar_url)")
    .single();

  if (error) {
    // Duplicate assignment (unique constraint violation)
    if (error.code === "23505") return ApiError.badRequest("User is already assigned to this task");
    console.error("[tasks/[id]/assignees POST]", error); return ApiError.internal();
  }
  return ok(data, 201);
});

/**
 * DELETE /api/tasks/:id/assignees/:userId
 * Removes an assignee. Handled as a sub-resource; userId passed as query param.
 *
 * Note: Using query param instead of nested segment to keep route file count manageable.
 */
export const DELETE = withAuth(async (req: NextRequest, { params }) => {
  const taskId = params?.id;
  if (!taskId) return ApiError.badRequest("Task ID is required");
  if (!isValidUUID(taskId)) return ApiError.badRequest("Invalid ID");

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("user_id");
  if (!userId) return ApiError.badRequest("user_id query param is required");
  if (!isValidUUID(userId)) return ApiError.badRequest("Invalid user_id");

  const supabase = await createClient();
  const { error, count } = await supabase
    .from("task_assignees")
    .delete({ count: "exact" })
    .eq("task_id", taskId)
    .eq("user_id", userId);

  if (error) { console.error("[tasks/[id]/assignees DELETE]", error); return ApiError.internal(); }
  if (count === 0) return ApiError.notFound("Assignee not found");
  return ok({ removed: true });
});
