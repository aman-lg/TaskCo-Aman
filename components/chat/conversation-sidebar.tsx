"use client";

import { useState, useMemo } from "react";
import { PenSquare, Search, X } from "lucide-react";
import type { Conversation, ChatProfile } from "@/types/chat";
import { ConversationItem } from "./conversation-item";
import { NewChatDialog } from "./new-chat-dialog";

type Filter = "all" | "direct" | "groups" | "archived";

interface Props {
  conversations: Conversation[];
  currentUserId: string;
  currentUserProfile: ChatProfile;
  activeConversationId?: string;
  onlineUserIds: Set<string>;
}

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all",      label: "All" },
  { key: "direct",   label: "Direct" },
  { key: "groups",   label: "Groups" },
  { key: "archived", label: "Archived" },
];

export function ConversationSidebar({
  conversations,
  currentUserId,
  currentUserProfile,
  activeConversationId,
  onlineUserIds,
}: Props) {
  const [search, setSearch]           = useState("");
  const [filter, setFilter]           = useState<Filter>("all");
  const [newChatOpen, setNewChatOpen] = useState(false);

  const filtered = useMemo(() => {
    let list = conversations;

    if (filter === "archived") {
      list = list.filter(c => c.my_member?.is_archived);
    } else if (filter === "direct") {
      list = list.filter(c => c.type === "direct" || c.type === "self");
    } else if (filter === "groups") {
      list = list.filter(c => c.type === "group");
    } else {
      list = list.filter(c => !c.my_member?.is_archived);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(c => {
        const name = c.type === "self"
          ? "my notes"
          : c.type === "group"
          ? (c.name ?? "")
          : (c.other_user?.full_name ?? c.other_user?.email ?? "");
        return (
          name.toLowerCase().includes(q) ||
          (c.last_message?.content ?? "").toLowerCase().includes(q)
        );
      });
    }

    return list;
  }, [conversations, filter, search]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div
        className="flex-shrink-0 flex items-center justify-between px-4 py-3"
        style={{ borderBottom: "1px solid var(--line-soft)" }}
      >
        <h2
          className="text-[16px] font-bold"
          style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}
        >
          Messages
        </h2>
        <button
          type="button"
          onClick={() => setNewChatOpen(true)}
          className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
          style={{ color: "var(--navy)" }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--navy-l)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
          aria-label="New message"
        >
          <PenSquare className="w-4 h-4" />
        </button>
      </div>

      {/* Search */}
      <div className="flex-shrink-0 px-3 py-2">
        <div
          className="flex items-center gap-2 h-8 rounded-lg px-3"
          style={{ background: "var(--panel-bg)", border: "1px solid var(--line-soft)" }}
        >
          <Search className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--text-muted)" }} />
          <input
            type="text"
            placeholder="Search messages…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 text-[13px] outline-none bg-transparent"
            style={{ color: "var(--ink)" }}
          />
          {search && (
            <button type="button" onClick={() => setSearch("")} style={{ color: "var(--text-muted)" }}>
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Filter tabs */}
      <div
        className="flex-shrink-0 flex gap-1 px-3 pb-2 overflow-x-auto"
        style={{ scrollbarWidth: "none" }}
      >
        {FILTERS.map(f => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className="flex-shrink-0 h-6 px-3 rounded-full text-[11px] font-semibold transition-colors"
            style={{
              background: filter === f.key ? "var(--navy)" : "var(--panel-bg)",
              color: filter === f.key ? "#fff" : "var(--text-secondary)",
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto py-1" style={{ scrollbarWidth: "none" }}>
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 gap-2 px-4">
            <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>
              {search ? "No results" : filter === "archived" ? "No archived chats" : "No conversations yet"}
            </p>
          </div>
        ) : (
          <div className="flex flex-col px-2">
            {filtered.map((conv, idx) => {
              const prevConv = filtered[idx - 1];
              const showDivider = idx > 0 && conv.type !== "self" && prevConv?.type === "self";
              return (
                <div key={conv.id}>
                  {showDivider && (
                    <div className="mx-2 my-1" style={{ borderTop: "1px solid var(--line-soft)" }} />
                  )}
                  <ConversationItem
                    conversation={conv}
                    currentUserId={currentUserId}
                    isActive={conv.id === activeConversationId}
                    isOnline={!!conv.other_user && onlineUserIds.has(conv.other_user.id)}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      <NewChatDialog
        open={newChatOpen}
        onClose={() => setNewChatOpen(false)}
        currentUserId={currentUserId}
      />
    </div>
  );
}
