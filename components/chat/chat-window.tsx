"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { Conversation, ChatMessage, TypingUser, ChatProfile, MessageReaction, MessageRead } from "@/types/chat";
import { useChatRealtime, useOnlinePresence } from "@/lib/hooks/use-chat-realtime";
import { ChatHeader } from "./chat-header";
import { MessageList } from "./message-list";
import { MessageInput } from "./message-input";
import { TypingIndicator } from "./typing-indicator";
import { ConversationInfoPanel } from "./conversation-info-panel";

interface Props {
  conversation: Conversation;
  currentUserId: string;
  currentUserProfile: ChatProfile;
  initialMessages: ChatMessage[];
}

export function ChatWindow({
  conversation, currentUserId, currentUserProfile, initialMessages,
}: Props) {
  const router = useRouter();
  const [messages, setMessages]     = useState<ChatMessage[]>(initialMessages);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [replyTo, setReplyTo]       = useState<ChatMessage | null>(null);
  const [hasMore, setHasMore]       = useState(initialMessages.length === 50);
  const [loadingMore, setLoadingMore] = useState(false);
  const [infoOpen, setInfoOpen]     = useState(false);

  const memberCount = conversation.members?.length ?? 2;
  const myMember    = conversation.members?.find(m => m.user_id === currentUserId);
  // Every conversation gets an "owner" (whoever created it), including direct
  // messages — that role only means something to moderate in a group, so it
  // must never grant admin powers (like deleting the other person's messages
  // for everyone) in a DM.
  const isAdmin     = conversation.type === "group" && (myMember?.role === "owner" || myMember?.role === "admin");

  // Esc closes the open conversation, back to the chat list.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") router.push("/chat");
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [router]);

  const onlineUserIds = useOnlinePresence(currentUserId, currentUserProfile.full_name);

  // ── Realtime callbacks ─────────────────────────────────────────────────────
  const handleNewMessage = useCallback((msg: ChatMessage) => {
    setMessages(prev => {
      if (prev.some(m => m.id === msg.id)) return prev;
      return [...prev, msg];
    });
    // Auto-mark as read
    if (msg.sender_id !== currentUserId) {
      fetch(`/api/chat/messages/${msg.id}/read`, { method: "POST" }).catch(() => {});
    }
  }, [currentUserId]);

  const handleMessageUpdated = useCallback((updated: ChatMessage) => {
    setMessages(prev => prev.map(m => m.id === updated.id ? { ...m, ...updated } : m));
  }, []);

  const handleMessageDeleted = useCallback((id: string) => {
    setMessages(prev => prev.map(m => m.id === id ? { ...m, deleted_at: new Date().toISOString(), content: null } : m));
  }, []);

  const handleReactionChange = useCallback((messageId: string, reaction: MessageReaction, deleted: boolean) => {
    setMessages(prev => prev.map(m => {
      if (m.id !== messageId) return m;
      const reactions = m.reactions ?? [];
      if (deleted) {
        return { ...m, reactions: reactions.filter(r => !(r.user_id === reaction.user_id)) };
      }
      const existing = reactions.findIndex(r => r.user_id === reaction.user_id);
      if (existing >= 0) {
        const next = [...reactions];
        next[existing] = reaction;
        return { ...m, reactions: next };
      }
      return { ...m, reactions: [...reactions, reaction] };
    }));
  }, []);

  const handleReadUpdate = useCallback((read: MessageRead) => {
    setMessages(prev => prev.map(m => {
      if (m.id !== read.message_id) return m;
      const reads = m.reads ?? [];
      const existing = reads.findIndex(r => r.user_id === read.user_id);
      if (existing >= 0) {
        const next = [...reads];
        next[existing] = read;
        return { ...m, reads: next };
      }
      return { ...m, reads: [...reads, read] };
    }));
  }, []);

  const { sendTyping } = useChatRealtime({
    conversationId: conversation.id,
    currentUserId,
    onNewMessage: handleNewMessage,
    onMessageUpdated: handleMessageUpdated,
    onMessageDeleted: handleMessageDeleted,
    onReactionChange: handleReactionChange,
    onReadUpdate: handleReadUpdate,
    onTyping: setTypingUsers,
  });

  // ── Message sent callback (optimistic) ────────────────────────────────────
  const handleMessageSent = useCallback((msg: ChatMessage) => {
    setMessages(prev => {
      if (prev.some(m => m.id === msg.id)) return prev;
      return [...prev, msg];
    });
  }, []);

  // ── Load more (scroll to top) ──────────────────────────────────────────────
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const oldest = messages[0];
    const res = await fetch(
      `/api/chat/conversations/${conversation.id}/messages?limit=50&before=${oldest.created_at}`,
    );
    if (res.ok) {
      const json = await res.json();
      const older: ChatMessage[] = json.data?.messages ?? [];
      setMessages(prev => [...older, ...prev]);
      setHasMore(json.data?.has_more ?? false);
    }
    setLoadingMore(false);
  }, [loadingMore, hasMore, messages, conversation.id]);

  // ── Refresh (after delete/edit) ────────────────────────────────────────────
  const refreshMessages = useCallback(async () => {
    const res = await fetch(`/api/chat/conversations/${conversation.id}/messages?limit=50`);
    if (res.ok) {
      const json = await res.json();
      setMessages(json.data?.messages ?? []);
    }
  }, [conversation.id]);

  const isSelf = conversation.type === "self";

  return (
    <div
      className="flex-1 flex flex-col overflow-hidden"
      style={{ background: "var(--page-bg)", minWidth: 0 }}
    >
      {/* Header */}
      <ChatHeader
        conversation={conversation}
        currentUserId={currentUserId}
        onlineUserIds={onlineUserIds}
        onOpenInfo={() => setInfoOpen(true)}
      />

      <ConversationInfoPanel
        open={infoOpen}
        onClose={() => setInfoOpen(false)}
        conversation={conversation}
        currentUserId={currentUserId}
        onLeftGroup={() => { setInfoOpen(false); router.push("/chat"); router.refresh(); }}
      />

      {/* Message list */}
      <MessageList
        messages={messages}
        currentUserId={currentUserId}
        conversationType={conversation.type}
        memberCount={memberCount}
        isGroupAdmin={isAdmin}
        onReply={setReplyTo}
        onEdit={() => {}}
        onForward={() => {}}
        onRefreshMessages={refreshMessages}
        onReact={(msgId, emoji) => handleReactionChange(
          msgId,
          { message_id: msgId, user_id: currentUserId, emoji, created_at: new Date().toISOString() },
          false,
        )}
        onLoadMore={loadMore}
        hasMore={hasMore}
        loadingMore={loadingMore}
      />

      {/* Typing indicator */}
      {!isSelf && <TypingIndicator typingUsers={typingUsers} />}

      {/* Message input */}
      <MessageInput
        conversationId={conversation.id}
        currentUserId={currentUserId}
        replyTo={replyTo}
        onClearReply={() => setReplyTo(null)}
        onMessageSent={handleMessageSent}
        sendTyping={sendTyping}
        disabled={false}
        adminOnly={conversation.admin_only_messages && !isAdmin}
        isAdmin={isAdmin}
      />
    </div>
  );
}
