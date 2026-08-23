import { type NextRequest } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/api/handler";
import { ok, ApiError } from "@/lib/api/response";
import { createClient } from "@/lib/supabase/server";
import { isValidUUID } from "@/lib/utils/validate";
import { getConversationById, getMessages } from "@/lib/queries/chat";

const updateSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  description: z.string().trim().max(500).optional(),
  avatar_url: z.string().url().optional().nullable(),
  admin_only_messages: z.boolean().optional(),
  slow_mode_seconds: z.number().int().min(0).max(300).optional().nullable(),
});

// GET /api/chat/conversations/[id]
export const GET = withAuth(async (_req: NextRequest, ctx) => {
  const { id } = (ctx.params as unknown as { id: string });
  if (!isValidUUID(id)) return ApiError.badRequest("Invalid conversation ID.");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return ApiError.unauthorized();

  const [conversation, messages] = await Promise.all([
    getConversationById(supabase, id),
    getMessages(supabase, id, 50),
  ]);

  if (!conversation) return ApiError.notFound("Conversation not found.");

  // Mark as read
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from("conversation_members")
    .update({ last_read_at: new Date().toISOString() })
    .eq("conversation_id", id)
    .eq("user_id", user.id);

  return ok({ conversation, messages });
});

// PATCH /api/chat/conversations/[id]
export const PATCH = withAuth(async (req: NextRequest, ctx) => {
  const { id } = (ctx.params as unknown as { id: string });
  if (!isValidUUID(id)) return ApiError.badRequest("Invalid conversation ID.");

  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return ApiError.badRequest(parsed.error.issues[0].message);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return ApiError.unauthorized();

  // Must be owner or admin
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: myMember } = await (supabase as any)
    .from("conversation_members")
    .select("role")
    .eq("conversation_id", id)
    .eq("user_id", user.id)
    .single();

  if (!myMember || !["owner", "admin"].includes(myMember.role)) {
    return ApiError.forbidden("Only admins can update this conversation.");
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: updated, error } = await (supabase as any)
    .from("conversations")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    console.error("[chat/conversations PATCH]", error);
    return ApiError.internal();
  }

  return ok({ conversation: updated });
});

// DELETE /api/chat/conversations/[id] — leave conversation
export const DELETE = withAuth(async (_req: NextRequest, ctx) => {
  const { id } = (ctx.params as unknown as { id: string });
  if (!isValidUUID(id)) return ApiError.badRequest("Invalid conversation ID.");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return ApiError.unauthorized();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: myMember } = await (supabase as any)
    .from("conversation_members")
    .select("role")
    .eq("conversation_id", id)
    .eq("user_id", user.id)
    .single();

  if (!myMember) return ApiError.notFound("You are not a member of this conversation.");

  // If owner leaving a group: transfer ownership first
  if (myMember.role === "owner") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: others } = await (supabase as any)
      .from("conversation_members")
      .select("user_id, role, added_at")
      .eq("conversation_id", id)
      .neq("user_id", user.id)
      .order("added_at", { ascending: true });

    if (others && others.length > 0) {
      const nextOwner = (others as Array<{ user_id: string; role: string }>)
        .find(m => m.role === "admin") ?? others[0];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from("conversation_members")
        .update({ role: "owner" })
        .eq("conversation_id", id)
        .eq("user_id", nextOwner.user_id);
    } else {
      // Last member — delete the conversation
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from("conversations").delete().eq("id", id);
      return ok({ left: true, deleted: true });
    }
  }

  // Remove self
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("conversation_members")
    .delete()
    .eq("conversation_id", id)
    .eq("user_id", user.id);

  if (error) {
    console.error("[chat/conversations DELETE]", error);
    return ApiError.internal();
  }

  return ok({ left: true });
});
