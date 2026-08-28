import { type NextRequest } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/api/handler";
import { ok, ApiError } from "@/lib/api/response";
import { createClient } from "@/lib/supabase/server";
import { isValidUUID } from "@/lib/utils/validate";
import { getConversations, ensureSelfConversation, ensureAiConversation } from "@/lib/queries/chat";

const createSchema = z.object({
  type: z.enum(["direct", "group"]),
  member_ids: z.array(z.string().uuid()).min(1).max(50),
  name: z.string().trim().min(1).max(100).optional(),
  description: z.string().trim().max(500).optional(),
});

// GET /api/chat/conversations — list all conversations for current user
// Also bootstraps the self-conversation (My Notes) on first call.
export const GET = withAuth(async (_req, ctx) => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return ApiError.unauthorized();

  // Ensure "My Notes" and "Tasko AI" exist
  await ensureSelfConversation(supabase, user.id);
  await ensureAiConversation(supabase, user.id);

  const conversations = await getConversations(supabase, user.id);
  return ok(conversations);
});

// POST /api/chat/conversations — create a direct or group conversation
export const POST = withAuth(async (req: NextRequest) => {
  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return ApiError.badRequest(parsed.error.issues[0].message);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return ApiError.unauthorized();

  const { type, member_ids, name, description } = parsed.data;

  if (type === "direct") {
    // member_ids should have exactly 1 other user
    if (member_ids.length !== 1) {
      return ApiError.badRequest("Direct conversation requires exactly 1 other user.");
    }
    const otherId = member_ids[0];
    if (!isValidUUID(otherId)) return ApiError.badRequest("Invalid user ID.");
    if (otherId === user.id) return ApiError.badRequest("Cannot start a DM with yourself. Use My Notes instead.");

    // Check for existing direct conversation between the two users
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existingMember } = await (supabase as any)
      .from("conversation_members")
      .select("conversation_id, conversations:conversation_id!inner(id, type)")
      .eq("user_id", user.id)
      .eq("conversations.type", "direct");

    if (existingMember && existingMember.length > 0) {
      const myConvIds = existingMember.map((r: { conversation_id: string }) => r.conversation_id);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: otherMember } = await (supabase as any)
        .from("conversation_members")
        .select("conversation_id")
        .eq("user_id", otherId)
        .in("conversation_id", myConvIds)
        .limit(1)
        .single();

      if (otherMember?.conversation_id) {
        // Return existing conversation
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: existing } = await (supabase as any)
          .from("conversations")
          .select("*")
          .eq("id", otherMember.conversation_id)
          .single();
        return ok({ conversation: existing, existing: true });
      }
    }
  }

  if (type === "group") {
    if (!name) return ApiError.badRequest("Group name is required.");
    if (member_ids.length < 1) return ApiError.badRequest("Group requires at least 1 other member.");
    for (const id of member_ids) {
      if (!isValidUUID(id)) return ApiError.badRequest(`Invalid user ID: ${id}`);
    }
  }

  // Create conversation
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: conv, error: convError } = await (supabase as any)
    .from("conversations")
    .insert({ type, name: name ?? null, description: description ?? null, created_by: user.id })
    .select("*")
    .single();

  if (convError || !conv) {
    console.error("[chat/conversations POST]", convError);
    return ApiError.internal();
  }

  // Add owner row first — the cm_insert RLS policy requires the current user to already
  // be an owner/admin before other members can be added (EXISTS subquery in the policy).
  // A single batch INSERT won't see its own in-progress rows, so owner must be committed first.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: ownerError } = await (supabase as any)
    .from("conversation_members")
    .insert({ conversation_id: conv.id, user_id: user.id, role: "owner", added_by: user.id });

  if (ownerError) {
    console.error("[chat/conversations POST owner]", ownerError);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("conversations").delete().eq("id", conv.id);
    return ApiError.internal();
  }

  // Now insert other members — owner row exists, so the EXISTS policy check passes.
  const otherIds = member_ids.filter(id => id !== user.id);
  if (otherIds.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: memberError } = await (supabase as any)
      .from("conversation_members")
      .insert(otherIds.map(id => ({ conversation_id: conv.id, user_id: id, role: "member", added_by: user.id })));

    if (memberError) {
      console.error("[chat/conversations POST members]", memberError);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from("conversations").delete().eq("id", conv.id);
      return ApiError.internal();
    }
  }

  // System message for group creation
  if (type === "group") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: profile } = await (supabase as any)
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .single();
    const creatorName = (profile as { full_name?: string } | null)?.full_name ?? "Someone";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("messages").insert({
      conversation_id: conv.id,
      sender_id: user.id,
      type: "system",
      content: `${creatorName} created this group`,
    });
  }

  return ok({ conversation: conv, existing: false });
});
