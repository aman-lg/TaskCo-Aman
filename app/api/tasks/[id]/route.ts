import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withAuth } from "@/lib/api/handler";
import { ok, ApiError } from "@/lib/api/response";
import { updateTaskSchema } from "@/lib/validations/tasks";

/**
 * GET /api/tasks/:id
 * Returns a single task with full details (assignees, checklist items).
 */
export const GET = withAuth(async (_req: NextRequest, { params }) => {
  const id = params?.id;
  if (!id) return ApiError.badRequest("Task ID is required");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .select(
      `*, creator:profiles!created_by(id, full_name, avatar_url),
       task_assignees(user_id, assignee:profiles!user_id(id, full_name, avatar_url)),
       task_checklist_items(id, content, is_done, position, created_at)`
    )
    .eq("id", id)
    .single();

  if (error || !data) return ApiError.notFound("Task not found");
  return ok(data);
});

/**
 * PATCH /api/tasks/:id
 * Updates task fields. RLS: creator OR assignee may update.
 * project_id is not patchable (use createTaskSchema omits it).
 *
 * Security:
 *   - withAuth() verifies JWT
 *   - Zod strips project_id from update payload
 *   - RLS is_task_collaborator() enforces creator/assignee restriction
 *   - 0-row result → 403 (RLS blocked)
 */
export const PATCH = withAuth(async (req: NextRequest, { params }) => {
  const id = params?.id;
  if (!id) return ApiError.badRequest("Task ID is required");

  const body = await req.json().catch(() => null);
  if (!body) return ApiError.badRequest("Request body is required");

  const parsed = updateTaskSchema.safeParse(body);
  if (!parsed.success) {
    return ApiError.badRequest(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  if (Object.keys(parsed.data).length === 0) {
    return ApiError.badRequest("No fields to update");
  }

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const { data, error } = await db
    .from("tasks")
    .update(parsed.data)
    .eq("id", id)
    .select(
      `*, creator:profiles!created_by(id, full_name, avatar_url),
       task_assignees(user_id, assignee:profiles!user_id(id, full_name, avatar_url)),
       task_checklist_items(id, is_done)`
    )
    .single();

  if (error) {
    if (error.code === "PGRST116") return ApiError.forbidden();
    return ApiError.internal(error.message);
  }
  if (!data) return ApiError.forbidden();
  return ok(data);
});

/**
 * DELETE /api/tasks/:id
 * Deletes a task. RLS: creator only.
 */
export const DELETE = withAuth(async (_req: NextRequest, { params }) => {
  const id = params?.id;
  if (!id) return ApiError.badRequest("Task ID is required");

  const supabase = await createClient();
  const { error, count } = await supabase
    .from("tasks")
    .delete({ count: "exact" })
    .eq("id", id);

  if (error) return ApiError.internal(error.message);
  if (count === 0) return ApiError.forbidden();
  return ok({ deleted: true });
});
