"use client";

import { useState } from "react";
import {
  ChevronDown, ChevronRight, Shield, ShieldOff, User, X,
  Loader2, CheckCircle, Clock, FolderKanban, ListTodo, Mail
} from "lucide-react";
import { toast } from "sonner";

interface UserProfile {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  phone: string | null;
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

interface ProjectRow {
  id: string;
  title: string;
  status: string;
  urgency: string | null;
  deadline: string | null;
  created_at: string;
}

interface AttendanceRow {
  id: string;
  clock_in: string;
  clock_out: string | null;
  duration_seconds: number | null;
}

interface UserDetail {
  profile: UserProfile;
  tasks: TaskRow[];
  projects: ProjectRow[];
  attendance: AttendanceRow[];
}

const STATUS_LABEL: Record<string, string> = { todo: "To Do", in_progress: "In Progress", done: "Done" };
const STATUS_TOKEN: Record<string, string> = { todo: "--status-todo", in_progress: "--status-in-progress", done: "--status-done" };

function formatHours(seconds: number | null) {
  if (!seconds) return "0h 0m";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

function getInitials(name: string | null, email: string | null) {
  if (name) return name.split(" ").map(p => p[0]).join("").toUpperCase().slice(0, 2);
  return (email?.[0] ?? "U").toUpperCase();
}

// ── Invite Modal ────────────────────────────────────────────────────────────

function InviteModal({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleInvite() {
    if (!email.trim()) return;
    setSending(true);
    try {
      const res = await fetch("/api/admin/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(body?.error?.message ?? "Failed to send invite");
        return;
      }
      setSent(true);
      toast.success(`Invite sent to ${email}`);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.4)" }}>
      <div
        className="w-full max-w-md rounded-2xl border p-6 flex flex-col gap-5"
        style={{ background: "var(--surface-bg)", borderColor: "var(--line)" }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-[16px] font-bold" style={{ color: "var(--ink)" }}>Invite User</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:opacity-70" style={{ color: "var(--text-muted)" }}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {sent ? (
          <div className="flex flex-col items-center gap-3 py-4">
            <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: "color-mix(in srgb, var(--clr-green) 12%, transparent)" }}>
              <CheckCircle className="w-6 h-6" style={{ color: "var(--clr-green)" }} />
            </div>
            <p className="text-[14px] font-semibold text-center" style={{ color: "var(--ink)" }}>Invite sent!</p>
            <p className="text-[13px] text-center" style={{ color: "var(--text-secondary)" }}>
              An invitation email was sent to <strong>{email}</strong>.
            </p>
            <button
              onClick={onClose}
              className="mt-2 h-9 px-5 rounded-lg text-[13px] font-bold text-white"
              style={{ background: "var(--navy)" }}
            >
              Done
            </button>
          </div>
        ) : (
          <>
            <p className="text-[13px]" style={{ color: "var(--text-secondary)" }}>
              The user will receive an email to set up their account.
            </p>
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-semibold" style={{ color: "var(--text-muted)" }}>Email address</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value.toLowerCase())}
                placeholder="user@example.com"
                className="h-10 px-3 rounded-lg border text-[13px] outline-none"
                style={{
                  borderColor: "var(--line)",
                  background: "var(--panel-bg)",
                  color: "var(--ink)",
                  textTransform: "lowercase",
                }}
                onKeyDown={e => e.key === "Enter" && !sending && handleInvite()}
                onFocus={e => (e.currentTarget.style.borderColor = "var(--navy)")}
                onBlur={e => (e.currentTarget.style.borderColor = "var(--line)")}
                autoFocus
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={onClose}
                className="h-9 px-4 rounded-lg text-[13px] font-semibold border"
                style={{ borderColor: "var(--line)", color: "var(--text-secondary)", background: "transparent" }}
              >
                Cancel
              </button>
              <button
                onClick={handleInvite}
                disabled={sending || !email.trim()}
                className="h-9 px-5 rounded-lg text-[13px] font-bold text-white flex items-center gap-2 disabled:opacity-40"
                style={{ background: "var(--navy)" }}
              >
                {sending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Send Invite
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── User Detail Panel ────────────────────────────────────────────────────────

type DetailTab = "overview" | "tasks" | "projects" | "attendance";

function UserDetailPanel({ detail }: { detail: UserDetail }) {
  const [tab, setTab] = useState<DetailTab>("overview");
  const { tasks, projects, attendance } = detail;

  const todo = tasks.filter(t => t.status === "todo").length;
  const inProgress = tasks.filter(t => t.status === "in_progress").length;
  const done = tasks.filter(t => t.status === "done").length;
  const totalTasks = tasks.length;

  // Attendance: group by date, sum duration
  const attendanceByDay = attendance.reduce<Record<string, number>>((acc, s) => {
    const day = s.clock_in.slice(0, 10);
    acc[day] = (acc[day] ?? 0) + (s.duration_seconds ?? 0);
    return acc;
  }, {});
  const totalHours = Object.values(attendanceByDay).reduce((a, b) => a + b, 0);

  const TABS: { id: DetailTab; label: string; icon: React.ReactNode }[] = [
    { id: "overview", label: "Overview", icon: <User className="w-3.5 h-3.5" /> },
    { id: "tasks", label: `Tasks (${totalTasks})`, icon: <ListTodo className="w-3.5 h-3.5" /> },
    { id: "projects", label: `Projects (${projects.length})`, icon: <FolderKanban className="w-3.5 h-3.5" /> },
    { id: "attendance", label: "Timing", icon: <Clock className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="border-t" style={{ borderColor: "var(--line)", background: "var(--surface-bg)" }}>
      {/* Tabs */}
      <div className="flex gap-0 border-b px-2 overflow-x-auto" style={{ borderColor: "var(--line)" }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="flex items-center gap-1.5 px-2 sm:px-3 py-2.5 text-[11px] sm:text-[12px] font-semibold border-b-2 transition-colors whitespace-nowrap flex-shrink-0"
            style={{
              borderBottomColor: tab === t.id ? "var(--navy)" : "transparent",
              color: tab === t.id ? "var(--navy)" : "var(--text-muted)",
              marginBottom: -1,
            }}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      <div className="p-4">
        {/* Overview tab */}
        {tab === "overview" && (
          <div className="flex flex-col gap-4">
            {/* Task progress bar */}
            {totalTasks > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-[12px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Task Progress</p>
                <div className="h-2 rounded-full overflow-hidden flex gap-0.5" style={{ background: "var(--line)" }}>
                  {done > 0 && <div className="h-full rounded-full" style={{ width: `${(done / totalTasks) * 100}%`, background: "var(--status-done)" }} />}
                  {inProgress > 0 && <div className="h-full rounded-full" style={{ width: `${(inProgress / totalTasks) * 100}%`, background: "var(--status-in-progress)" }} />}
                  {todo > 0 && <div className="h-full rounded-full" style={{ width: `${(todo / totalTasks) * 100}%`, background: "var(--line-soft)" }} />}
                </div>
                <div className="flex gap-4">
                  {[
                    { label: "Done", count: done, token: "--status-done" },
                    { label: "In Progress", count: inProgress, token: "--status-in-progress" },
                    { label: "To Do", count: todo, token: "--status-todo" },
                  ].map(s => (
                    <div key={s.label} className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ background: `var(${s.token})` }} />
                      <span className="text-[12px]" style={{ color: "var(--text-secondary)" }}>{s.label}: <strong style={{ color: "var(--ink)" }}>{s.count}</strong></span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Projects", value: projects.length, icon: <FolderKanban className="w-4 h-4" /> },
                { label: "Total Tasks", value: totalTasks, icon: <ListTodo className="w-4 h-4" /> },
                { label: "Hours Logged", value: formatHours(totalHours), icon: <Clock className="w-4 h-4" /> },
              ].map(s => (
                <div key={s.label} className="rounded-xl border p-3 flex flex-col gap-1" style={{ borderColor: "var(--line)", background: "var(--panel-bg)" }}>
                  <div className="flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}>{s.icon}<span className="text-[11px] font-semibold">{s.label}</span></div>
                  <p className="text-[20px] font-bold" style={{ color: "var(--ink)" }}>{s.value}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tasks tab */}
        {tab === "tasks" && (
          <div className="flex flex-col gap-2">
            {tasks.length === 0 ? (
              <p className="text-[13px] py-4 text-center" style={{ color: "var(--text-fine)" }}>No tasks created.</p>
            ) : tasks.map(task => (
              <div key={task.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg border" style={{ borderColor: "var(--line)", background: "var(--panel-bg)" }}>
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: `var(${STATUS_TOKEN[task.status] ?? "--status-todo"})` }} />
                <span className="flex-1 text-[13px] font-medium truncate" style={{ color: "var(--ink)" }}>{task.name}</span>
                <span className="text-[11px] truncate max-w-[100px]" style={{ color: "var(--text-muted)" }}>{task.projects?.name ?? "—"}</span>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded flex-shrink-0" style={{ background: "var(--line)", color: "var(--text-secondary)" }}>
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

        {/* Projects tab */}
        {tab === "projects" && (
          <div className="flex flex-col gap-2">
            {projects.length === 0 ? (
              <p className="text-[13px] py-4 text-center" style={{ color: "var(--text-fine)" }}>No projects owned.</p>
            ) : projects.map(proj => (
              <div key={proj.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg border" style={{ borderColor: "var(--line)", background: "var(--panel-bg)" }}>
                <FolderKanban className="w-4 h-4 flex-shrink-0" style={{ color: "var(--accent-brand)" }} />
                <span className="flex-1 text-[13px] font-medium truncate" style={{ color: "var(--ink)" }}>{proj.title}</span>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded flex-shrink-0 capitalize" style={{ background: "var(--line)", color: "var(--text-secondary)" }}>
                  {proj.status?.replace("_", " ")}
                </span>
                {proj.deadline && (
                  <span className="text-[11px] flex-shrink-0" style={{ color: "var(--text-muted)" }}>
                    Due {new Date(proj.deadline).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Attendance tab */}
        {tab === "attendance" && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[12px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Daily Hours (last 30 sessions)</p>
              <p className="text-[13px] font-semibold" style={{ color: "var(--ink)" }}>Total: {formatHours(totalHours)}</p>
            </div>
            {Object.keys(attendanceByDay).length === 0 ? (
              <p className="text-[13px] py-4 text-center" style={{ color: "var(--text-fine)" }}>No attendance recorded.</p>
            ) : Object.entries(attendanceByDay).sort(([a], [b]) => b.localeCompare(a)).map(([day, seconds]) => {
              const pct = Math.min((seconds / (8 * 3600)) * 100, 100);
              return (
                <div key={day} className="flex items-center gap-3">
                  <span className="text-[12px] w-24 flex-shrink-0" style={{ color: "var(--text-muted)" }}>
                    {new Date(day).toLocaleDateString("en-IN", { day: "numeric", month: "short", weekday: "short" })}
                  </span>
                  <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "var(--line)" }}>
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "var(--navy)" }} />
                  </div>
                  <span className="text-[12px] font-semibold w-16 text-right flex-shrink-0" style={{ color: "var(--ink)" }}>
                    {formatHours(seconds)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

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
  const [showInvite, setShowInvite] = useState(false);

  async function toggleExpand(userId: string) {
    if (expanded === userId) { setExpanded(null); return; }
    setExpanded(userId);
    if (detail[userId]) return;
    setLoadingId(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, { credentials: "same-origin" });
      if (!res.ok) throw new Error();
      const { data } = await res.json();
      setDetail(prev => ({ ...prev, [userId]: data }));
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
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, is_admin: !u.is_admin } : u));
      setDetail(prev => prev[user.id]
        ? { ...prev, [user.id]: { ...prev[user.id], profile: { ...prev[user.id].profile, is_admin: !user.is_admin } } }
        : prev
      );
      toast.success(`${user.full_name ?? "User"} is ${!user.is_admin ? "now an admin" : "no longer an admin"}`);
    } finally {
      setTogglingId(null);
    }
  }

  return (
    <>
      {showInvite && <InviteModal onClose={() => setShowInvite(false)} />}

      <div className="flex items-center justify-between mb-6">
        <p className="text-[14px]" style={{ color: "var(--text-secondary)" }}>
          {users.length} registered {users.length === 1 ? "user" : "users"}
        </p>
        <button
          onClick={() => setShowInvite(true)}
          className="flex items-center gap-2 h-9 px-4 rounded-lg text-[13px] font-bold text-white"
          style={{ background: "var(--navy)" }}
        >
          <Mail className="w-3.5 h-3.5" /> Invite User
        </button>
      </div>

      <div className="flex flex-col gap-3">
        {users.map(user => {
          const isExpanded = expanded === user.id;
          const userDetail = detail[user.id];
          const isLoading = loadingId === user.id;
          const isToggling = togglingId === user.id;
          const isSelf = user.id === currentUserId;

          return (
            <div key={user.id} className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--line)", background: "var(--panel-bg)" }}>
              {/* Row */}
              <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3">
                <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-white text-sm font-bold overflow-hidden" style={{ background: "var(--navy)" }}>
                  {user.avatar_url
                    ? <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                    : <span className="text-[12px] font-bold">{getInitials(user.full_name, user.email)}</span>
                  }
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[14px] font-semibold" style={{ color: "var(--ink)" }}>{user.full_name ?? "—"}</span>
                    {user.is_admin && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: "var(--accent-bg)", color: "var(--accent-brand)" }}>
                        <Shield className="w-2.5 h-2.5" /> ADMIN
                      </span>
                    )}
                    {isSelf && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: "var(--line)", color: "var(--text-muted)" }}>YOU</span>
                    )}
                  </div>
                  <span className="text-[12px]" style={{ color: "var(--text-secondary)" }}>{user.email}</span>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {!isSelf && (
                    <button
                      onClick={() => toggleAdmin(user)}
                      disabled={isToggling}
                      className="flex items-center gap-1.5 text-[12px] font-semibold px-2 sm:px-3 py-1.5 rounded-lg border transition-opacity disabled:opacity-50"
                      style={{
                        borderColor: user.is_admin ? "var(--clr-red)" : "var(--accent-brand)",
                        color: user.is_admin ? "var(--clr-red)" : "var(--accent-brand)",
                        background: "transparent",
                      }}
                      title={user.is_admin ? "Remove Admin" : "Make Admin"}
                    >
                      {isToggling
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : user.is_admin
                          ? <><ShieldOff className="w-3.5 h-3.5" /><span className="hidden sm:inline"> Remove Admin</span></>
                          : <><Shield className="w-3.5 h-3.5" /><span className="hidden sm:inline"> Make Admin</span></>
                      }
                    </button>
                  )}
                  <button
                    onClick={() => toggleExpand(user.id)}
                    className="p-1.5 rounded-lg transition-opacity hover:opacity-70"
                    style={{ color: "var(--text-muted)" }}
                    aria-label={isExpanded ? "Collapse" : "Expand"}
                  >
                    {isLoading
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : isExpanded
                        ? <ChevronDown className="w-4 h-4" />
                        : <ChevronRight className="w-4 h-4" />
                    }
                  </button>
                </div>
              </div>

              {/* Detail panel */}
              {isExpanded && (
                userDetail
                  ? <UserDetailPanel detail={userDetail} />
                  : <div className="border-t px-4 py-4" style={{ borderColor: "var(--line)", background: "var(--surface-bg)" }}>
                      <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>Loading…</p>
                    </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
