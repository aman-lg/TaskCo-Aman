import { type NextRequest } from "next/server";
import { withAuth } from "@/lib/api/handler";
import { ok, ApiError } from "@/lib/api/response";
import { createClient } from "@/lib/supabase/server";
import { isValidUUID } from "@/lib/utils/validate";

// POST /api/chat/messages/[id]/read — mark message as read
export const POST = withAuth(async (_req: NextRequest, ctx) => {
  const { id } = (ctx.params as unknown as { id: string });
  if (!isValidUUID(id)) return ApiError.badRequest("Invalid message ID.");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return ApiError.unauthorized();

  const now = new Date().toISOString();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("message_reads")
    .upsert(
      { message_id: id, user_id: user.id, delivered_at: now, read_at: now },
      { onConflict: "message_id,user_id" },
    );

  if (error) {
    console.error("[chat/messages/read POST]", error);
    return ApiError.internal();
  }

  return ok({ read: true });
});
