import { type NextRequest, after } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/api/handler";
import { ok, ApiError } from "@/lib/api/response";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidUUID } from "@/lib/utils/validate";
import { getMessages } from "@/lib/queries/chat";
import { stripMentionTokens } from "@/lib/utils/chat";
import { generateAiReply } from "@/lib/ai/reply";

const pollInputSchema = z.object({
  question: z.string().min(1).max(255),
  options: z.array(z.string().min(1).max(200)).min(2).max(10),
  is_anonymous: z.boolean().default(false),
  is_multiple: z.boolean().default(false),
  closes_at: z.string().optional(),
});

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
  // user_ids @mentioned in this message's content — only meaningful for
  // type === "text", validated against actual conversation membership
  // server-side before any notification is created.
  mentions: z.array(z.string().uuid()).optional(),
  // Poll definition, only meaningful when type === "poll" — the message
  // itself is never persisted with this; it's consumed to create real
  // polls/poll_options rows instead (see POST handler below).
  poll: pollInputSchema.optional(),
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

  const messages = await getMessages(supabase, id, limit, before, user.id);
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
  const mentionIds = metadata?.mentions ?? [];

  if (type === "text" && (!content || content.trim() === "")) {
    return ApiError.badRequest("Text messages cannot be empty.");
  }
  if (type === "poll" && !metadata?.poll) {
    return ApiError.badRequest("Poll definition is required.");
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
    .select("type, admin_only_messages, slow_mode_seconds")
    .eq("id", id)
    .single();

  if (conv?.admin_only_messages && !["owner", "admin"].includes(member.role)) {
    return ApiError.forbidden("Only admins can send messages in this group.");
  }

  // Poll data lives in dedicated polls/poll_options tables, not the
  // message's own metadata — strip it out before inserting the message row.
  const { poll: pollInput, ...restMetadata } = metadata ?? {};
  const messageMetadata = Object.keys(restMetadata).length > 0 ? restMetadata : null;

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
      metadata: messageMetadata,
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

  // Create the real poll + options rows now that we have a message id to
  // attach them to, and shape the response the same way getMessages() would
  // for an existing poll (options with vote_count, user_votes) so the client
  // doesn't need a separate re-fetch to render it.
  if (type === "poll" && pollInput) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: poll, error: pollError } = await (supabase as any)
      .from("polls")
      .insert({
        message_id: msg.id,
        question: pollInput.question,
        is_anonymous: pollInput.is_anonymous,
        is_multiple: pollInput.is_multiple,
        closes_at: pollInput.closes_at ? new Date(pollInput.closes_at).toISOString() : null,
      })
      .select("*")
      .single();

    if (pollError || !poll) {
      console.error("[chat/messages POST] poll insert failed", pollError);
      return ApiError.internal();
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: options, error: optionsError } = await (supabase as any)
      .from("poll_options")
      .insert(pollInput.options.map((text: string, position: number) => ({ poll_id: poll.id, text, position })))
      .select("id, text, position");

    if (optionsError || !options) {
      console.error("[chat/messages POST] poll options insert failed", optionsError);
      return ApiError.internal();
    }

    msg.poll = {
      ...poll,
      options: options
        .sort((a: { position: number }, b: { position: number }) => a.position - b.position)
        .map((o: { id: string; text: string; position: number }) => ({ ...o, vote_count: 0 })),
      user_votes: [],
    };
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

  // @mention notifications — notifications has no client insert policy (see
  // 004_rls.sql), so this has to go through the admin client. Only notify
  // ids that are actually members of this conversation, never trust the
  // client's list as-is.
  if (type === "text" && mentionIds.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: allMembers } = await (supabase as any)
      .from("conversation_members")
      .select("user_id")
      .eq("conversation_id", id);

    const memberIds = new Set((allMembers ?? []).map((m: { user_id: string }) => m.user_id));
    const targets = Array.from(new Set(mentionIds)).filter((uid) => uid !== user.id && memberIds.has(uid));

    if (targets.length > 0) {
      const senderName = msg.sender?.full_name ?? msg.sender?.email ?? "Someone";
      const admin = createAdminClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: notifErr } = await (admin as any).from("notifications").insert(
        targets.map((uid) => ({
          user_id: uid,
          type: "mention",
          title: `${senderName} mentioned you`,
          body: stripMentionTokens(content ?? "").slice(0, 200),
          entity_type: "message",
          entity_id: msg.id,
        }))
      );
      if (notifErr) console.error("[chat/messages POST] mention notification insert failed", notifErr);
    }
  }

  // Ask Tasko — triggered server-side (via after(), so it keeps running to
  // completion even if the sender navigates away or closes the tab right
  // after sending) rather than depending on the client staying on the page
  // to fire a follow-up request. The reply lands as an ordinary message row,
  // so it reaches the client the same way any other new message would
  // (realtime + the existing resync fallback) — no special client-side
  // trigger needed at all.
  if (conv?.type === "ai" && type === "text") {
    after(() => generateAiReply(supabase, id, user.id).then((r) => {
      if (!r.ok) console.error("[chat/messages POST] generateAiReply failed", r.error);
    }));
  }

  return ok({ message: msg });
});
