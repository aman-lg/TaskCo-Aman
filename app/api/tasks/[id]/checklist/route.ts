import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withAuth } from "@/lib/api/handler";
import { ok, ApiError } from "@/lib/api/response";
import { createChecklistItemSchema } from "@/lib/validations/tasks";

/**
 * GET /api/tasks/:id/checklist
 */
export const GET = withAuth(async (_req: NextRequest, { params }) => {
  const taskId = params?.id;
  if (!taskId) return ApiError.badRequest("Task ID is required");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("task_checklist_items")
    .select("id, content, is_done, position, created_at")
    .eq("task_id", taskId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) return ApiError.internal(error.message);
  return ok(data ?? []);
});

/**
 * POST /api/tasks/:id/checklist
 * Adds a checklist item. RLS: task creator or assignee only.
 */
export const POST = withAuth(async (req: NextRequest, { params }) => {
  const taskId = params?.id;
  if (!taskId) return ApiError.badRequest("Task ID is required");

  const body = await req.json().catch(() => null);
  if (!body) return ApiError.badRequest("Request body is required");

  const parsed = createChecklistItemSchema.safeParse(body);
  if (!parsed.success) {
    return ApiError.badRequest(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const { data, error } = await db
    .from("task_checklist_items")
    .insert({ task_id: taskId, ...parsed.data })
    .select("id, content, is_done, position, created_at")
    .single();

  if (error) return ApiError.internal(error.message);
  return ok(data, 201);
});
