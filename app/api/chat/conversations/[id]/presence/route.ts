import { type NextRequest } from "next/server";
import { withAuth } from "@/lib/api/handler";
import { ok, ApiError } from "@/lib/api/response";
import { createClient } from "@/lib/supabase/server";
import { isValidUUID } from "@/lib/utils/validate";

// GET /api/chat/conversations/[id]/presence
// Just the other member's live last_seen_at, for direct/self conversations —
// deliberately separate from the full conversation GET (which also fetches
// 50 messages and marks-read) so this can be polled cheaply and often. The
// conversation object handed to the open chat window is otherwise a static
// snapshot from page load: last_seen_at inside it never changes again for
// as long as the window stays open, which is why "Last Active" could freeze
// on a stale value (or never move off it) even while the DB's own value kept
// updating from the other person's own heartbeat.
export const GET = withAuth(async (_req: NextRequest, ctx) => {
  const { id } = (ctx.params as unknown as { id: string });
  if (!isValidUUID(id)) return ApiError.badRequest("Invalid conversation ID.");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return ApiError.unauthorized();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: members } = await (supabase as any)
    .from("conversation_members")
    .select("user_id, profile:profiles!user_id(last_seen_at)")
    .eq("conversation_id", id);

  if (!members || members.length === 0) return ApiError.notFound("Conversation not found.");

  const other = members.find((m: { user_id: string }) => m.user_id !== user.id) ?? members[0];
  return ok({ last_seen_at: other?.profile?.last_seen_at ?? null });
});
