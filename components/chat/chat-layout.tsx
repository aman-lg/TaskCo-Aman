"use client";

import { useState, useEffect, useCallback } from "react";
import { MessageSquare } from "lucide-react";
import type { Conversation, ChatMessage, ChatProfile } from "@/types/chat";
import { ConversationSidebar } from "@/components/chat/conversation-sidebar";
import { ChatWindow } from "@/components/chat/chat-window";
import { useConversationListRealtime, useOnlinePresence } from "@/lib/hooks/use-chat-realtime";

// ---------------------------------------------------------------------------
// EmptyState — shown on the right when no conversation is active
// ---------------------------------------------------------------------------
function EmptyState() {
  return (
    <div
      className="flex-1 flex flex-col items-center justify-center gap-4 select-none"
      style={{ background: "var(--panel-bg)" }}
    >
      <div
        className="w-20 h-20 rounded-full flex items-center justify-center"
        style={{ background: "var(--navy-l)" }}
      >
        <MessageSquare
          className="w-9 h-9"
          style={{ color: "var(--navy)" }}
          strokeWidth={1.5}
        />
      </div>
      <div className="text-center">
        <p
          className="text-[17px] font-semibold"
          style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}
        >
          Your messages
        </p>
        <p
          className="mt-1 text-[13px] max-w-[240px] leading-relaxed"
          style={{ color: "var(--text-muted)" }}
        >
          Select a conversation from the left to start chatting.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
export interface ChatLayoutProps {
  conversations: Conversation[];
  currentUserId: string;
  currentUserProfile: ChatProfile;
  activeConversationId?: string;
  initialMessages?: ChatMessage[];
  initialConversation?: Conversation;
}

// ---------------------------------------------------------------------------
// ChatLayout
// ---------------------------------------------------------------------------
export function ChatLayout({
  conversations: conversationsProp,
  currentUserId,
  currentUserProfile,
  activeConversationId,
  initialMessages,
  initialConversation,
}: ChatLayoutProps) {
  const [conversations, setConversations] = useState<Conversation[]>(conversationsProp);

  // Sync if the server re-renders with new props (e.g. navigation)
  useEffect(() => {
    setConversations(conversationsProp);
  }, [conversationsProp]);

  // Realtime handler: a new message anywhere the user is a member. This
  // used to call router.refresh() — which re-renders the whole route
  // you're currently on — but that raced with an in-flight navigation to
  // a *different* conversation: send a message in A, click over to B
  // before the refresh lands, and the two responses could get applied out
  // of order, leaving A's messages stuck showing alongside B's until a
  // hard reload (confirmed live: this exact sequence reproduced it).
  // Fetching the conversation list directly and swapping it in doesn't
  // touch the router at all, so it can't collide with navigation.
  const handleRealtimeUpdate = useCallback(async () => {
    try {
      const res = await fetch("/api/chat/conversations", { credentials: "same-origin" });
      if (!res.ok) return;
      const json = await res.json().catch(() => null);
      if (Array.isArray(json?.data)) setConversations(json.data);
    } catch {
      // best-effort — the periodic/focus resync elsewhere covers the rest
    }
  }, []);

  useConversationListRealtime(currentUserId, handleRealtimeUpdate);

  // Hoisted here (rather than inside ChatWindow) so it's one shared
  // subscription covering both the sidebar's online dots and the open
  // conversation's header — previously each ChatWindow mount opened its own,
  // and the sidebar never saw presence at all since nothing else tracked it.
  const onlineUserIds = useOnlinePresence(currentUserId, currentUserProfile.full_name);

  const activeConversation = activeConversationId
    ? (initialConversation ?? conversations.find((c) => c.id === activeConversationId) ?? null)
    : null;

  return (
    <div
      className="flex h-full"
      style={{ minHeight: 0 }}
    >
      {/* ------------------------------------------------------------------ */}
      {/* Left: conversation list sidebar (320px fixed on desktop) — on      */}
      {/* mobile this is either the WHOLE screen (no conversation open) or   */}
      {/* hidden entirely (a conversation IS open, WhatsApp-style: one pane  */}
      {/* at a time, never both squeezed side by side).                     */}
      {/* ------------------------------------------------------------------ */}
      <div
        className={
          activeConversation
            ? "hidden md:flex flex-shrink-0 flex-col md:w-[320px]"
            : "flex flex-shrink-0 flex-col w-full md:w-[320px]"
        }
        style={{
          borderRight: "1px solid var(--line)",
          background: "var(--surface-bg)",
          minHeight: 0,
        }}
      >
        <ConversationSidebar
          conversations={conversations}
          currentUserId={currentUserId}
          currentUserProfile={currentUserProfile}
          activeConversationId={activeConversationId}
          onlineUserIds={onlineUserIds}
        />
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Right: chat window or empty state — hidden on mobile until a       */}
      {/* conversation is actually open, matching the sidebar's mirror rule. */}
      {/* ------------------------------------------------------------------ */}
      {activeConversation ? (
        <ChatWindow
          key={activeConversationId}
          conversation={activeConversation}
          currentUserId={currentUserId}
          currentUserProfile={currentUserProfile}
          initialMessages={initialMessages ?? []}
          onlineUserIds={onlineUserIds}
        />
      ) : (
        <div className="hidden md:flex flex-1">
          <EmptyState />
        </div>
      )}
    </div>
  );
}
