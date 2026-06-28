"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Shield, ShieldOff, User } from "lucide-react";
import { toast } from "sonner";

interface UserProfile {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  is_admin: boolean;
  created_at: string;
}

interface TaskRow {
  id: string;
  name: string;
  status: string;
  urgency: string | null;
  deadline: string | null;
  created_at: string;
  project_id: string;
  projects: { name: string } | null;
}

interface UserDetail {
  profile: UserProfile;
  tasks: TaskRow[];
}

const STATUS_LABEL: Record<string, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  done: "Done",
};
const STATUS_TOKEN: Record<string, string> = {
  todo: "--status-todo",
  in_progress: "--status-in-progress",
  done: "--status-done",
};

export function AdminUsersClient({
  users: initialUsers,
  currentUserId,
}: {
  users: UserProfile[];
  currentUserId: string;
}) {
  const [users, setUsers] = useState<UserProfile[]>(initialUsers);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [detail, setDetail] = useState<Record<string, UserDetail>>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  async function toggleExpand(userId: string) {
    if (expanded === userId) {
      setExpanded(null);
      return;
    }
    setExpanded(userId);
    if (detail[userId]) return; // already loaded

    setLoadingId(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, { credentials: "same-origin" });
      if (!res.ok) throw new Error("Failed to load");
      const { data } = await res.json();
      setDetail((prev) => ({ ...prev, [userId]: data }));
    } catch {
      toast.error("Could not load user details");
      setExpanded(null);
    } finally {
      setLoadingId(null);
    }
  }

  async function toggleAdmin(user: UserProfile) {
    setTogglingId(user.id);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ is_admin: !user.is_admin }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast.error(body?.error?.message ?? "Failed to update");
        return;
      }
      setUsers((prev) =>
        prev.map((u) => u.id === user.id ? { ...u, is_admin: !u.is_admin } : u)
      );
      // also update cached detail if loaded
      setDetail((prev) =>
        prev[user.id]
          ? { ...prev, [user.id]: { ...prev[user.id], profile: { ...prev[user.id].profile, is_admin: !user.is_admin } } }
          : prev
      );
      toast.success(`${user.full_name ?? "User"} is ${!user.is_admin ? "now an admin" : "no longer an admin"}`);
    } finally {
      setTogglingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {users.map((user) => {
        const isExpanded = expanded === user.id;
        const userDetail = detail[user.id];
        const isLoading = loadingId === user.id;
        const isToggling = togglingId === user.id;
        const isSelf = user.id === currentUserId;

        return (
          <div
            key={user.id}
            className="rounded-xl border overflow-hidden"
            style={{ borderColor: "var(--line)", background: "var(--panel-bg)" }}
          >
            {/* Row */}
            <div className="flex items-center gap-3 px-4 py-3">
              {/* Avatar */}
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-white text-sm font-bold"
                style={{ background: "var(--navy)" }}
              >
                {user.avatar_url
                  ? <img src={user.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                  : <User className="w-4 h-4" />
                }
              </div>

              {/* Name + email */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[14px] font-semibold truncate" style={{ color: "var(--ink)" }}>
                    {user.full_name ?? "—"}
                  </span>
                  {user.is_admin && (
                    <span
                      className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded"
                      style={{ background: "var(--accent-bg)", color: "var(--accent-brand)" }}
                    >
                      <Shield className="w-2.5 h-2.5" /> ADMIN
                    </span>
                  )}
                  {isSelf && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: "var(--line)", color: "var(--text-muted)" }}>
                      YOU
                    </span>
                  )}
                </div>
                <span className="text-[12px] truncate" style={{ color: "var(--text-secondary)" }}>
                  {user.email}
                </span>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {!isSelf && (
                  <button
                    onClick={() => toggleAdmin(user)}
                    disabled={isToggling}
                    className="flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-lg border transition-opacity disabled:opacity-50"
                    style={{
                      borderColor: user.is_admin ? "var(--clr-red)" : "var(--accent-brand)",
                      color: user.is_admin ? "var(--clr-red)" : "var(--accent-brand)",
                      background: "transparent",
                    }}
                    title={user.is_admin ? "Remove admin" : "Make admin"}
                  >
                    {user.is_admin
                      ? <><ShieldOff className="w-3.5 h-3.5" /> Remove Admin</>
                      : <><Shield className="w-3.5 h-3.5" /> Make Admin</>
                    }
                  </button>
                )}
                <button
                  onClick={() => toggleExpand(user.id)}
                  className="p-1.5 rounded-lg transition-opacity hover:opacity-70"
                  style={{ color: "var(--text-muted)" }}
                  aria-label={isExpanded ? "Collapse" : "Expand"}
                >
                  {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Expanded detail */}
            {isExpanded && (
              <div
                className="border-t px-4 py-4"
                style={{ borderColor: "var(--line)", background: "var(--surface-bg)" }}
              >
                {isLoading ? (
                  <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>Loading…</p>
                ) : userDetail ? (
                  <div>
                    <p className="text-[12px] font-bold uppercase tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>
                      Tasks ({userDetail.tasks.length})
                    </p>
                    {userDetail.tasks.length === 0 ? (
                      <p className="text-[13px]" style={{ color: "var(--text-fine)" }}>No tasks created.</p>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {userDetail.tasks.map((task) => (
                          <div
                            key={task.id}
                            className="flex items-center gap-3 px-3 py-2.5 rounded-lg border"
                            style={{ borderColor: "var(--line)", background: "var(--panel-bg)" }}
                          >
                            <span
                              className="w-2 h-2 rounded-full flex-shrink-0"
                              style={{ background: `var(${STATUS_TOKEN[task.status] ?? "--status-todo"})` }}
                            />
                            <span className="flex-1 text-[13px] font-medium truncate" style={{ color: "var(--ink)" }}>
                              {task.name}
                            </span>
                            <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                              {task.projects?.name ?? "—"}
                            </span>
                            <span
                              className="text-[11px] font-semibold px-2 py-0.5 rounded"
                              style={{ background: "var(--line)", color: "var(--text-secondary)" }}
                            >
                              {STATUS_LABEL[task.status] ?? task.status}
                            </span>
                            {task.deadline && (
                              <span className="text-[11px] flex-shrink-0" style={{ color: "var(--text-muted)" }}>
                                {new Date(task.deadline).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
