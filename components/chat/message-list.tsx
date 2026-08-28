"use client";

import { useEffect, useRef, useCallback } from "react";
import { ArrowDown } from "lucide-react";
import type { ChatMessage } from "@/types/chat";
import { groupMessagesByDate } from "@/lib/utils/chat";
import { MessageBubble } from "./message-bubble";

interface Props {
  messages: ChatMessage[];
  currentUserId: string;
  conversationType: "direct" | "group" | "self" | "ai";
  memberCount: number;
  isGroupAdmin?: boolean;
  onReply: (msg: ChatMessage) => void;
  onEdit: (msg: ChatMessage) => void;
  onForward: (msg: ChatMessage) => void;
  onRefreshMessages: () => void;
  onReact: (msgId: string, emoji: string) => void;
  onLoadMore?: () => void;
  hasMore?: boolean;
  loadingMore?: boolean;
}

function isSameSenderAndClose(a: ChatMessage, b: ChatMessage): boolean {
  if (a.sender_id !== b.sender_id) return false;
  const diff = Math.abs(new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return diff < 2 * 60 * 1000; // within 2 minutes
}

export function MessageList({
  messages, currentUserId, conversationType, memberCount,
  isGroupAdmin = false, onReply, onEdit, onForward,
  onRefreshMessages, onReact, onLoadMore, hasMore = false, loadingMore = false,
}: Props) {
  const bottomRef      = useRef<HTMLDivElement>(null);
  const containerRef   = useRef<HTMLDivElement>(null);
  const topRef         = useRef<HTMLDivElement>(null);
  const prevLenRef     = useRef(messages.length);
  const isAtBottomRef  = useRef(true);

  // Auto-scroll to bottom when new messages arrive (only if already at bottom)
  useEffect(() => {
    if (messages.length > prevLenRef.current && isAtBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    prevLenRef.current = messages.length;
  }, [messages.length]);

  // Initial scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView();
  }, []);

  // Track scroll position to know if user is at bottom
  function handleScroll() {
    const el = containerRef.current;
    if (!el) return;
    isAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }

  // Load more when scrolled to top
  const handleScrollForLoad = useCallback(() => {
    handleScroll();
    const el = containerRef.current;
    if (!el || !hasMore || loadingMore) return;
    if (el.scrollTop < 100) onLoadMore?.();
  }, [hasMore, loadingMore, onLoadMore]);

  // Mark messages as read when they enter viewport
  useEffect(() => {
    if (!("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const msgId = (entry.target as HTMLElement).dataset.msgId;
            if (msgId) {
              fetch(`/api/chat/messages/${msgId}/read`, { method: "POST" }).catch(() => {});
            }
          }
        }
      },
      { threshold: 0.5 },
    );

    const nodes = containerRef.current?.querySelectorAll("[data-msg-id]");
    nodes?.forEach(node => observer.observe(node));
    return () => observer.disconnect();
  }, [messages]);

  function scrollToBottom() {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  const groups = groupMessagesByDate(messages);

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto flex flex-col gap-0"
      onScroll={handleScrollForLoad}
      style={{ padding: "12px 16px", scrollbarWidth: "thin", position: "relative" }}
    >
      {/* Load more spinner */}
      {loadingMore && (
        <div className="flex justify-center py-2">
          <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "var(--text-muted)" }} />
        </div>
      )}

      {/* Date groups */}
      {groups.map((group, gi) => (
        <div key={group.date} className="flex flex-col gap-1">
          {/* Date separator */}
          <div className="flex items-center gap-3 my-3">
            <div className="flex-1 h-px" style={{ background: "var(--line-soft)" }} />
            <span
              className="text-[11px] font-medium px-2.5 py-0.5 rounded-full flex-shrink-0"
              style={{ background: "var(--panel-bg)", color: "var(--text-muted)" }}
            >
              {group.date}
            </span>
            <div className="flex-1 h-px" style={{ background: "var(--line-soft)" }} />
          </div>

          {/* Messages in group */}
          {group.messages.map((msg, mi) => {
            const isOwn  = msg.sender_id === currentUserId;
            const prev   = group.messages[mi - 1];
            const showSender = !prev || !isSameSenderAndClose(prev, msg);
            const isUnread = msg.sender_id !== currentUserId &&
              !(msg.reads ?? []).some(r => r.user_id === currentUserId && r.read_at);

            return (
              <div
                key={msg.id}
                data-msg-id={isUnread ? msg.id : undefined}
                style={{ marginTop: showSender && mi > 0 ? 8 : 2 }}
              >
                <MessageBubble
                  message={msg}
                  currentUserId={currentUserId}
                  isOwn={isOwn}
                  showSender={showSender}
                  conversationType={conversationType}
                  memberCount={memberCount}
                  isGroupAdmin={isGroupAdmin}
                  onReply={onReply}
                  onEdit={onEdit}
                  onForward={onForward}
                  onRefreshMessages={onRefreshMessages}
                  onReact={onReact}
                />
              </div>
            );
          })}
        </div>
      ))}

      {messages.length === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>No messages yet. Say hello!</p>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
