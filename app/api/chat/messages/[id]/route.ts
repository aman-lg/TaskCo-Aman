import { type NextRequest } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/api/handler";
import { ok, ApiError } from "@/lib/api/response";
import { createClient } from "@/lib/supabase/server";
import { isValidUUID } from "@/lib/utils/validate";

const editSchema = z.object({ content: z.string().trim().min(1).max(10000) });
const deleteSchema = z.object({ scope: z.enum(["me", "everyone"]) });

// GET /api/chat/messages/[id]
export const GET = withAuth(async (_req: NextRequest, ctx) => {
  const { id } = (ctx.params as unknown as { id: string });
  if (!isValidUUID(id)) return ApiError.badRequest("Invalid message ID.");

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("messages")
    .select("*, sender:profiles!sender_id(id, full_name, avatar_url), reactions:message_reactions(*), reads:message_reads(*)")
    .eq("id", id)
    .single();

  if (error || !data) return ApiError.notFound("Message not found.");
  return ok({ message: data });
});

// PATCH /api/chat/messages/[id] — edit message
export const PATCH = withAuth(async (req: NextRequest, ctx) => {
  const { id } = (ctx.params as unknown as { id: string });
  if (!isValidUUID(id)) return ApiError.badRequest("Invalid message ID.");

  const body = await req.json().catch(() => null);
  const parsed = editSchema.safeParse(body);
  if (!parsed.success) return ApiError.badRequest(parsed.error.issues[0].message);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return ApiError.unauthorized();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: msg } = await (supabase as any)
    .from("messages")
    .select("id, sender_id, type, content, created_at, is_forwarded")
    .eq("id", id)
    .single();

  if (!msg) return ApiError.notFound("Message not found.");
  if (msg.sender_id !== user.id) return ApiError.forbidden("You can only edit your own messages.");
  if (msg.type !== "text") return ApiError.badRequest("Only text messages can be edited.");
  if (msg.is_forwarded) return ApiError.badRequest("Forwarded messages cannot be edited.");

  // 15-minute edit window
  const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000);
  if (new Date(msg.created_at) < fifteenMinsAgo) {
    return ApiError.badRequest("Messages can only be edited within 15 minutes of sending.");
  }

  // Save old content
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from("message_edits").insert({
    message_id: id,
    old_content: msg.content,
  });

  // Update
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: updated, error } = await (supabase as any)
    .from("messages")
    .update({
      content: parsed.data.content,
      is_edited: true,
      edited_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    console.error("[chat/messages PATCH]", error);
    return ApiError.internal();
  }

  return ok({ message: updated });
});

// DELETE /api/chat/messages/[id]
export const DELETE = withAuth(async (req: NextRequest, ctx) => {
  const { id } = (ctx.params as unknown as { id: string });
  if (!isValidUUID(id)) return ApiError.badRequest("Invalid message ID.");

  const body = await req.json().catch(() => null);
  const parsed = deleteSchema.safeParse(body);
  if (!parsed.success) return ApiError.badRequest(parsed.error.issues[0].message);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return ApiError.unauthorized();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: msg } = await (supabase as any)
    .from("messages")
    .select("id, sender_id, conversation_id, created_at")
    .eq("id", id)
    .single();

  if (!msg) return ApiError.notFound("Message not found.");

  if (parsed.data.scope === "me") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from("messages")
      .update({ deleted_for_me: [user.id] })
      .eq("id", id);

    if (error) {
      console.error("[chat/messages DELETE me]", error);
      return ApiError.internal();
    }
    return ok({ deleted: "me" });
  }

  // Delete for everyone — must be sender (within 24h) or group admin
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const isSender = msg.sender_id === user.id;
  const withinWindow = new Date(msg.created_at) > twentyFourHoursAgo;

  if (!isSender || !withinWindow) {
    // Check if admin
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: member } = await (supabase as any)
      .from("conversation_members")
      .select("role")
      .eq("conversation_id", msg.conversation_id)
      .eq("user_id", user.id)
      .single();

    if (!member || !["owner", "admin"].includes(member.role)) {
      return ApiError.forbidden("You cannot delete this message for everyone.");
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("messages")
    .update({ deleted_at: new Date().toISOString(), content: null, metadata: null })
    .eq("id", id);

  if (error) {
    console.error("[chat/messages DELETE everyone]", error);
    return ApiError.internal();
  }

  return ok({ deleted: "everyone" });
});
