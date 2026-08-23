import { type NextRequest } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/api/handler";
import { ok, ApiError } from "@/lib/api/response";
import { createClient } from "@/lib/supabase/server";
import { isValidUUID } from "@/lib/utils/validate";

const reactSchema = z.object({
  emoji: z.string().min(1).max(8),
});

// POST /api/chat/messages/[id]/react — add or change reaction (one per user per message)
export const POST = withAuth(async (req: NextRequest, ctx) => {
  const { id } = (ctx.params as unknown as { id: string });
  if (!isValidUUID(id)) return ApiError.badRequest("Invalid message ID.");

  const body = await req.json().catch(() => null);
  const parsed = reactSchema.safeParse(body);
  if (!parsed.success) return ApiError.badRequest(parsed.error.issues[0].message);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return ApiError.unauthorized();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("message_reactions")
    .upsert(
      { message_id: id, user_id: user.id, emoji: parsed.data.emoji },
      { onConflict: "message_id,user_id" },
    );

  if (error) {
    console.error("[chat/messages/react POST]", error);
    return ApiError.internal();
  }

  return ok({ reacted: true });
});

// DELETE /api/chat/messages/[id]/react — remove own reaction
export const DELETE = withAuth(async (_req: NextRequest, ctx) => {
  const { id } = (ctx.params as unknown as { id: string });
  if (!isValidUUID(id)) return ApiError.badRequest("Invalid message ID.");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return ApiError.unauthorized();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("message_reactions")
    .delete()
    .eq("message_id", id)
    .eq("user_id", user.id);

  if (error) {
    console.error("[chat/messages/react DELETE]", error);
    return ApiError.internal();
  }

  return ok({ removed: true });
});
