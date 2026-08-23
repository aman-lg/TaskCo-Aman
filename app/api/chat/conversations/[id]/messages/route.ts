import { type NextRequest } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/api/handler";
import { ok, ApiError } from "@/lib/api/response";
import { createClient } from "@/lib/supabase/server";
import { isValidUUID } from "@/lib/utils/validate";
import { getMessages } from "@/lib/queries/chat";

const metadataSchema = z.object({
  url: z.string().url().optional(),
  filename: z.string().optional(),
  size: z.number().optional(),
  mime: z.string().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  duration: z.number().optional(),
  thumbnail: z.string().optional(),
  waveform: z.array(z.number()).optional(),
}).optional();

const sendSchema = z.object({
  content: z.string().max(10000).optional(),
  type: z.enum(["text","image","video","audio","voice_note","document","sticker","gif","poll","system","contact"]).default("text"),
  reply_to_id: z.string().uuid().optional(),
  forwarded_from_id: z.string().uuid().optional(),
  is_forwarded: z.boolean().optional(),
  metadata: metadataSchema,
  disappears_at: z.string().datetime().optional(),
});

// GET /api/chat/conversations/[id]/messages — paginated messages
export const GET = withAuth(async (req: NextRequest, ctx) => {
  const { id } = (ctx.params as unknown as { id: string });
  if (!isValidUUID(id)) return ApiError.badRequest("Invalid conversation ID.");

  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 100);
  const before = searchParams.get("before") ?? undefined;
  const search = searchParams.get("search");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return ApiError.unauthorized();

  // Verify membership
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: member } = await (supabase as any)
    .from("conversation_members")
    .select("user_id")
    .eq("conversation_id", id)
    .eq("user_id", user.id)
    .single();

  if (!member) return ApiError.forbidden("Not a member of this conversation.");

  if (search) {
    // Full-text search
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: results } = await (supabase as any)
      .from("messages")
      .select("*, sender:profiles!sender_id(id, full_name, avatar_url, email)")
      .eq("conversation_id", id)
      .is("deleted_at", null)
      .ilike("content", `%${search}%`)
      .order("created_at", { ascending: false })
      .limit(50);

    return ok({ messages: results ?? [], has_more: false });
  }

  const messages = await getMessages(supabase, id, limit, before);
  const has_more = messages.length === limit;

  // Mark delivered for all messages from others
  if (messages.length > 0) {
    const otherIds = messages
      .filter(m => m.sender_id && m.sender_id !== user.id)
      .map(m => m.id);

    if (otherIds.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from("message_reads")
        .upsert(
          otherIds.map(msgId => ({
            message_id: msgId,
            user_id: user.id,
            delivered_at: new Date().toISOString(),
          })),
          { onConflict: "message_id,user_id", ignoreDuplicates: true },
        );
    }
  }

  return ok({ messages, has_more });
});

// POST /api/chat/conversations/[id]/messages — send a message
export const POST = withAuth(async (req: NextRequest, ctx) => {
  const { id } = (ctx.params as unknown as { id: string });
  if (!isValidUUID(id)) return ApiError.badRequest("Invalid conversation ID.");

  const body = await req.json().catch(() => null);
  const parsed = sendSchema.safeParse(body);
  if (!parsed.success) return ApiError.badRequest(parsed.error.issues[0].message);

  const { type, content, reply_to_id, forwarded_from_id, is_forwarded, metadata, disappears_at } = parsed.data;

  if (type === "text" && (!content || content.trim() === "")) {
    return ApiError.badRequest("Text messages cannot be empty.");
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return ApiError.unauthorized();

  // Verify membership
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: member } = await (supabase as any)
    .from("conversation_members")
    .select("user_id, role")
    .eq("conversation_id", id)
    .eq("user_id", user.id)
    .single();

  if (!member) return ApiError.forbidden("Not a member of this conversation.");

  // Check admin-only mode
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: conv } = await (supabase as any)
    .from("conversations")
    .select("admin_only_messages, slow_mode_seconds")
    .eq("id", id)
    .single();

  if (conv?.admin_only_messages && !["owner", "admin"].includes(member.role)) {
    return ApiError.forbidden("Only admins can send messages in this group.");
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: msg, error: msgError } = await (supabase as any)
    .from("messages")
    .insert({
      conversation_id: id,
      sender_id: user.id,
      type,
      content: content?.trim() ?? null,
      reply_to_id: reply_to_id ?? null,
      forwarded_from_id: forwarded_from_id ?? null,
      is_forwarded: is_forwarded ?? false,
      metadata: metadata ?? null,
      disappears_at: disappears_at ?? null,
    })
    .select(`
      *,
      sender:profiles!sender_id(id, full_name, avatar_url, email)
    `)
    .single();

  if (msgError || !msg) {
    console.error("[chat/messages POST]", msgError);
    return ApiError.internal();
  }

  // Mark as read for sender
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from("message_reads")
    .insert({
      message_id: msg.id,
      user_id: user.id,
      delivered_at: new Date().toISOString(),
      read_at: new Date().toISOString(),
    });

  // Update last_read_at for sender
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from("conversation_members")
    .update({ last_read_at: new Date().toISOString() })
    .eq("conversation_id", id)
    .eq("user_id", user.id);

  return ok({ message: msg });
});
