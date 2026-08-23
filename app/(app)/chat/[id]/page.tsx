import { notFound } from "next/navigation";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { isValidUUID } from "@/lib/utils/validate";
import { getConversations, getConversationById, getMessages } from "@/lib/queries/chat";
import { ChatLayout } from "@/components/chat/chat-layout";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ChatConversationPage({ params }: PageProps) {
  const { id } = await params;

  if (!isValidUUID(id)) notFound();

  const supabase = await createClient();

  const {
    data: { user },
  } = await getAuthUser();

  if (!user) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profileRow } = await (supabase as any)
    .from("profiles")
    .select("id, full_name, avatar_url, email")
    .eq("id", user.id)
    .single();

  const profile = {
    id: user.id,
    full_name:
      (profileRow as { full_name: string | null } | null)?.full_name ??
      (user.user_metadata?.full_name as string | null) ??
      null,
    avatar_url:
      (profileRow as { avatar_url: string | null } | null)?.avatar_url ??
      (user.user_metadata?.avatar_url as string | null) ??
      null,
    email: (profileRow as { email: string | null } | null)?.email ?? user.email ?? null,
  };

  const [conversation, initialMessages, conversations] = await Promise.all([
    getConversationById(supabase, id),
    getMessages(supabase, id, 50),
    getConversations(supabase, user.id),
  ]);

  if (!conversation) notFound();

  // Mark conversation as read — update last_read_at for the current user
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from("conversation_members")
    .update({ last_read_at: new Date().toISOString() })
    .eq("conversation_id", id)
    .eq("user_id", user.id);

  return (
    <ChatLayout
      conversations={conversations}
      currentUserId={user.id}
      currentUserProfile={profile}
      activeConversationId={id}
      initialMessages={initialMessages}
      initialConversation={conversation}
    />
  );
}
