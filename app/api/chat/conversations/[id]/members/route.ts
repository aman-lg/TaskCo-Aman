import { type NextRequest } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/api/handler";
import { ok, ApiError } from "@/lib/api/response";
import { createClient } from "@/lib/supabase/server";
import { isValidUUID } from "@/lib/utils/validate";

const addSchema = z.object({ user_id: z.string().uuid() });
const roleSchema = z.object({
  user_id: z.string().uuid(),
  role: z.enum(["admin", "member"]),
});

// GET /api/chat/conversations/[id]/members
export const GET = withAuth(async (_req: NextRequest, ctx) => {
  const { id } = (ctx.params as unknown as { id: string });
  if (!isValidUUID(id)) return ApiError.badRequest("Invalid conversation ID.");

  const supabase = await createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("conversation_members")
    .select("*, profile:profiles!user_id(id, full_name, avatar_url, email, last_seen_at)")
    .eq("conversation_id", id)
    .order("added_at", { ascending: true });

  if (error) {
    console.error("[chat/members GET]", error);
    return ApiError.internal();
  }
  return ok(data ?? []);
});

// POST /api/chat/conversations/[id]/members — add a member
export const POST = withAuth(async (req: NextRequest, ctx) => {
  const { id } = (ctx.params as unknown as { id: string });
  if (!isValidUUID(id)) return ApiError.badRequest("Invalid conversation ID.");

  const body = await req.json().catch(() => null);
  const parsed = addSchema.safeParse(body);
  if (!parsed.success) return ApiError.badRequest(parsed.error.issues[0].message);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return ApiError.unauthorized();

  // Must be admin/owner
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: myMember } = await (supabase as any)
    .from("conversation_members")
    .select("role")
    .eq("conversation_id", id)
    .eq("user_id", user.id)
    .single();

  if (!myMember || !["owner", "admin"].includes(myMember.role)) {
    return ApiError.forbidden("Only admins can add members.");
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("conversation_members")
    .insert({ conversation_id: id, user_id: parsed.data.user_id, role: "member", added_by: user.id });

  if (error) {
    console.error("[chat/members POST]", error);
    if (error.code === "23505") return ApiError.badRequest("User is already in this conversation.");
    return ApiError.internal();
  }

  // System message
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [{ data: adder }, { data: added }] = await Promise.all([
    (supabase as any).from("profiles").select("full_name").eq("id", user.id).single(),
    (supabase as any).from("profiles").select("full_name").eq("id", parsed.data.user_id).single(),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from("messages").insert({
    conversation_id: id,
    sender_id: user.id,
    type: "system",
    content: `${(adder as { full_name?: string } | null)?.full_name ?? "Someone"} added ${(added as { full_name?: string } | null)?.full_name ?? "someone"}`,
  });

  return ok({ added: true });
});

// DELETE /api/chat/conversations/[id]/members?user_id=...
export const DELETE = withAuth(async (req: NextRequest, ctx) => {
  const { id } = (ctx.params as unknown as { id: string });
  if (!isValidUUID(id)) return ApiError.badRequest("Invalid conversation ID.");

  const { searchParams } = new URL(req.url);
  const targetId = searchParams.get("user_id");
  if (!targetId || !isValidUUID(targetId)) return ApiError.badRequest("Invalid user_id param.");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return ApiError.unauthorized();

  const isSelf = targetId === user.id;

  if (!isSelf) {
    // Must be admin/owner to remove others
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: myMember } = await (supabase as any)
      .from("conversation_members")
      .select("role")
      .eq("conversation_id", id)
      .eq("user_id", user.id)
      .single();

    if (!myMember || !["owner", "admin"].includes(myMember.role)) {
      return ApiError.forbidden("Only admins can remove members.");
    }

    // Cannot remove the owner
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: target } = await (supabase as any)
      .from("conversation_members")
      .select("role")
      .eq("conversation_id", id)
      .eq("user_id", targetId)
      .single();

    if (target?.role === "owner") {
      return ApiError.badRequest("Cannot remove the group owner.");
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("conversation_members")
    .delete()
    .eq("conversation_id", id)
    .eq("user_id", targetId);

  if (error) {
    console.error("[chat/members DELETE]", error);
    return ApiError.internal();
  }

  // System message
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [{ data: actor }, { data: target }] = await Promise.all([
    (supabase as any).from("profiles").select("full_name").eq("id", user.id).single(),
    (supabase as any).from("profiles").select("full_name").eq("id", targetId).single(),
  ]);

  const actorName = (actor as { full_name?: string } | null)?.full_name ?? "Someone";
  const targetName = (target as { full_name?: string } | null)?.full_name ?? "someone";
  const content = isSelf ? `${actorName} left the group` : `${actorName} removed ${targetName}`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from("messages").insert({
    conversation_id: id, sender_id: user.id, type: "system", content,
  });

  return ok({ removed: true });
});

// PATCH /api/chat/conversations/[id]/members — change role
export const PATCH = withAuth(async (req: NextRequest, ctx) => {
  const { id } = (ctx.params as unknown as { id: string });
  if (!isValidUUID(id)) return ApiError.badRequest("Invalid conversation ID.");

  const body = await req.json().catch(() => null);
  const parsed = roleSchema.safeParse(body);
  if (!parsed.success) return ApiError.badRequest(parsed.error.issues[0].message);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return ApiError.unauthorized();

  // Only owner can change roles
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: myMember } = await (supabase as any)
    .from("conversation_members")
    .select("role")
    .eq("conversation_id", id)
    .eq("user_id", user.id)
    .single();

  if (!myMember || myMember.role !== "owner") {
    return ApiError.forbidden("Only the group owner can change member roles.");
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("conversation_members")
    .update({ role: parsed.data.role })
    .eq("conversation_id", id)
    .eq("user_id", parsed.data.user_id);

  if (error) {
    console.error("[chat/members PATCH]", error);
    return ApiError.internal();
  }

  return ok({ updated: true });
});
