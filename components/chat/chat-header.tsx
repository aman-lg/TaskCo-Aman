"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, MoreVertical, Phone, Video, Users } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useState } from "react";
import type { Conversation, ChatProfile, TypingUser } from "@/types/chat";
import { getConversationName, getConversationAvatar, formatLastSeen } from "@/lib/utils/chat";
import { CallModal } from "./call-modal";

interface Props {
  conversation: Conversation;
  currentUserId: string;
  onlineUserIds?: Set<string>;
  typingUsers?: TypingUser[];
  onOpenInfo: () => void;
}

function initials(name: string | null, email: string | null) {
  if (name) return name.split(" ").map(p => p[0]).join("").toUpperCase().slice(0, 2);
  return (email?.[0] ?? "?").toUpperCase();
}

export function ChatHeader({ conversation, currentUserId, onlineUserIds, typingUsers, onOpenInfo }: Props) {
  const router = useRouter();
  const [activeCallUrl, setActiveCallUrl] = useState<string | null>(null);
  const [startingCall, setStartingCall] = useState(false);

  async function startCall() {
    if (startingCall) return;
    setStartingCall(true);
    try {
      const res = await fetch(`/api/chat/conversations/${conversation.id}/calls`, { method: "POST", credentials: "same-origin" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json?.error?.message ?? "Couldn't start the call");
        return;
      }
      setActiveCallUrl(json.data.room_url);
    } finally {
      setStartingCall(false);
    }
  }
  const name   = getConversationName(conversation, currentUserId);
  const avatar = getConversationAvatar(conversation, currentUserId);
  const isSelf = conversation.type === "self";
  const isDM   = conversation.type === "direct";
  const isGroup = conversation.type === "group";

  const memberCount = conversation.members?.length ?? 0;
  const otherUser   = isDM ? conversation.other_user : null;
  const isOnline    = otherUser ? onlineUserIds?.has(otherUser.id) : false;
  const isOtherTyping = isDM && otherUser ? (typingUsers ?? []).some((t) => t.user_id === otherUser.id) : false;

  async function leaveGroup() {
    const res = await fetch(`/api/chat/conversations/${conversation.id}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/chat");
      router.refresh();
    } else {
      toast.error("Failed to leave group.");
    }
  }

  return (
    <div
      className="flex items-center gap-3 px-4 pb-3 flex-shrink-0"
      style={{
        background: "var(--surface-bg)",
        borderBottom: "1px solid var(--line-soft)",
        // The individual conversation view hides the mobile top bar entirely
        // (fullscreen chat, see app-shell.tsx) so this header sits flush
        // against the very top of the screen — without this it renders
        // right under the iPhone notch/status bar. env() is 0 on anything
        // without a safe-area inset, so this is a no-op on desktop/Android.
        paddingTop: "calc(0.75rem + env(safe-area-inset-top))",
      }}
    >
      {/* Back button (mobile) */}
      <button
        type="button"
        onClick={() => router.push("/chat")}
        className="md:hidden p-1 rounded-lg"
        style={{ color: "var(--text-muted)" }}
        aria-label="Back"
      >
        <ArrowLeft className="w-5 h-5" />
      </button>

      {/* Avatar + name + status — click opens the info/media panel */}
      <button
        type="button"
        onClick={() => !isSelf && onOpenInfo()}
        disabled={isSelf}
        className="flex items-center gap-3 flex-1 min-w-0 text-left"
        style={{ cursor: isSelf ? "default" : "pointer" }}
      >
        {isSelf ? (
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-base flex-shrink-0"
            style={{ background: "var(--navy-l)" }}
          >
            📝
          </div>
        ) : (
          <Avatar className="w-9 h-9 flex-shrink-0">
            <AvatarImage src={avatar ?? undefined} />
            <AvatarFallback
              className="text-[12px] font-semibold"
              style={{ background: "var(--navy-l)", color: "var(--navy)" }}
            >
              {initials(name, otherUser?.email ?? null)}
            </AvatarFallback>
          </Avatar>
        )}

        <div className="flex-1 min-w-0">
          <p className="flex items-center gap-1.5 min-w-0">
            <span className="text-[14px] font-semibold truncate" style={{ color: "var(--ink)" }}>
              {isSelf ? "My Notes" : name}
            </span>
            {isDM && isOtherTyping && (
              <span className="text-[11px] italic flex-shrink-0" style={{ color: "var(--text-muted)" }}>typing…</span>
            )}
            {isDM && !isOtherTyping && isOnline && (
              <span className="flex items-center gap-1 flex-shrink-0">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--clr-green)" }} />
                <span className="text-[11px] italic" style={{ color: "var(--clr-green)" }}>online</span>
              </span>
            )}
            {isDM && !isOtherTyping && !isOnline && otherUser?.last_seen_at && (
              <span className="text-[11px] italic truncate" style={{ color: "var(--text-muted)" }}>
                Last Active {formatLastSeen(otherUser.last_seen_at)}
              </span>
            )}
          </p>
          {isDM && otherUser?.title && (
            <p className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>
              {otherUser.title}
            </p>
          )}
          {isGroup && (
            <p className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>
              {memberCount} member{memberCount !== 1 ? "s" : ""}
            </p>
          )}
          {isSelf && (
            <p className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>Your private notes</p>
          )}
        </div>
      </button>

      {/* Action buttons */}
      {!isSelf && (
        <div className="flex items-center gap-1">
          {isDM && (
            <>
              <button
                type="button"
                onClick={startCall}
                disabled={startingCall}
                className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors disabled:opacity-50"
                style={{ color: "var(--text-muted)" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--panel-bg)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                aria-label="Start voice call"
              >
                <Phone className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => toast.info("Video calls coming soon!")}
                className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                style={{ color: "var(--text-muted)" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--panel-bg)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
              >
                <Video className="w-4 h-4" />
              </button>
            </>
          )}

          {isGroup && (
            <button
              type="button"
              onClick={onOpenInfo}
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
              style={{ color: "var(--text-muted)" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--panel-bg)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
            >
              <Users className="w-4 h-4" />
            </button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
              style={{ color: "var(--text-muted)" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--panel-bg)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
            >
              <MoreVertical className="w-4 h-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {isDM && (
                <DropdownMenuItem onClick={onOpenInfo}>
                  View profile
                </DropdownMenuItem>
              )}
              {isGroup && (
                <DropdownMenuItem onClick={onOpenInfo}>
                  Group info
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => toast.info("Mute coming soon!")}>
                Mute notifications
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => toast.info("Clear chat coming soon!")}>
                Clear chat
              </DropdownMenuItem>
              {isGroup && (
                <DropdownMenuItem
                  className="text-red-500"
                  onClick={leaveGroup}
                >
                  Leave group
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {activeCallUrl && (
        <CallModal roomUrl={activeCallUrl} onClose={() => setActiveCallUrl(null)} />
      )}
    </div>
  );
}
