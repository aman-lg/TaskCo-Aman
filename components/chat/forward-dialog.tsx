"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Send } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { ChatMessage, Conversation } from "@/types/chat";
import { getConversationName, getConversationAvatar } from "@/lib/utils/chat";

interface Props {
  message: ChatMessage | null;
  currentUserId: string;
  onClose: () => void;
}

function initials(name: string) {
  if (!name) return "?";
  return name.split(" ").map((p) => p[0]).join("").toUpperCase().slice(0, 2);
}

export function ForwardDialog({ message, currentUserId, onClose }: Props) {
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [sendingId, setSendingId] = useState<string | null>(null);

  useEffect(() => {
    if (!message) return;
    setSearch("");
    setLoading(true);
    fetch("/api/chat/conversations", { credentials: "same-origin" })
      .then((r) => r.json())
      .then((j) => setConversations((j.data ?? []).filter((c: Conversation) => c.type !== "self")))
      .finally(() => setLoading(false));
  }, [message]);

  async function handleForward(conversationId: string) {
    if (!message) return;
    setSendingId(conversationId);
    try {
      const res = await fetch(`/api/chat/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          content: message.content ?? undefined,
          type: message.type,
          metadata: message.metadata ?? undefined,
          forwarded_from_id: message.id,
          is_forwarded: true,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(body?.error?.message ?? "Failed to forward message");
        return;
      }
      toast.success("Message forwarded");
      router.push(`/chat/${conversationId}`);
      onClose();
    } finally {
      setSendingId(null);
    }
  }

  const filtered = conversations.filter((c) =>
    getConversationName(c, currentUserId).toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Dialog open={!!message} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="w-full max-w-[calc(100vw-2rem)] sm:max-w-[380px] p-5 gap-4">
        <DialogHeader>
          <DialogTitle className="h3" style={{ color: "var(--ink)" }}>Forward message</DialogTitle>
        </DialogHeader>

        <input
          autoFocus
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search chats…"
          className="h-9 px-3 rounded-lg text-[13px] outline-none"
          style={{ background: "var(--panel-bg)", border: "1px solid var(--line)", color: "var(--ink)" }}
        />

        <div className="flex flex-col gap-1 max-h-72 overflow-y-auto">
          {loading ? (
            <p className="text-[13px] text-center py-4" style={{ color: "var(--text-muted)" }}>Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="text-[13px] text-center py-4" style={{ color: "var(--text-muted)" }}>No chats found</p>
          ) : filtered.map((c) => {
            const name = getConversationName(c, currentUserId);
            const avatar = getConversationAvatar(c, currentUserId);
            return (
              <button
                key={c.id}
                onClick={() => handleForward(c.id)}
                disabled={!!sendingId}
                className="flex items-center gap-2.5 py-2 px-2 rounded-lg hover:bg-[var(--line-soft)] text-left disabled:opacity-50"
              >
                <Avatar className="h-8 w-8 flex-shrink-0">
                  <AvatarImage src={avatar ?? undefined} />
                  <AvatarFallback className="text-[11px] font-semibold" style={{ background: "var(--navy-l)", color: "var(--navy)" }}>
                    {initials(name)}
                  </AvatarFallback>
                </Avatar>
                <span className="flex-1 text-[13px] font-medium truncate" style={{ color: "var(--ink)" }}>{name}</span>
                {sendingId === c.id ? (
                  <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" style={{ color: "var(--text-muted)" }} />
                ) : (
                  <Send className="h-3.5 w-3.5 flex-shrink-0" style={{ color: "var(--text-muted)" }} />
                )}
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
