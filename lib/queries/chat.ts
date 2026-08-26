import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types";
import type { Conversation, ChatMessage, ConversationMember, ChatProfile } from "@/types/chat";

type Client = SupabaseClient<Database>;

// ─── getConversations ─────────────────────────────────────────────────────────
// Returns all conversations for the current user, ordered by pin then last_message_at.

export async function getConversations(supabase: Client, userId: string): Promise<Conversation[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("conversation_members")
    .select(`
      conversation_id, role, last_read_at, is_muted, is_pinned, is_archived, is_banned,
      conversations:conversation_id(
        id, type, name, description, avatar_url, created_by,
        last_message_at, admin_only_messages, slow_mode_seconds, created_at, updated_at
      )
    `)
    .eq("user_id", userId)
    .eq("is_banned", false)
    .order("is_pinned", { ascending: false });

  if (error || !data) return [];

  const convIds: string[] = data
    .map((r: { conversation_id: string; is_archived?: boolean }) => r.conversation_id)
    .filter(Boolean);

  if (convIds.length === 0) return [];

  // Fetch last message per conversation
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: msgs } = await (supabase as any)
    .from("messages")
    .select("id, conversation_id, sender_id, type, content, metadata, created_at, deleted_at")
    .in("conversation_id", convIds)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  const lastMsgMap = new Map<string, ChatMessage>();
  if (msgs) {
    for (const m of msgs as ChatMessage[]) {
      if (!lastMsgMap.has(m.conversation_id)) lastMsgMap.set(m.conversation_id, m);
    }
  }

  // Fetch all members (to find other_user in direct chats)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: members } = await (supabase as any)
    .from("conversation_members")
    .select(`
      conversation_id, user_id, role,
      profile:profiles!user_id(id, full_name, avatar_url, email, last_seen_at)
    `)
    .in("conversation_id", convIds);

  const memberMap = new Map<string, ConversationMember[]>();
  if (members) {
    for (const m of members as (ConversationMember & { conversation_id: string })[]) {
      if (!memberMap.has(m.conversation_id)) memberMap.set(m.conversation_id, []);
      memberMap.get(m.conversation_id)!.push(m);
    }
  }

  // Compute unread counts
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conversations: Conversation[] = data.map((row: any) => {
    const conv = row.conversations as Conversation;
    if (!conv) return null;

    const myMember: ConversationMember = {
      conversation_id: conv.id,
      user_id: userId,
      role: row.role,
      added_by: null,
      added_at: row.added_at ?? conv.created_at,
      last_read_at: row.last_read_at,
      is_muted: row.is_muted ?? false,
      muted_until: null,
      is_pinned: row.is_pinned ?? false,
      is_archived: row.is_archived ?? false,
      is_banned: row.is_banned ?? false,
    };

    const convMembers = memberMap.get(conv.id) ?? [];
    const other_user = conv.type === "direct" || conv.type === "self"
      ? convMembers.find(m => m.user_id !== userId)?.profile ?? null
      : null;

    // Count messages after last_read_at from other senders
    const lastRead = row.last_read_at ? new Date(row.last_read_at) : null;
    const allMsgs = msgs as ChatMessage[] ?? [];
    const unread_count = allMsgs.filter(m =>
      m.conversation_id === conv.id &&
      m.sender_id !== userId &&
      !m.deleted_at &&
      (!lastRead || new Date(m.created_at) > lastRead)
    ).length;

    return {
      ...conv,
      members: convMembers,
      my_member: myMember,
      last_message: lastMsgMap.get(conv.id) ?? null,
      unread_count,
      other_user: other_user as ChatProfile | null,
    };
  }).filter(Boolean) as Conversation[];

  // Sort: self (Notes) first, then pinned, then by last_message_at
  return conversations.sort((a, b) => {
    if (a.type === "self") return -1;
    if (b.type === "self") return 1;
    if (a.my_member?.is_pinned && !b.my_member?.is_pinned) return -1;
    if (!a.my_member?.is_pinned && b.my_member?.is_pinned) return 1;
    const ta = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
    const tb = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
    return tb - ta;
  });
}

// ─── getTotalUnreadCount ──────────────────────────────────────────────────────
// Lightweight sum of unread messages across every conversation the user is
// in — same "unread" definition as getConversations() but without the
// member/last-message joins, for a fast sidebar badge poll.

export async function getTotalUnreadCount(supabase: Client, userId: string): Promise<number> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: memberRows } = await (supabase as any)
    .from("conversation_members")
    .select("conversation_id, last_read_at")
    .eq("user_id", userId)
    .eq("is_banned", false);

  if (!memberRows || memberRows.length === 0) return 0;
  const convIds: string[] = memberRows.map((r: { conversation_id: string }) => r.conversation_id);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: msgs } = await (supabase as any)
    .from("messages")
    .select("conversation_id, created_at")
    .in("conversation_id", convIds)
    .neq("sender_id", userId)
    .is("deleted_at", null);

  if (!msgs) return 0;

  const lastReadMap = new Map<string, Date | null>(
    memberRows.map((r: { conversation_id: string; last_read_at: string | null }) => [
      r.conversation_id,
      r.last_read_at ? new Date(r.last_read_at) : null,
    ]),
  );

  let total = 0;
  for (const m of msgs as { conversation_id: string; created_at: string }[]) {
    const lastRead = lastReadMap.get(m.conversation_id);
    if (!lastRead || new Date(m.created_at) > lastRead) total++;
  }
  return total;
}

// ─── getConversationById ──────────────────────────────────────────────────────

export async function getConversationById(
  supabase: Client,
  id: string,
): Promise<Conversation | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: conv, error } = await (supabase as any)
    .from("conversations")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !conv) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: members } = await (supabase as any)
    .from("conversation_members")
    .select("*, profile:profiles!user_id(id, full_name, avatar_url, email, last_seen_at)")
    .eq("conversation_id", id);

  return {
    ...(conv as Conversation),
    members: (members ?? []) as ConversationMember[],
  };
}

// ─── getMessages ─────────────────────────────────────────────────────────────

export async function getMessages(
  supabase: Client,
  conversationId: string,
  limit = 50,
  before?: string,
  currentUserId?: string,
): Promise<ChatMessage[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from("messages")
    .select(`
      *,
      sender:profiles!sender_id(id, full_name, avatar_url, email, last_seen_at),
      reactions:message_reactions(message_id, user_id, emoji, created_at),
      reads:message_reads(message_id, user_id, delivered_at, read_at),
      reply_to:reply_to_id(
        id, type, content, sender_id, metadata,
        sender:profiles!sender_id(id, full_name, avatar_url)
      )
    `)
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (before) query = query.lt("created_at", before);

  const { data, error } = await query;
  if (error || !data) return [];

  const messages = (data as ChatMessage[]).reverse();
  await attachPolls(supabase, messages, currentUserId);
  return messages;
}

// Fetches polls/options/votes for any poll-type messages in the given list
// and attaches them as message.poll, shaped exactly like PollDisplay expects
// (vote_count per option, user_votes for the caller). Mutates in place.
async function attachPolls(supabase: Client, messages: ChatMessage[], currentUserId?: string): Promise<void> {
  const pollMessageIds = messages.filter((m) => m.type === "poll").map((m) => m.id);
  if (pollMessageIds.length === 0) return;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: polls } = await (supabase as any)
    .from("polls")
    .select("*, options:poll_options(id, text, position)")
    .in("message_id", pollMessageIds);
  if (!polls || polls.length === 0) return;

  const pollIds = polls.map((p: { id: string }) => p.id);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: votes } = await (supabase as any)
    .from("poll_votes")
    .select("poll_id, option_id, user_id")
    .in("poll_id", pollIds);

  const votesByPoll = new Map<string, { option_id: string; user_id: string }[]>();
  for (const v of (votes ?? []) as { poll_id: string; option_id: string; user_id: string }[]) {
    if (!votesByPoll.has(v.poll_id)) votesByPoll.set(v.poll_id, []);
    votesByPoll.get(v.poll_id)!.push(v);
  }

  const pollByMessageId = new Map<string, unknown>();
  for (const poll of polls as Array<{ id: string; message_id: string; options: { id: string; text: string; position: number }[] }>) {
    const pollVotes = votesByPoll.get(poll.id) ?? [];
    const voteCounts = new Map<string, number>();
    for (const v of pollVotes) voteCounts.set(v.option_id, (voteCounts.get(v.option_id) ?? 0) + 1);

    pollByMessageId.set(poll.message_id, {
      ...poll,
      options: poll.options
        .sort((a, b) => a.position - b.position)
        .map((o) => ({ ...o, vote_count: voteCounts.get(o.id) ?? 0 })),
      user_votes: currentUserId ? pollVotes.filter((v) => v.user_id === currentUserId).map((v) => v.option_id) : [],
    });
  }

  for (const m of messages) {
    if (pollByMessageId.has(m.id)) m.poll = pollByMessageId.get(m.id) as ChatMessage["poll"];
  }
}

// ─── ensureSelfConversation ───────────────────────────────────────────────────
// Auto-creates the "My Notes" self-conversation for a user if it doesn't exist.

export async function ensureSelfConversation(
  supabase: Client,
  userId: string,
): Promise<string | null> {
  // Step 1: Find existing self conversation via conversation_members.
  // cm_select RLS allows "user_id = auth.uid()", so own rows are always visible.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: memberRows } = await (supabase as any)
    .from("conversation_members")
    .select("conversation_id")
    .eq("user_id", userId);

  const ownConvIds: string[] = (memberRows ?? []).map(
    (r: { conversation_id: string }) => r.conversation_id,
  );

  if (ownConvIds.length > 0) {
    // conversations RLS: is_conversation_member(id) — true for ids in ownConvIds
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: selfConv } = await (supabase as any)
      .from("conversations")
      .select("id")
      .eq("type", "self")
      .in("id", ownConvIds)
      .maybeSingle();

    if (selfConv?.id) return selfConv.id as string;
  }

  // Step 2: Create the self conversation
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: newConv, error: convErr } = await (supabase as any)
    .from("conversations")
    .insert({ type: "self", created_by: userId })
    .select("id")
    .single();

  if (convErr || !newConv) {
    console.error("[ensureSelfConversation] insert failed:", convErr);
    return null;
  }

  // Step 3: Add owner member row (upsert in case of partial failure retry)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from("conversation_members")
    .upsert(
      { conversation_id: newConv.id, user_id: userId, role: "owner", added_by: userId },
      { onConflict: "conversation_id,user_id" },
    );

  return newConv.id as string;
}
