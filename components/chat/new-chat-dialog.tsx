"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { X, Search, Loader2, Users, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  email: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  currentUserId: string;
}

type Tab = "direct" | "group";

function initials(name: string | null, email: string | null) {
  if (name) return name.split(" ").map(p => p[0]).join("").toUpperCase().slice(0, 2);
  return (email?.[0] ?? "?").toUpperCase();
}

export function NewChatDialog({ open, onClose, currentUserId }: Props) {
  const router = useRouter();
  const [tab, setTab]               = useState<Tab>("direct");
  const [profiles, setProfiles]     = useState<Profile[]>([]);
  const [loading, setLoading]       = useState(false);
  const [creating, setCreating]     = useState(false);
  const [search, setSearch]         = useState("");
  const [groupName, setGroupName]   = useState("");
  const [selected, setSelected]     = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open || profiles.length > 0) return;
    setLoading(true);
    fetch("/api/profile/all")
      .then(r => r.json())
      .then(j => setProfiles((j.data ?? []).filter((p: Profile) => p.id !== currentUserId)))
      .finally(() => setLoading(false));
  }, [open, profiles.length, currentUserId]);

  const filteredProfiles = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return profiles;
    return profiles.filter(p =>
      (p.full_name ?? "").toLowerCase().includes(q) ||
      (p.email ?? "").toLowerCase().includes(q)
    );
  }, [profiles, search]);

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function startDM(profileId: string) {
    setCreating(true);
    try {
      const res = await fetch("/api/chat/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "direct", member_ids: [profileId] }),
      });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error?.message ?? "Failed to start chat."); return; }
      onClose();
      router.push(`/chat/${json.data.conversation.id}`);
    } finally {
      setCreating(false);
    }
  }

  async function createGroup() {
    if (!groupName.trim()) { toast.error("Group name is required."); return; }
    if (selected.size === 0) { toast.error("Add at least one member."); return; }
    setCreating(true);
    try {
      const res = await fetch("/api/chat/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "group", name: groupName.trim(), member_ids: Array.from(selected) }),
      });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error?.message ?? "Failed to create group."); return; }
      onClose();
      router.push(`/chat/${json.data.conversation.id}`);
    } finally {
      setCreating(false);
    }
  }

  function handleClose() {
    setSearch(""); setGroupName(""); setSelected(new Set()); setTab("direct");
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) handleClose(); }}>
      <DialogContent className="sm:max-w-[440px] p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-0">
          <DialogTitle style={{ fontFamily: "var(--font-display)" }}>New Message</DialogTitle>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex gap-0 px-5 pt-3 border-b" style={{ borderColor: "var(--line-soft)" }}>
          {([["direct", MessageSquare, "Direct message"], ["group", Users, "New group"]] as const).map(([key, Icon, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => { setTab(key); setSearch(""); setSelected(new Set()); }}
              className="flex items-center gap-2 h-9 px-4 text-[13px] font-medium border-b-2 transition-colors -mb-px"
              style={{
                borderColor: tab === key ? "var(--navy)" : "transparent",
                color: tab === key ? "var(--navy)" : "var(--text-muted)",
              }}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        <div className="px-5 py-4 flex flex-col gap-3">
          {tab === "group" && (
            <input
              type="text"
              placeholder="Group name…"
              value={groupName}
              onChange={e => setGroupName(e.target.value)}
              className="h-9 px-3 rounded-lg text-[13px] outline-none w-full"
              style={{ background: "var(--panel-bg)", border: "1px solid var(--line)", color: "var(--ink)" }}
            />
          )}

          {/* Search */}
          <div
            className="flex items-center gap-2 h-8 rounded-lg px-3"
            style={{ background: "var(--panel-bg)", border: "1px solid var(--line-soft)" }}
          >
            <Search className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--text-muted)" }} />
            <input
              type="text"
              placeholder="Search people…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="flex-1 text-[13px] outline-none bg-transparent"
              style={{ color: "var(--ink)" }}
            />
          </div>

          {/* Selected for group */}
          {tab === "group" && selected.size > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {Array.from(selected).map(id => {
                const p = profiles.find(x => x.id === id);
                if (!p) return null;
                return (
                  <span
                    key={id}
                    className="flex items-center gap-1.5 h-6 px-2 rounded-full text-[11px] font-medium"
                    style={{ background: "var(--navy-l)", color: "var(--navy)" }}
                  >
                    {p.full_name ?? p.email}
                    <button type="button" onClick={() => toggleSelect(id)}>
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                );
              })}
            </div>
          )}

          {/* Profile list */}
          <div className="flex flex-col gap-0.5 max-h-56 overflow-y-auto -mx-1">
            {loading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--text-muted)" }} />
              </div>
            ) : filteredProfiles.length === 0 ? (
              <p className="text-[13px] text-center py-4" style={{ color: "var(--text-muted)" }}>
                No users found
              </p>
            ) : filteredProfiles.map(p => {
              const isChecked = selected.has(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => tab === "direct" ? startDM(p.id) : toggleSelect(p.id)}
                  disabled={creating}
                  className="flex items-center gap-3 px-3 py-2 rounded-xl text-left transition-colors"
                  style={{ background: isChecked ? "var(--navy-l)" : "transparent" }}
                  onMouseEnter={e => { if (!isChecked) (e.currentTarget as HTMLElement).style.background = "var(--panel-bg)"; }}
                  onMouseLeave={e => { if (!isChecked) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                >
                  <Avatar className="w-8 h-8 flex-shrink-0">
                    <AvatarImage src={p.avatar_url ?? undefined} />
                    <AvatarFallback className="text-[11px] font-semibold" style={{ background: "var(--navy-l)", color: "var(--navy)" }}>
                      {initials(p.full_name, p.email)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium truncate" style={{ color: "var(--ink)" }}>
                      {p.full_name ?? "Unnamed"}
                    </p>
                    <p className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>{p.email}</p>
                  </div>
                  {tab === "group" && (
                    <div
                      className="w-4 h-4 rounded border flex items-center justify-center flex-shrink-0"
                      style={{
                        background: isChecked ? "var(--navy)" : "transparent",
                        borderColor: isChecked ? "var(--navy)" : "var(--line)",
                      }}
                    >
                      {isChecked && <span className="text-white text-[10px]">✓</span>}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {tab === "group" && (
            <button
              type="button"
              onClick={createGroup}
              disabled={creating || selected.size === 0 || !groupName.trim()}
              className="h-9 rounded-xl text-[13px] font-semibold text-white transition-opacity disabled:opacity-50"
              style={{ background: "var(--navy)" }}
            >
              {creating ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : `Create Group (${selected.size} member${selected.size !== 1 ? "s" : ""})`}
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
