"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Conversation, ChatMessage, ChatProfile } from "@/types/chat";
import { ConversationSidebar } from "@/components/chat/conversation-sidebar";
import { ChatWindow } from "@/components/chat/chat-window";

// ---------------------------------------------------------------------------
// Hook: useConversationListRealtime
// Subscribes to new messages on the "messages" table and bubbles up
// last_message_at changes so the conversation list stays fresh.
// ---------------------------------------------------------------------------
function useConversationListRealtime(
  currentUserId: string,
  onUpdate: (conversationId: string, lastMessageAt: string) => void
) {
  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel("conversation-list-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        (payload) => {
          const row = payload.new as {
            conversation_id: string;
            created_at: string;
            sender_id: string;
          };
          onUpdate(row.conversation_id, row.created_at);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId, onUpdate]);
}

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
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>(conversationsProp);

  // Sync if the server re-renders with new props (e.g. navigation)
  useEffect(() => {
    setConversations(conversationsProp);
  }, [conversationsProp]);

  // Realtime handler: bump last_message_at for the affected conversation
  const handleRealtimeUpdate = useCallback(
    (conversationId?: string, lastMessageAt?: string) => {
      if (!conversationId || !lastMessageAt) {
        router.refresh();
        return;
      }
      setConversations((prev) => {
        const idx = prev.findIndex((c) => c.id === conversationId);
        if (idx === -1) {
          router.refresh();
          return prev;
        }
        const updated: Conversation[] = [...prev];
        updated[idx] = { ...updated[idx], last_message_at: lastMessageAt };
        updated.sort((a, b) => {
          const ta = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
          const tb = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
          return tb - ta;
        });
        return updated;
      });
    },
    [router]
  );

  useConversationListRealtime(currentUserId, handleRealtimeUpdate);

  const activeConversation = activeConversationId
    ? (initialConversation ?? conversations.find((c) => c.id === activeConversationId) ?? null)
    : null;

  return (
    <div
      className="flex h-full"
      style={{ minHeight: 0 }}
    >
      {/* ------------------------------------------------------------------ */}
      {/* Left: conversation list sidebar (320px fixed)                       */}
      {/* ------------------------------------------------------------------ */}
      <div
        className="flex-shrink-0 flex flex-col"
        style={{
          width: 320,
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
        />
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Right: chat window or empty state                                   */}
      {/* ------------------------------------------------------------------ */}
      {activeConversation ? (
        <ChatWindow
          key={activeConversationId}
          conversation={activeConversation}
          currentUserId={currentUserId}
          currentUserProfile={currentUserProfile}
          initialMessages={initialMessages ?? []}
        />
      ) : (
        <EmptyState />
      )}
    </div>
  );
}
