import { type NextRequest } from "next/server";
import { withAuth } from "@/lib/api/handler";
import { ok, ApiError } from "@/lib/api/response";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidUUID } from "@/lib/utils/validate";

// POST /api/chat/ai-actions/[id]/cancel
export const POST = withAuth(async (_req: NextRequest, ctx) => {
  const { id } = (ctx.params as unknown as { id: string });
  if (!isValidUUID(id)) return ApiError.badRequest("Invalid action ID.");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return ApiError.unauthorized();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: action } = await (supabase as any)
    .from("ai_actions")
    .select("id, message_id, status")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!action) return ApiError.notFound("Action not found.");
  if (action.status !== "pending") return ApiError.badRequest("This action has already been resolved.");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from("ai_actions")
    .update({ status: "cancelled", resolved_at: new Date().toISOString() })
    .eq("id", id);

  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin as any)
    .from("messages")
    .update({ metadata: { is_ai: true, action_id: id, action_status: "cancelled", action_summary: "Cancelled." } })
    .eq("id", action.message_id);

  return ok({ status: "cancelled" });
});
