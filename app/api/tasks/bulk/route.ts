import { type NextRequest } from "next/server";
import { withAuth } from "@/lib/api/handler";
import { ok, ApiError } from "@/lib/api/response";
import { createClient } from "@/lib/supabase/server";
import { bulkCreateTaskSchema } from "@/lib/validations/tasks";

/**
 * POST /api/tasks/bulk
 * Creates one independent task per assignee — same project/name/description/
 * urgency/deadline, but each a separate row with its own single assignee, so
 * each person's copy can be tracked (status, checklist) independently of the
 * others. This is the "assign to multiple people across departments at once"
 * flow: the caller already resolved department/sub-department filters down
 * to a flat, deduplicated list of user ids before calling this.
 *
 * Security: same as POST /api/tasks — created_by is injected server-side,
 * RLS enforces created_by = auth.uid() on the tasks insert and
 * assigned_by = auth.uid() on the task_assignees insert. Assigning a task to
 * someone has no role/rank restriction anywhere in this app (by design).
 */
export const POST = withAuth(async (req: NextRequest, { user }) => {
  const body = await req.json().catch(() => null);
  if (!body) return ApiError.badRequest("Request body is required");

  const parsed = bulkCreateTaskSchema.safeParse(body);
  if (!parsed.success) {
    return ApiError.badRequest(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  const { assignee_ids, ...taskFields } = parsed.data;
  const uniqueAssigneeIds = Array.from(new Set(assignee_ids));

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const { data: tasks, error: tasksError } = await db
    .from("tasks")
    .insert(uniqueAssigneeIds.map(() => ({ ...taskFields, created_by: user.id })))
    .select("id");

  if (tasksError || !tasks) {
    console.error("[tasks/bulk POST tasks]", tasksError);
    return ApiError.internal();
  }

  const { data: assignees, error: assigneesError } = await db
    .from("task_assignees")
    .insert(
      tasks.map((t: { id: string }, i: number) => ({
        task_id: t.id,
        user_id: uniqueAssigneeIds[i],
        assigned_by: user.id,
      }))
    )
    .select("task_id, user_id");

  if (assigneesError) {
    // The task rows themselves were created successfully; only the assignment
    // linking failed. Report clearly rather than claiming full success.
    console.error("[tasks/bulk POST assignees]", assigneesError);
    return ok(
      { created: tasks.length, assigned: 0, warning: "Tasks were created but assigning them failed. Assign manually from each task." },
      201
    );
  }

  return ok({ created: tasks.length, assigned: assignees?.length ?? 0 }, 201);
});
