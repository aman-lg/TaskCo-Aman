"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, X, Crown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface Member {
  user_id: string;
  added_at: string;
  profile: { id: string; full_name: string | null; avatar_url: string | null; email: string | null };
}

interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  email: string | null;
}

interface Props {
  projectId: string;
  ownerId: string;
  currentUserId: string;
  isAdmin: boolean;
}

function initials(name?: string | null, email?: string | null) {
  if (name) return name.split(" ").map(p => p[0]).join("").toUpperCase().slice(0, 2);
  return (email?.[0] ?? "?").toUpperCase();
}

export function ProjectMembersPanel({ projectId, ownerId, currentUserId, isAdmin }: Props) {
  const router = useRouter();
  const canManage = currentUserId === ownerId || isAdmin;

  const [members, setMembers] = useState<Member[]>([]);
  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [adding, setAdding] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showPicker, setShowPicker] = useState(false);

  const loadMembers = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}/members`);
    if (res.ok) {
      const json = await res.json();
      setMembers(json.data ?? []);
    }
    setLoadingMembers(false);
  }, [projectId]);

  useEffect(() => { loadMembers(); }, [loadMembers]);

  // Load all profiles once when picker opens
  useEffect(() => {
    if (!showPicker || allProfiles.length > 0) return;
    fetch("/api/profile/all")
      .then(r => r.json())
      .then(j => setAllProfiles(j.data ?? []));
  }, [showPicker, allProfiles.length]);

  const memberIds = new Set(members.map(m => m.user_id));

  const filteredProfiles = allProfiles.filter(p =>
    !memberIds.has(p.id) &&
    ((p.full_name ?? "").toLowerCase().includes(search.toLowerCase()) ||
     (p.email ?? "").toLowerCase().includes(search.toLowerCase()))
  );

  async function addMember(userId: string) {
    setAdding(userId);
    try {
      const res = await fetch(`/api/projects/${projectId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error?.message ?? "Failed to add member.");
        return;
      }
      await loadMembers();
      router.refresh();
      toast.success("Member added.");
    } finally {
      setAdding(null);
    }
  }

  async function removeMember(userId: string) {
    setRemoving(userId);
    try {
      const res = await fetch(`/api/projects/${projectId}/members?user_id=${userId}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error?.message ?? "Failed to remove member.");
        return;
      }
      await loadMembers();
      router.refresh();
      toast.success("Member removed.");
    } finally {
      setRemoving(null);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[13px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
          Members
        </h3>
        {canManage && (
          <button
            onClick={() => setShowPicker(v => !v)}
            className="flex items-center gap-1.5 h-7 px-3 rounded-lg text-[12px] font-semibold transition-colors"
            style={{
              background: showPicker ? "var(--navy)" : "var(--navy-l)",
              color: showPicker ? "#fff" : "var(--navy)",
            }}
          >
            <UserPlus className="h-3.5 w-3.5" />
            Add member
          </button>
        )}
      </div>

      {/* Add member picker */}
      {showPicker && canManage && (
        <div
          className="mb-4 rounded-xl p-3 flex flex-col gap-2"
          style={{ background: "var(--panel-bg)", border: "1px solid var(--line-soft)" }}
        >
          <input
            type="text"
            placeholder="Search by name or email…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full h-8 px-3 rounded-lg text-[13px] outline-none"
            style={{
              background: "var(--surface-bg)",
              border: "1px solid var(--line)",
              color: "var(--ink)",
            }}
          />
          <div className="flex flex-col gap-1 max-h-40 overflow-y-auto">
            {filteredProfiles.length === 0 ? (
              <p className="text-[12px] text-center py-2" style={{ color: "var(--text-muted)" }}>
                {search ? "No users match your search" : "All users are already members"}
              </p>
            ) : filteredProfiles.map(p => (
              <div key={p.id} className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-[var(--line-soft)]">
                <Avatar className="h-6 w-6 flex-shrink-0">
                  <AvatarImage src={p.avatar_url ?? undefined} />
                  <AvatarFallback className="text-[10px]" style={{ background: "var(--navy-l)", color: "var(--navy)" }}>
                    {initials(p.full_name, p.email)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-medium truncate" style={{ color: "var(--ink)" }}>{p.full_name ?? "Unnamed"}</p>
                  <p className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>{p.email}</p>
                </div>
                <button
                  onClick={() => addMember(p.id)}
                  disabled={adding === p.id}
                  className="h-6 px-2.5 rounded text-[11px] font-semibold transition-colors flex-shrink-0"
                  style={{ background: "var(--navy)", color: "#fff" }}
                >
                  {adding === p.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Add"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Member list */}
      {loadingMembers ? (
        <div className="flex items-center gap-2 py-2" style={{ color: "var(--text-muted)" }}>
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-[13px]">Loading members…</span>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {members.map(m => {
            const isOwner = m.user_id === ownerId;
            const isSelf = m.user_id === currentUserId;
            return (
              <div
                key={m.user_id}
                className="flex items-center gap-2.5 py-2 px-2.5 rounded-xl"
                style={{ background: "var(--panel-bg)" }}
              >
                <Avatar className="h-8 w-8 flex-shrink-0">
                  <AvatarImage src={m.profile.avatar_url ?? undefined} />
                  <AvatarFallback
                    className="text-[11px] font-semibold"
                    style={{ background: "var(--navy-l)", color: "var(--navy)" }}
                  >
                    {initials(m.profile.full_name, m.profile.email)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium truncate" style={{ color: "var(--ink)" }}>
                    {m.profile.full_name ?? "Unnamed user"}
                    {isSelf && <span className="ml-1.5 text-[11px] font-normal" style={{ color: "var(--text-muted)" }}>(you)</span>}
                  </p>
                  <p className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>{m.profile.email}</p>
                </div>
                {isOwner ? (
                  <span className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                    style={{ background: "var(--navy-l)", color: "var(--navy)" }}>
                    <Crown className="h-3 w-3" /> Owner
                  </span>
                ) : canManage ? (
                  <button
                    onClick={() => removeMember(m.user_id)}
                    disabled={removing === m.user_id}
                    className="p-1.5 rounded-lg transition-colors flex-shrink-0 hover:bg-[var(--clr-red-bg)]"
                    style={{ color: "var(--clr-red)" }}
                    title="Remove member"
                  >
                    {removing === m.user_id
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <X className="h-3.5 w-3.5" />}
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
