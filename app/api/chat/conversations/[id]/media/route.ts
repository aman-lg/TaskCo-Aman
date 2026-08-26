import { type NextRequest } from "next/server";
import { withAuth } from "@/lib/api/handler";
import { ok, ApiError } from "@/lib/api/response";
import { createClient } from "@/lib/supabase/server";
import { isValidUUID } from "@/lib/utils/validate";

// GET /api/chat/conversations/[id]/media — every image/video/document ever
// shared in this conversation, newest first, for the info panel's shared-media
// tab. RLS (msg_select) already scopes this to members and honors per-user
// "delete for me"; deleted-for-everyone messages have no metadata left so
// they naturally can't appear here even though the row itself stays visible.
export const GET = withAuth(async (_req: NextRequest, ctx) => {
  const { id } = (ctx.params as unknown as { id: string });
  if (!isValidUUID(id)) return ApiError.badRequest("Invalid conversation ID.");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return ApiError.unauthorized();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: member } = await (supabase as any)
    .from("conversation_members")
    .select("user_id")
    .eq("conversation_id", id)
    .eq("user_id", user.id)
    .single();

  if (!member) return ApiError.forbidden("Not a member of this conversation.");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("messages")
    .select("id, type, metadata, created_at, sender_id, sender:profiles!sender_id(id, full_name, avatar_url)")
    .eq("conversation_id", id)
    .in("type", ["image", "video", "document"])
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    console.error("[chat/conversations/[id]/media GET]", error);
    return ApiError.internal();
  }

  return ok({ items: data ?? [] });
});
