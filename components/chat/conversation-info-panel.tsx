"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { FileText, Image as ImageIcon, Film, Crown, Shield, LogOut } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import MediaViewer from "./media-viewer";
import type { Conversation } from "@/types/chat";
import { formatFileSize, formatLastSeen } from "@/lib/utils/chat";

interface MediaItem {
  id: string;
  type: "image" | "video" | "document";
  metadata: { url?: string; filename?: string; size?: number } | null;
  created_at: string;
  sender_id: string | null;
  sender: { id: string; full_name: string | null; avatar_url: string | null } | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  conversation: Conversation;
  currentUserId: string;
  onLeftGroup: () => void;
}

function initials(name?: string | null, email?: string | null) {
  if (name) return name.split(" ").map((p) => p[0]).join("").toUpperCase().slice(0, 2);
  return (email?.[0] ?? "?").toUpperCase();
}

export function ConversationInfoPanel({ open, onClose, conversation, currentUserId, onLeftGroup }: Props) {
  const [tab, setTab] = useState<"info" | "media">("info");
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loadingMedia, setLoadingMedia] = useState(false);
  const [viewerItem, setViewerItem] = useState<MediaItem | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const isGroup = conversation.type === "group";
  const otherMember = conversation.members?.find((m) => m.user_id !== currentUserId);
  const other = conversation.other_user ?? otherMember?.profile ?? null;

  const loadMedia = useCallback(async () => {
    setLoadingMedia(true);
    try {
      const res = await fetch(`/api/chat/conversations/${conversation.id}/media`, { credentials: "same-origin" });
      if (res.ok) {
        const { data } = await res.json();
        setMedia(data.items ?? []);
      }
    } finally {
      setLoadingMedia(false);
    }
  }, [conversation.id]);

  useEffect(() => {
    if (open && tab === "media" && media.length === 0) loadMedia();
  }, [open, tab, media.length, loadMedia]);

  useEffect(() => {
    if (!open) setTab("info");
  }, [open]);

  async function handleLeave() {
    setLeaving(true);
    try {
      const res = await fetch(`/api/chat/conversations/${conversation.id}`, { method: "DELETE", credentials: "same-origin" });
      if (!res.ok) {
        toast.error("Failed to leave group.");
        return;
      }
      onLeftGroup();
    } finally {
      setLeaving(false);
    }
  }

  const photos = media.filter((m) => m.type === "image" || m.type === "video");
  const docs = media.filter((m) => m.type === "document");

  return (
    <>
      <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
        <SheetContent className="w-full sm:max-w-[400px] p-0 flex flex-col gap-0" style={{ background: "var(--surface-bg)" }}>
          <SheetHeader className="flex-shrink-0 px-5 py-4 border-b" style={{ borderColor: "var(--line)" }}>
            <SheetTitle className="h3" style={{ color: "var(--ink)" }}>
              {isGroup ? "Group Info" : "Contact Info"}
            </SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto">
            {/* Identity block */}
            <div className="flex flex-col items-center gap-3 px-5 py-6" style={{ borderBottom: "1px solid var(--line-soft)" }}>
              <Avatar className="w-20 h-20">
                <AvatarImage src={(isGroup ? conversation.avatar_url : other?.avatar_url) ?? undefined} />
                <AvatarFallback className="text-[22px] font-bold" style={{ background: "var(--navy-l)", color: "var(--navy)" }}>
                  {isGroup ? initials(conversation.name) : initials(other?.full_name, other?.email)}
                </AvatarFallback>
              </Avatar>
              <div className="text-center">
                <p className="text-[17px] font-bold" style={{ color: "var(--ink)" }}>
                  {isGroup ? conversation.name ?? "Unnamed Group" : other?.full_name ?? other?.email ?? "Unknown"}
                </p>
                <p className="text-[13px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                  {isGroup
                    ? `${conversation.members?.length ?? 0} member${(conversation.members?.length ?? 0) !== 1 ? "s" : ""}`
                    : other?.email ?? formatLastSeen(other?.last_seen_at ?? null)}
                </p>
                {isGroup && conversation.description && (
                  <p className="text-[12px] mt-2 max-w-xs" style={{ color: "var(--text-secondary)" }}>{conversation.description}</p>
                )}
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b px-2" style={{ borderColor: "var(--line)" }}>
              {(["info", "media"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className="flex-1 py-2.5 text-[13px] font-semibold border-b-2 transition-colors"
                  style={{
                    borderBottomColor: tab === t ? "var(--navy)" : "transparent",
                    color: tab === t ? "var(--navy)" : "var(--text-muted)",
                  }}
                >
                  {t === "info" ? (isGroup ? "Members" : "Info") : "Media & Files"}
                </button>
              ))}
            </div>

            <div className="p-4">
              {tab === "info" ? (
                isGroup ? (
                  <div className="flex flex-col gap-1">
                    {(conversation.members ?? []).map((m) => (
                      <div key={m.user_id} className="flex items-center gap-2.5 py-2 px-2 rounded-lg" style={{ background: "var(--panel-bg)" }}>
                        <Avatar className="h-8 w-8 flex-shrink-0">
                          <AvatarImage src={m.profile?.avatar_url ?? undefined} />
                          <AvatarFallback className="text-[11px] font-semibold" style={{ background: "var(--navy-l)", color: "var(--navy)" }}>
                            {initials(m.profile?.full_name, m.profile?.email)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-medium truncate" style={{ color: "var(--ink)" }}>
                            {m.profile?.full_name ?? m.profile?.email ?? "Unknown"}
                            {m.user_id === currentUserId && <span className="ml-1.5 text-[11px] font-normal" style={{ color: "var(--text-muted)" }}>(you)</span>}
                          </p>
                        </div>
                        {m.role === "owner" && (
                          <span className="flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded flex-shrink-0" style={{ background: "var(--navy-l)", color: "var(--navy)" }}>
                            <Crown className="h-2.5 w-2.5" /> Owner
                          </span>
                        )}
                        {m.role === "admin" && (
                          <span className="flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded flex-shrink-0" style={{ background: "var(--accent-bg)", color: "var(--accent-brand)" }}>
                            <Shield className="h-2.5 w-2.5" /> Admin
                          </span>
                        )}
                      </div>
                    ))}

                    <button
                      onClick={() => setConfirmLeave(true)}
                      className="flex items-center gap-2 mt-3 py-2.5 px-2 rounded-lg text-[13px] font-semibold transition-colors hover:bg-[var(--clr-red-bg)]"
                      style={{ color: "var(--clr-red)" }}
                    >
                      <LogOut className="h-4 w-4" /> Leave group
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    <div className="rounded-xl p-3" style={{ background: "var(--panel-bg)" }}>
                      <p className="text-[11px] font-bold uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>Email</p>
                      <p className="text-[13px]" style={{ color: "var(--ink)" }}>{other?.email ?? "—"}</p>
                    </div>
                    <div className="rounded-xl p-3" style={{ background: "var(--panel-bg)" }}>
                      <p className="text-[11px] font-bold uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>Status</p>
                      <p className="text-[13px]" style={{ color: "var(--ink)" }}>{formatLastSeen(other?.last_seen_at ?? null)}</p>
                    </div>
                  </div>
                )
              ) : loadingMedia ? (
                <p className="text-[13px] text-center py-6" style={{ color: "var(--text-muted)" }}>Loading…</p>
              ) : media.length === 0 ? (
                <p className="text-[13px] text-center py-6" style={{ color: "var(--text-fine)" }}>No media or files shared yet.</p>
              ) : (
                <div className="flex flex-col gap-5">
                  {photos.length > 0 && (
                    <div className="flex flex-col gap-2">
                      <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Photos & Videos</p>
                      <div className="grid grid-cols-3 gap-1.5">
                        {photos.map((item) => (
                          <button
                            key={item.id}
                            onClick={() => setViewerItem(item)}
                            className="relative aspect-square rounded-lg overflow-hidden"
                            style={{ background: "var(--panel-bg)" }}
                          >
                            {item.type === "image" ? (
                              <img src={item.metadata?.url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <>
                                <video src={item.metadata?.url} className="w-full h-full object-cover" />
                                <Film className="absolute bottom-1.5 right-1.5 h-3.5 w-3.5 text-white drop-shadow" />
                              </>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {docs.length > 0 && (
                    <div className="flex flex-col gap-2">
                      <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Documents</p>
                      <div className="flex flex-col gap-1.5">
                        {docs.map((item) => (
                          <a
                            key={item.id}
                            href={item.metadata?.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 transition-colors hover:bg-[var(--panel-bg)]"
                          >
                            <FileText className="h-6 w-6 flex-shrink-0" style={{ color: "var(--navy)" }} />
                            <div className="flex-1 min-w-0">
                              <p className="text-[12.5px] font-medium truncate" style={{ color: "var(--ink)" }}>{item.metadata?.filename ?? "Document"}</p>
                              {item.metadata?.size != null && (
                                <p className="text-[10.5px]" style={{ color: "var(--text-muted)" }}>{formatFileSize(item.metadata.size)}</p>
                              )}
                            </div>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {viewerItem && viewerItem.metadata?.url && (viewerItem.type === "image" || viewerItem.type === "video") && (
        <MediaViewer
          src={viewerItem.metadata.url}
          type={viewerItem.type}
          filename={viewerItem.metadata.filename}
          onClose={() => setViewerItem(null)}
        />
      )}

      <ConfirmDialog
        open={confirmLeave}
        onOpenChange={setConfirmLeave}
        title="Leave this group?"
        description="You'll stop receiving messages from this group. You can only rejoin if someone adds you back."
        confirmLabel="Leave"
        destructive
        loading={leaving}
        onConfirm={handleLeave}
      />
    </>
  );
}
