"use client";

import { useEffect, useRef } from "react";
import { Reply, Copy, Pencil, Trash2, Forward, Flag } from "lucide-react";
import { toast } from "sonner";
import type { ChatMessage } from "@/types/chat";
import { canEditMessage, canDeleteForEveryone } from "@/lib/utils/chat";

interface Props {
  message: ChatMessage;
  currentUserId: string;
  isOwn: boolean;
  isGroupAdmin?: boolean;
  position: { x: number; y: number };
  onReply: () => void;
  onEdit: () => void;
  onForward: () => void;
  onClose: () => void;
  onRefreshMessages: () => void;
}

export function MessageActionsMenu({
  message, currentUserId, isOwn, isGroupAdmin = false, position,
  onReply, onEdit, onForward, onClose, onRefreshMessages,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function keyHandler(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", keyHandler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", keyHandler);
    };
  }, [onClose]);

  async function handleDelete(scope: "me" | "everyone") {
    const res = await fetch(`/api/chat/messages/${message.id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope }),
    });
    if (!res.ok) { toast.error("Failed to delete message."); return; }
    onRefreshMessages();
    onClose();
  }

  function handleCopy() {
    if (message.content) {
      navigator.clipboard.writeText(message.content).then(() => toast.success("Copied!"));
    }
    onClose();
  }

  const canEdit = canEditMessage(message, currentUserId);
  const canDelEveryone = canDeleteForEveryone(message, currentUserId, isGroupAdmin);

  // Position: keep menu within viewport
  const menuWidth = 176;
  const menuHeight = 240;
  const left = Math.min(position.x, window.innerWidth - menuWidth - 8);
  const top = position.y + menuHeight > window.innerHeight
    ? position.y - menuHeight
    : position.y;

  const items = [
    { icon: Reply, label: "Reply", onClick: () => { onReply(); onClose(); } },
    message.type === "text" && { icon: Copy, label: "Copy text", onClick: handleCopy },
    canEdit && isOwn && { icon: Pencil, label: "Edit", onClick: () => { onEdit(); onClose(); } },
    { icon: Forward, label: "Forward", onClick: () => { onForward(); onClose(); } },
    !isOwn && { icon: Flag, label: "Report", onClick: () => { toast.info("Report sent."); onClose(); } },
    { icon: Trash2, label: "Delete for me", onClick: () => handleDelete("me"), danger: true },
    canDelEveryone && { icon: Trash2, label: "Delete for everyone", onClick: () => handleDelete("everyone"), danger: true },
  ].filter(Boolean) as Array<{ icon: typeof Reply; label: string; onClick: () => void; danger?: boolean }>;

  return (
    <div
      ref={ref}
      className="fixed z-50 rounded-xl overflow-hidden shadow-xl py-1"
      style={{
        left,
        top,
        width: menuWidth,
        background: "var(--surface-bg)",
        border: "1px solid var(--line-soft)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.14)",
      }}
    >
      {items.map((item, i) => (
        <button
          key={i}
          type="button"
          onClick={item.onClick}
          className="w-full flex items-center gap-3 px-3.5 py-2 text-[13px] font-medium transition-colors"
          style={{ color: item.danger ? "var(--clr-red)" : "var(--ink)" }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = item.danger ? "var(--clr-red-bg)" : "var(--panel-bg)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
        >
          <item.icon className="w-3.5 h-3.5 flex-shrink-0" />
          {item.label}
        </button>
      ))}
    </div>
  );
}
