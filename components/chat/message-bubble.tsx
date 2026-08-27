"use client";

import { useState } from "react";
import { MoreHorizontal, CornerUpLeft, Pencil, FileText, Phone } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { ChatMessage } from "@/types/chat";
import { formatMessageTime, getMessageStatus, getMemberColor, formatFileSize } from "@/lib/utils/chat";
import { MessageStatus } from "./message-status";
import { MessageActionsMenu } from "./message-actions-menu";
import PollDisplay from "./poll-display";
import MediaViewer from "./media-viewer";
import { DocumentViewer } from "@/components/ui/document-viewer";
import { CallModal } from "./call-modal";

interface Props {
  message: ChatMessage;
  currentUserId: string;
  isOwn: boolean;
  showSender: boolean;
  conversationType: "direct" | "group" | "self";
  memberCount: number;
  isGroupAdmin?: boolean;
  onReply: (msg: ChatMessage) => void;
  onEdit: (msg: ChatMessage) => void;
  onForward: (msg: ChatMessage) => void;
  onRefreshMessages: () => void;
  onReact: (msgId: string, emoji: string) => void;
}

const QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🎉"];

function initials(name: string | null) {
  if (!name) return "?";
  return name.split(" ").map(p => p[0]).join("").toUpperCase().slice(0, 2);
}

export function MessageBubble({
  message, currentUserId, isOwn, showSender, conversationType,
  memberCount, isGroupAdmin = false, onReply, onEdit, onForward,
  onRefreshMessages, onReact,
}: Props) {
  const [hovered, setHovered]   = useState(false);
  const [menuPos, setMenuPos]   = useState<{ x: number; y: number } | null>(null);
  const [emojiHover, setEmojiHover] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [docViewerOpen, setDocViewerOpen] = useState(false);
  const [callModalOpen, setCallModalOpen] = useState(false);

  const isDeleted = !!message.deleted_at;
  const isSystem  = message.type === "system";

  // ── system message ────────────────────────────────────────────────────────
  if (isSystem) {
    return (
      <div className="flex justify-center my-1">
        <span
          className="text-[11px] italic px-3 py-0.5 rounded-full"
          style={{ color: "var(--text-muted)", background: "var(--panel-bg)" }}
        >
          {message.content}
        </span>
      </div>
    );
  }

  const status     = isOwn ? getMessageStatus(message, currentUserId, memberCount) : null;
  const timeStr    = formatMessageTime(message.created_at);
  const senderName = message.sender?.full_name ?? message.sender?.email ?? "Unknown";
  const senderColor = getMemberColor(message.sender_id ?? "");

  // Group reactions by emoji
  const reactionMap = new Map<string, string[]>();
  for (const r of message.reactions ?? []) {
    if (!reactionMap.has(r.emoji)) reactionMap.set(r.emoji, []);
    reactionMap.get(r.emoji)!.push(r.user_id);
  }

  function openMenu(e: React.MouseEvent) {
    e.preventDefault();
    setMenuPos({ x: e.clientX, y: e.clientY });
  }

  async function handleReact(emoji: string) {
    const myReaction = (message.reactions ?? []).find(r => r.user_id === currentUserId);
    if (myReaction?.emoji === emoji) {
      await fetch(`/api/chat/messages/${message.id}/react`, { method: "DELETE" });
    } else {
      await fetch(`/api/chat/messages/${message.id}/react`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji }),
      });
    }
    onReact(message.id, emoji);
  }

  return (
    <div
      className={`flex gap-2 ${isOwn ? "flex-row-reverse" : "flex-row"} group`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setEmojiHover(false); }}
    >
      {/* Avatar (others only, in group chat) */}
      {!isOwn && conversationType === "group" && (
        <div className="w-7 flex-shrink-0 flex items-end">
          {showSender && (
            <Avatar className="w-7 h-7">
              <AvatarImage src={message.sender?.avatar_url ?? undefined} />
              <AvatarFallback
                className="text-[10px] font-semibold"
                style={{ background: "var(--navy-l)", color: "var(--navy)" }}
              >
                {initials(senderName)}
              </AvatarFallback>
            </Avatar>
          )}
        </div>
      )}

      <div className={`flex flex-col gap-0.5 max-w-[72%] ${isOwn ? "items-end" : "items-start"}`}>
        {/* Sender name (group, not own) */}
        {showSender && !isOwn && conversationType === "group" && (
          <span className="text-[11px] font-semibold px-1" style={{ color: senderColor }}>
            {senderName}
          </span>
        )}

        {/* Reply preview */}
        {message.reply_to && !isDeleted && (
          <div
            className={`flex items-center gap-2 rounded-xl px-3 py-1.5 text-[12px] max-w-full overflow-hidden cursor-pointer ${isOwn ? "flex-row-reverse" : ""}`}
            style={{
              background: isOwn ? "rgba(255,255,255,0.12)" : "var(--panel-bg)",
              borderLeft: isOwn ? "none" : "3px solid var(--accent-brand)",
              borderRight: isOwn ? "3px solid var(--accent-brand)" : "none",
            }}
          >
            <CornerUpLeft className="w-3 h-3 flex-shrink-0 opacity-50" />
            <div className="min-w-0">
              <p className="font-semibold truncate" style={{ color: isOwn ? "rgba(255,255,255,0.75)" : "var(--accent-brand)" }}>
                {message.reply_to.sender?.full_name ?? "Unknown"}
              </p>
              <p className="truncate opacity-75" style={{ color: isOwn ? "rgba(255,255,255,0.6)" : "var(--text-muted)" }}>
                {message.reply_to.content ?? "Media"}
              </p>
            </div>
          </div>
        )}

        {/* Main bubble */}
        <div
          className="relative rounded-2xl px-3.5 py-2 min-w-[64px]"
          style={{
            background: isOwn ? "#19183B" : "var(--surface-bg)",
            color: isOwn ? "#fff" : "var(--ink)",
            borderTopRightRadius: isOwn ? 4 : undefined,
            borderTopLeftRadius: !isOwn ? 4 : undefined,
            boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
          }}
          onContextMenu={openMenu}
        >
          {isDeleted ? (
            <p className="text-[13px] italic opacity-60">This message was deleted</p>
          ) : (
            <>
              {message.is_forwarded && (
                <p className="text-[10px] font-medium italic mb-1" style={{ color: isOwn ? "rgba(255,255,255,0.5)" : "var(--text-fine)" }}>
                  ↗ Forwarded
                </p>
              )}

              {/* Text content */}
              {message.type === "text" && message.content && (
                <p className="text-[13.5px] leading-snug whitespace-pre-wrap break-words">
                  {message.content}
                </p>
              )}

              {/* Poll */}
              {message.type === "poll" && message.poll && (
                <PollDisplay
                  poll={message.poll}
                  currentUserId={currentUserId}
                  messageId={message.id}
                  onVoteChange={onRefreshMessages}
                />
              )}

              {/* Image */}
              {message.type === "image" && message.metadata?.url && (
                <>
                  <img
                    src={message.metadata.url}
                    alt={message.metadata.filename ?? "Image"}
                    onClick={() => setViewerOpen(true)}
                    className="rounded-lg max-w-[240px] max-h-[300px] object-cover cursor-pointer"
                    style={{ display: "block" }}
                  />
                  {viewerOpen && (
                    <MediaViewer
                      src={message.metadata.url}
                      type="image"
                      filename={message.metadata.filename ?? undefined}
                      onClose={() => setViewerOpen(false)}
                    />
                  )}
                </>
              )}

              {/* Video */}
              {message.type === "video" && message.metadata?.url && (
                <>
                  <div className="relative cursor-pointer" onClick={() => setViewerOpen(true)}>
                    <video src={message.metadata.url} className="rounded-lg max-w-[240px] max-h-[300px]" />
                  </div>
                  {viewerOpen && (
                    <MediaViewer
                      src={message.metadata.url}
                      type="video"
                      filename={message.metadata.filename ?? undefined}
                      onClose={() => setViewerOpen(false)}
                    />
                  )}
                </>
              )}

              {/* Audio / voice note */}
              {(message.type === "audio" || message.type === "voice_note") && message.metadata?.url && (
                <audio src={message.metadata.url} controls className="max-w-[240px]" style={{ height: 36 }} />
              )}

              {/* Voice call — join the same Daily room whoever started it created */}
              {message.type === "call" && message.metadata?.room_url && (
                <>
                  <button
                    type="button"
                    onClick={() => setCallModalOpen(true)}
                    className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 min-w-[180px] w-full text-left transition-opacity hover:opacity-85"
                    style={{ background: isOwn ? "rgba(255,255,255,0.12)" : "var(--panel-bg)" }}
                  >
                    <span
                      className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ background: isOwn ? "rgba(255,255,255,0.15)" : "var(--navy-l)" }}
                    >
                      <Phone className="h-4 w-4" style={{ color: isOwn ? "#fff" : "var(--navy)" }} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12.5px] font-semibold">Voice call</p>
                      <p className="text-[11px] opacity-80">Tap to join</p>
                    </div>
                  </button>
                  {callModalOpen && (
                    <CallModal
                      roomUrl={message.metadata.room_url}
                      onClose={() => setCallModalOpen(false)}
                    />
                  )}
                </>
              )}

              {/* Document — opens an embedded in-app preview, never a direct link/download */}
              {message.type === "document" && message.metadata?.url && (
                <>
                  <button
                    type="button"
                    onClick={() => setDocViewerOpen(true)}
                    className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 min-w-[180px] w-full text-left transition-opacity hover:opacity-85"
                    style={{ background: isOwn ? "rgba(255,255,255,0.12)" : "var(--panel-bg)" }}
                  >
                    <FileText className="h-6 w-6 flex-shrink-0" style={{ color: isOwn ? "#fff" : "var(--navy)" }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[12.5px] font-medium truncate">{message.metadata.filename ?? "Document"}</p>
                      {message.metadata.size != null && (
                        <p className="text-[10.5px] opacity-70">{formatFileSize(message.metadata.size)}</p>
                      )}
                    </div>
                  </button>
                  {docViewerOpen && (
                    <DocumentViewer
                      url={message.metadata.url}
                      filename={message.metadata.filename}
                      mime={message.metadata.mime}
                      onClose={() => setDocViewerOpen(false)}
                    />
                  )}
                </>
              )}

              {/* Other unhandled types (sticker, gif, contact) */}
              {["sticker", "gif", "contact"].includes(message.type) && (
                <p className="text-[13px] italic opacity-70">[{message.type}]</p>
              )}
            </>
          )}

          {/* Meta row: time + edited + status */}
          {!isDeleted && (
            <div
              className={`flex items-center gap-1 mt-1 ${isOwn ? "justify-end" : "justify-end"}`}
            >
              {message.is_edited && (
                <Pencil
                  className="w-2.5 h-2.5 opacity-50"
                  style={{ color: isOwn ? "rgba(255,255,255,0.5)" : "var(--text-muted)" }}
                />
              )}
              <span
                className="text-[10px]"
                style={{ color: isOwn ? "rgba(255,255,255,0.5)" : "var(--text-fine)" }}
              >
                {timeStr}
              </span>
              {isOwn && status && <MessageStatus status={status} />}
            </div>
          )}
        </div>

        {/* Reactions */}
        {reactionMap.size > 0 && (
          <div className={`flex flex-wrap gap-1 ${isOwn ? "justify-end" : "justify-start"}`}>
            {Array.from(reactionMap.entries()).map(([emoji, users]) => {
              const iMineReaction = users.includes(currentUserId);
              return (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => handleReact(emoji)}
                  className="flex items-center gap-1 h-5 px-1.5 rounded-full text-[11px] transition-colors"
                  style={{
                    background: iMineReaction ? "var(--navy-l)" : "var(--panel-bg)",
                    border: `1px solid ${iMineReaction ? "var(--navy)" : "var(--line-soft)"}`,
                    color: "var(--ink)",
                  }}
                >
                  <span>{emoji}</span>
                  <span style={{ color: "var(--text-muted)" }}>{users.length}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Hover action buttons */}
      {(hovered || emojiHover) && !isDeleted && (
        <div
          className={`flex items-center gap-0.5 self-center ${isOwn ? "flex-row-reverse" : "flex-row"}`}
          onMouseEnter={() => setEmojiHover(true)}
          onMouseLeave={() => setEmojiHover(false)}
        >
          {/* Quick emojis */}
          {QUICK_EMOJIS.map(emoji => (
            <button
              key={emoji}
              type="button"
              onClick={() => handleReact(emoji)}
              className="w-7 h-7 rounded-full flex items-center justify-center text-[14px] transition-transform hover:scale-125"
              style={{ background: "var(--panel-bg)" }}
            >
              {emoji}
            </button>
          ))}

          {/* More actions */}
          <button
            type="button"
            onClick={openMenu}
            className="w-7 h-7 rounded-full flex items-center justify-center transition-colors"
            style={{ background: "var(--panel-bg)", color: "var(--text-muted)" }}
          >
            <MoreHorizontal className="w-3.5 h-3.5" />
          </button>

          {/* Quick reply */}
          <button
            type="button"
            onClick={() => onReply(message)}
            className="w-7 h-7 rounded-full flex items-center justify-center transition-colors"
            style={{ background: "var(--panel-bg)", color: "var(--text-muted)" }}
          >
            <CornerUpLeft className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Context menu */}
      {menuPos && (
        <MessageActionsMenu
          message={message}
          currentUserId={currentUserId}
          isOwn={isOwn}
          isGroupAdmin={isGroupAdmin}
          position={menuPos}
          onReply={() => onReply(message)}
          onEdit={() => onEdit(message)}
          onForward={() => onForward(message)}
          onClose={() => setMenuPos(null)}
          onRefreshMessages={onRefreshMessages}
        />
      )}
    </div>
  );
}
