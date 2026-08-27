"use client";

import Link from "next/link";
import { BellOff, Pin } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { Conversation } from "@/types/chat";
import { getConversationName, getConversationAvatar, formatConversationTime, getLastMessagePreview } from "@/lib/utils/chat";

interface Props {
  conversation: Conversation;
  currentUserId: string;
  isActive: boolean;
  isOnline?: boolean;
}

function initials(name: string | null, email: string | null): string {
  if (name) return name.split(" ").map(p => p[0]).join("").toUpperCase().slice(0, 2);
  return (email?.[0] ?? "?").toUpperCase();
}

export function ConversationItem({ conversation: conv, currentUserId, isActive, isOnline }: Props) {
  const name = getConversationName(conv, currentUserId);
  const avatar = getConversationAvatar(conv, currentUserId);
  const timeStr = formatConversationTime(conv.last_message_at);
  const preview = getLastMessagePreview(conv.last_message ?? null, currentUserId);
  const unread = conv.unread_count ?? 0;
  const isMuted = conv.my_member?.is_muted ?? false;
  const isPinned = conv.my_member?.is_pinned ?? false;
  const isSelf = conv.type === "self";

  return (
    <Link
      href={`/chat/${conv.id}`}
      className="flex items-center gap-3 px-2 py-2 rounded-xl transition-colors select-none"
      style={{
        background: isActive ? "var(--navy-l)" : "transparent",
        textDecoration: "none",
      }}
      onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = "var(--panel-bg)"; }}
      onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
    >
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        {isSelf ? (
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-[18px]"
            style={{ background: "linear-gradient(135deg, var(--navy-l), #dde1ff)" }}
          >
            📝
          </div>
        ) : (
          <>
            <Avatar className="w-10 h-10">
              <AvatarImage src={avatar ?? undefined} />
              <AvatarFallback
                className="text-[12px] font-semibold"
                style={{ background: "var(--navy-l)", color: "var(--navy)" }}
              >
                {initials(name, conv.other_user?.email ?? null)}
              </AvatarFallback>
            </Avatar>
            {conv.type === "direct" && isOnline && (
              <span
                className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full"
                style={{ background: "var(--clr-green)", border: "2px solid var(--surface-bg)" }}
              />
            )}
          </>
        )}
      </div>

      {/* Text content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              className="text-[13.5px] font-semibold truncate"
              style={{ color: "var(--ink)" }}
            >
              {isSelf ? "My Notes" : name}
            </span>
            {isPinned && <Pin className="w-3 h-3 flex-shrink-0" style={{ color: "var(--text-fine)" }} />}
          </div>
          {timeStr && (
            <span
              className="text-[11px] flex-shrink-0"
              style={{ color: unread > 0 ? "var(--accent-brand)" : "var(--text-fine)" }}
            >
              {timeStr}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between gap-1 mt-0.5">
          <p
            className="text-[12px] truncate leading-snug"
            style={{ color: "var(--text-muted)", fontWeight: unread > 0 ? 500 : 400 }}
          >
            {preview}
          </p>

          <div className="flex items-center gap-1 flex-shrink-0">
            {isMuted && <BellOff className="w-3 h-3" style={{ color: "var(--text-fine)" }} />}
            {unread > 0 && (
              <span
                className="min-w-[18px] h-[18px] rounded-full text-[10px] font-bold flex items-center justify-center px-1"
                style={{ background: isMuted ? "var(--text-fine)" : "var(--accent-brand)", color: "#fff" }}
              >
                {unread > 99 ? "99+" : unread}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
