import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withAuth } from "@/lib/api/handler";
import { ok, ApiError } from "@/lib/api/response";
import { updateChecklistItemSchema } from "@/lib/validations/tasks";
import { isValidUUID } from "@/lib/utils/validate";

/**
 * PATCH /api/tasks/:id/checklist/:itemId
 * Updates content, is_done, or position of a checklist item.
 * RLS: task creator or assignee only.
 */
export const PATCH = withAuth(async (req: NextRequest, { params }) => {
  const id = params?.id;
  const itemId = params?.itemId;
  if (!id || !isValidUUID(id)) return ApiError.badRequest("Invalid ID");
  if (!itemId) return ApiError.badRequest("Item ID is required");
  if (!isValidUUID(itemId)) return ApiError.badRequest("Invalid ID");

  const body = await req.json().catch(() => null);
  if (!body) return ApiError.badRequest("Request body is required");

  const parsed = updateChecklistItemSchema.safeParse(body);
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
    .from("task_checklist_items")
    .update(parsed.data)
    .eq("id", itemId)
    .select("id, content, is_done, position, created_at")
    .single();

  if (error) {
    if (error.code === "PGRST116") return ApiError.forbidden();
    console.error("[tasks/[id]/checklist/[itemId] PATCH]", error); return ApiError.internal();
  }
  if (!data) return ApiError.notFound("Checklist item not found");
  return ok(data);
});

/**
 * DELETE /api/tasks/:id/checklist/:itemId
 * Removes a checklist item. RLS: task creator or assignee only.
 */
export const DELETE = withAuth(async (_req: NextRequest, { params }) => {
  const id = params?.id;
  const itemId = params?.itemId;
  if (!id || !isValidUUID(id)) return ApiError.badRequest("Invalid ID");
  if (!itemId) return ApiError.badRequest("Item ID is required");
  if (!isValidUUID(itemId)) return ApiError.badRequest("Invalid ID");

  const supabase = await createClient();
  const { error, count } = await supabase
    .from("task_checklist_items")
    .delete({ count: "exact" })
    .eq("id", itemId);

  if (error) { console.error("[tasks/[id]/checklist/[itemId] DELETE]", error); return ApiError.internal(); }
  if (count === 0) return ApiError.notFound("Checklist item not found");
  return ok({ deleted: true });
});
