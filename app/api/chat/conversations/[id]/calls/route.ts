import { type NextRequest } from "next/server";
import { withAuth } from "@/lib/api/handler";
import { ok, ApiError } from "@/lib/api/response";
import { createClient } from "@/lib/supabase/server";
import { isValidUUID } from "@/lib/utils/validate";

const ROOM_TTL_SECONDS = 60 * 60; // rooms auto-expire 1 hour after creation

/**
 * POST /api/chat/conversations/[id]/calls
 * Starts a voice call in a conversation: creates a Daily.co room
 * server-side (the API key never reaches the client) and drops a "call"
 * message into the conversation carrying the room URL. Delivery to the
 * other person reuses the exact same message pipeline as any other
 * message — realtime INSERT, the resync fallback, all of it — nothing
 * calling-specific needed there.
 */
export const POST = withAuth(async (_req: NextRequest, { user, params }) => {
  const id = params?.id;
  if (!id || !isValidUUID(id)) return ApiError.badRequest("Invalid conversation ID.");

  const supabase = await createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: member } = await (supabase as any)
    .from("conversation_members")
    .select("user_id")
    .eq("conversation_id", id)
    .eq("user_id", user.id)
    .single();
  if (!member) return ApiError.forbidden("Not a member of this conversation.");

  const dailyKey = process.env.DAILY_API_KEY;
  if (!dailyKey) {
    console.error("[chat/calls POST] DAILY_API_KEY is not set");
    return ApiError.internal();
  }

  const roomRes = await fetch("https://api.daily.co/v1/rooms", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${dailyKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      properties: {
        start_video_off: true,
        start_audio_off: false,
        enable_screenshare: false,
        enable_chat: false,
        exp: Math.floor(Date.now() / 1000) + ROOM_TTL_SECONDS,
        eject_at_room_exp: true,
      },
    }),
  });

  if (!roomRes.ok) {
    const body = await roomRes.text().catch(() => "");
    console.error("[chat/calls POST] Daily room creation failed", roomRes.status, body);
    return ApiError.internal();
  }

  const room = await roomRes.json();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: msg, error: msgError } = await (supabase as any)
    .from("messages")
    .insert({
      conversation_id: id,
      sender_id: user.id,
      type: "call",
      content: null,
      metadata: { room_url: room.url, room_name: room.name },
    })
    .select(`
      *,
      sender:profiles!sender_id(id, full_name, avatar_url, email)
    `)
    .single();

  if (msgError || !msg) {
    console.error("[chat/calls POST] message insert failed", msgError);
    return ApiError.internal();
  }

  return ok({ message: msg, room_url: room.url }, 201);
});
