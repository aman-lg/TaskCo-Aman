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
        const { assignee_ids, ...taskFields } = payload as { assignee_ids?: string[] } & Record<string, unknown>;
        const { data, error } = await db
          .from("tasks")
          .insert({ ...taskFields, created_by: user.id })
          .select("id, name, project_id")
          .single();
        if (error) throw error;
        after(() => upsertEmbedding("task", data.id, data.project_id, taskEmbeddingContent(data.name, taskFields.description as string | undefined)));

        let assignedCount = 0;
        if (Array.isArray(assignee_ids) && assignee_ids.length > 0) {
          const rows = assignee_ids.map((uid) => ({ task_id: data.id, user_id: uid, assigned_by: user.id }));
          // upsert + ignoreDuplicates: a brand-new task shouldn't have any
          // existing assignees, but this keeps the whole batch from failing
          // atomically over one bad id the way a plain insert would.
          const { data: assigned, error: assignErr } = await db
            .from("task_assignees")
            .upsert(rows, { onConflict: "task_id,user_id", ignoreDuplicates: true })
            .select("user_id");
          if (assignErr) console.error("[ai-actions confirm] assignee insert failed", assignErr);
          else assignedCount = assigned?.length ?? 0;
        }
        result = { task_id: data.id, name: data.name, assigned_count: assignedCount };
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
        const { task_id, user_ids } = payload as { task_id: string; user_ids: string[] };
        const rows = (user_ids ?? []).map((uid) => ({ task_id, user_id: uid, assigned_by: user.id }));
        const { data, error } = await db
          .from("task_assignees")
          .upsert(rows, { onConflict: "task_id,user_id", ignoreDuplicates: true })
          .select("user_id");
        if (error) throw error;
        result = { task_id, assigned: (data ?? []).map((d: { user_id: string }) => d.user_id) };
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
