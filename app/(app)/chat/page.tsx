import { redirect } from "next/navigation";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { getConversations, ensureSelfConversation } from "@/lib/queries/chat";
import { ChatLayout } from "@/components/chat/chat-layout";
import type { Conversation } from "@/types/chat";

export const dynamic = "force-dynamic";

export default async function ChatPage() {
  const supabase = await createClient();
  const { data: { user } } = await getAuthUser();
  if (!user) redirect("/login");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profileRow } = await (supabase as any)
    .from("profiles")
    .select("id, full_name, avatar_url, email")
    .eq("id", user.id)
    .single();

  const profile = {
    id: user.id,
    full_name: (profileRow as { full_name: string | null } | null)?.full_name ?? null,
    avatar_url: (profileRow as { avatar_url: string | null } | null)?.avatar_url ?? null,
    email: user.email ?? null,
    last_seen_at: null,
  };

  // Wrap in try-catch — if the chat migration hasn't been run yet, tables won't exist
  let conversations: Conversation[] = [];
  try {
    await ensureSelfConversation(supabase, user.id);
    conversations = await getConversations(supabase, user.id);
  } catch (err) {
    console.error("[chat/page] DB error — run migration 011_chat.sql:", err);
  }

  return (
    <ChatLayout
      conversations={conversations}
      currentUserId={user.id}
      currentUserProfile={profile}
    />
  );
}
