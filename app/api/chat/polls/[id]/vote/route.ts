import { type NextRequest } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/api/handler";
import { ok, ApiError } from "@/lib/api/response";
import { createClient } from "@/lib/supabase/server";
import { isValidUUID } from "@/lib/utils/validate";

const voteSchema = z.object({
  option_ids: z.array(z.string().uuid()).max(10),
});

// POST /api/chat/polls/[id]/vote
// Replaces the caller's own votes on this poll with option_ids (empty array
// retracts their vote entirely). RLS on poll_votes only requires
// user_id = auth.uid(), so membership/poll-state checks happen here.
export const POST = withAuth(async (req: NextRequest, { user, params }) => {
  const pollId = params?.id;
  if (!pollId || !isValidUUID(pollId)) return ApiError.badRequest("Invalid poll ID");

  const body = await req.json().catch(() => null);
  const parsed = voteSchema.safeParse(body);
  if (!parsed.success) return ApiError.badRequest(parsed.error.issues[0]?.message ?? "Invalid input");
  const { option_ids } = parsed.data;

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const { data: poll, error: pollErr } = await db
    .from("polls")
    .select("id, is_multiple, closes_at, closed_at, message_id, messages!inner(conversation_id)")
    .eq("id", pollId)
    .single();
  if (pollErr || !poll) return ApiError.notFound("Poll not found");

  // Membership check — msg_select's own RLS already scopes the join above to
  // conversations the caller is in, so a non-member simply gets a 404 here.
  if (poll.closed_at || (poll.closes_at && new Date(poll.closes_at) <= new Date())) {
    return ApiError.badRequest("This poll is closed.");
  }
  if (!poll.is_multiple && option_ids.length > 1) {
    return ApiError.badRequest("This poll only allows one choice.");
  }

  if (option_ids.length > 0) {
    const { data: validOptions } = await db
      .from("poll_options")
      .select("id")
      .eq("poll_id", pollId)
      .in("id", option_ids);
    if (!validOptions || validOptions.length !== option_ids.length) {
      return ApiError.badRequest("One or more options don't belong to this poll.");
    }
  }

  const { error: deleteErr } = await db.from("poll_votes").delete().eq("poll_id", pollId).eq("user_id", user.id);
  if (deleteErr) { console.error("[polls/vote] clear failed", deleteErr); return ApiError.internal(); }

  if (option_ids.length > 0) {
    const { error: insertErr } = await db
      .from("poll_votes")
      .insert(option_ids.map((option_id) => ({ poll_id: pollId, option_id, user_id: user.id })));
    if (insertErr) { console.error("[polls/vote] insert failed", insertErr); return ApiError.internal(); }
  }

  return ok({ voted: option_ids });
});
