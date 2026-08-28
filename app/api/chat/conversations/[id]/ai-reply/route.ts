import { type NextRequest } from "next/server";
import { withAuth } from "@/lib/api/handler";
import { ok, ApiError } from "@/lib/api/response";
import { createClient } from "@/lib/supabase/server";
import { isValidUUID } from "@/lib/utils/validate";
import { generateAiReply } from "@/lib/ai/reply";

// POST /api/chat/conversations/[id]/ai-reply
// Kept for a possible future manual-retry affordance — normal sends no
// longer call this from the client. The messages route now triggers the
// same generateAiReply() itself via after(), so a reply keeps generating
// even if the user navigates away right after sending (this endpoint used
// to be the ONLY trigger, tied to the sending tab staying open — see
// app/api/chat/conversations/[id]/messages/route.ts).
export const POST = withAuth(async (_req: NextRequest, ctx) => {
  const { id } = (ctx.params as unknown as { id: string });
  if (!isValidUUID(id)) return ApiError.badRequest("Invalid conversation ID.");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return ApiError.unauthorized();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: conv } = await (supabase as any)
    .from("conversations")
    .select("id, type, created_by")
    .eq("id", id)
    .single();

  if (!conv || conv.type !== "ai" || conv.created_by !== user.id) {
    return ApiError.forbidden("Not your Tasko conversation.");
  }

  const result = await generateAiReply(supabase, id, user.id);
  if (!result.ok) {
    if (result.error === "Nothing to reply to.") return ApiError.badRequest(result.error);
    return ApiError.internal();
  }

  return ok({ message: result.message });
});
