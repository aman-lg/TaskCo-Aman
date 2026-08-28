import { type NextRequest, after } from "next/server";
import { withAuth } from "@/lib/api/handler";
import { ok, ApiError } from "@/lib/api/response";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidUUID } from "@/lib/utils/validate";
import { upsertEmbedding, taskEmbeddingContent } from "@/lib/ai/embed";

// POST /api/chat/ai-actions/[id]/confirm
// Executes a previously-proposed Ask Tasko action. The mutation runs through
// the confirming user's own session — same table, same columns, same RLS as
// if they'd used the regular task UI — so this can't do anything the
// existing app/api/tasks routes couldn't already do for this user.
export const POST = withAuth(async (_req: NextRequest, ctx) => {
  const { id } = (ctx.params as unknown as { id: string });
  if (!isValidUUID(id)) return ApiError.badRequest("Invalid action ID.");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return ApiError.unauthorized();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: action } = await (supabase as any)
    .from("ai_actions")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!action) return ApiError.notFound("Action not found.");
  if (action.status !== "pending") return ApiError.badRequest("This action has already been resolved.");

  const payload = action.payload as Record<string, unknown>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  let result: Record<string, unknown>;

  try {
    switch (action.action_type) {
      case "create_task": {
        const { data, error } = await db
          .from("tasks")
          .insert({ ...payload, created_by: user.id })
          .select("id, name, project_id")
          .single();
        if (error) throw error;
        after(() => upsertEmbedding("task", data.id, data.project_id, taskEmbeddingContent(data.name, payload.description as string | undefined)));
        result = { task_id: data.id, name: data.name };
        break;
      }
      case "update_task": {
        const { task_id, ...fields } = payload;
        const { data, error } = await db.from("tasks").update(fields).eq("id", task_id).select("id, name").single();
        if (error) throw error;
        result = { task_id: data.id, name: data.name };
        break;
      }
      case "assign_task": {
        const { task_id, user_id } = payload;
        const { data, error } = await db
          .from("task_assignees")
          .insert({ task_id, user_id, assigned_by: user.id })
          .select("user_id")
          .single();
        if (error) throw error;
        result = { task_id, user_id: data.user_id };
        break;
      }
      default:
        return ApiError.badRequest("Unknown action type.");
    }
  } catch (err) {
    const code = (err as { code?: string })?.code;
    const message =
      code === "PGRST116" || code === "42501"
        ? "You don't have permission to do that."
        : code === "23505"
          ? "That person is already assigned to this task."
          : "That action failed.";

    await db.from("ai_actions").update({ status: "failed", result: { error: message }, resolved_at: new Date().toISOString() }).eq("id", id);

    const admin = createAdminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin as any)
      .from("messages")
      .update({ metadata: { is_ai: true, action_id: id, action_type: action.action_type, action_summary: message, action_status: "failed" } })
      .eq("id", action.message_id);

    return ok({ status: "failed", message });
  }

  await db.from("ai_actions").update({ status: "executed", result, resolved_at: new Date().toISOString() }).eq("id", id);

  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin as any)
    .from("messages")
    .update({
      metadata: {
        is_ai: true,
        action_id: id,
        action_type: action.action_type,
        action_summary: "Done.",
        action_status: "executed",
      },
    })
    .eq("id", action.message_id);

  return ok({ status: "executed", result });
});
