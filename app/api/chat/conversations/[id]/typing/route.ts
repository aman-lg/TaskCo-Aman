import { type NextRequest } from "next/server";
import { withAuth } from "@/lib/api/handler";
import { ok, ApiError } from "@/lib/api/response";
import { createClient } from "@/lib/supabase/server";
import { isValidUUID } from "@/lib/utils/validate";

/**
 * POST /api/chat/conversations/[id]/typing
 * Upserts "I'm typing right now" as a real row instead of an ephemeral
 * presence broadcast — see 038_typing_status.sql for why. There's no
 * explicit stop/DELETE: the client treats any row older than a few
 * seconds as no longer typing, so a burst of keystrokes just keeps
 * refreshing updated_at and the row goes stale on its own once they stop.
 */
export const POST = withAuth(async (_req: NextRequest, { user, params }) => {
  const id = params?.id;
  if (!id || !isValidUUID(id)) return ApiError.badRequest("Invalid conversation ID.");

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("typing_status")
    .upsert(
      { conversation_id: id, user_id: user.id, updated_at: new Date().toISOString() },
      { onConflict: "conversation_id,user_id" },
    );

  if (error) {
    console.error("[chat/typing POST]", error);
    return ApiError.internal();
  }
  return ok({ ok: true });
});
