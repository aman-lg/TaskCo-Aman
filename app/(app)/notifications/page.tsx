"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Bell, Video, CheckSquare, FolderKanban, AtSign, Circle, Loader2 } from "lucide-react";
import type { NotificationRow } from "@/lib/queries/notifications";

const TYPE_ICON: Record<string, typeof Bell> = {
  booking_request: Video,
  meeting_reminder: Video,
  task_assigned: CheckSquare,
  task_due_soon: CheckSquare,
  task_status_changed: CheckSquare,
  project_due_soon: FolderKanban,
  mention: AtSign,
};

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function linkFor(n: NotificationRow): string | null {
  if (n.type === "booking_request" || n.type === "meeting_reminder") return "/meetings";
  if (n.entity_type === "project" && n.entity_id) return `/projects/${n.entity_id}`;
  return null;
}

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications", { credentials: "same-origin" });
      if (res.ok) {
        const { data } = await res.json();
        setNotifications(data.notifications ?? []);
        setUnreadCount(data.unreadCount ?? 0);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function markRead(n: NotificationRow) {
    if (!n.is_read) {
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
      setUnreadCount((c) => Math.max(0, c - 1));
      fetch(`/api/notifications/${n.id}/read`, { method: "POST", credentials: "same-origin" }).catch(() => {});
    }
    const href = linkFor(n);
    if (href) router.push(href);
  }

  async function markAllRead() {
    setNotifications((prev) => prev.map((x) => ({ ...x, is_read: true })));
    setUnreadCount(0);
    await fetch("/api/notifications/read-all", { method: "POST", credentials: "same-origin" }).catch(() => {});
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="h1" style={{ color: "var(--ink)" }}>Notifications</h1>
          <p className="mt-1 text-[14px]" style={{ color: "var(--text-muted)" }}>
            {unreadCount > 0 ? `${unreadCount} unread` : "You're all caught up"}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="h-9 px-4 rounded-lg text-[13px] font-semibold transition-colors hover:bg-[var(--line-soft)]"
            style={{ border: "1px solid var(--line)", color: "var(--text-secondary)" }}
          >
            Mark all read
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-10 justify-center" style={{ color: "var(--text-muted)" }}>
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : notifications.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-20 rounded-xl border border-dashed"
          style={{ borderColor: "var(--line)", color: "var(--text-muted)" }}
        >
          <Bell className="h-8 w-8 opacity-30 mb-2" />
          <p className="text-[15px] font-semibold" style={{ color: "var(--ink)" }}>No notifications yet</p>
          <p className="text-[13px] mt-1">You&apos;ll see meeting requests, reminders, and task activity here.</p>
        </div>
      ) : (
        <div
          className="rounded-xl overflow-hidden"
          style={{ background: "var(--surface-bg)", boxShadow: "0 1px 8px rgba(0,0,0,0.07), 0 0 0 1px rgba(0,0,0,0.04)" }}
        >
          {notifications.map((n, idx) => {
            const Icon = TYPE_ICON[n.type] ?? Bell;
            return (
              <button
                key={n.id}
                onClick={() => markRead(n)}
                className="w-full flex items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-[var(--panel-bg)]"
                style={{ borderTop: idx > 0 ? "1px solid var(--line-soft)" : undefined }}
              >
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: "var(--panel-bg)", color: "var(--navy)" }}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-semibold" style={{ color: "var(--ink)" }}>{n.title}</p>
                  {n.body && (
                    <p className="text-[13px] mt-0.5" style={{ color: "var(--text-secondary)" }}>{n.body}</p>
                  )}
                  <p className="text-[12px] mt-1" style={{ color: "var(--text-muted)" }}>{formatWhen(n.created_at)}</p>
                </div>
                {!n.is_read && (
                  <Circle className="h-2.5 w-2.5 flex-shrink-0 mt-2" style={{ fill: "var(--navy)", color: "var(--navy)" }} />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
