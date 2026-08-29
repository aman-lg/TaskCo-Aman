"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Bell, Video, CheckSquare, FolderKanban, AtSign, Circle } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
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

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function linkFor(n: NotificationRow): string | null {
  if (n.type === "booking_request" || n.type === "meeting_reminder") return "/meetings";
  if (n.entity_type === "project" && n.entity_id) return `/projects/${n.entity_id}`;
  return null;
}

interface Props {
  // "dark": designed for the desktop sidebar's navy background (default,
  // unchanged). "light": for a light background — the mobile top bar reuses
  // this same component, and the dark variant's near-white icon was
  // invisible there (white-on-white).
  variant?: "dark" | "light";
  // The desktop sidebar sits on the left, so its popover opens to the right
  // by default. The mobile top bar is full-width, so opening "right" from a
  // trigger already near the right edge pushes it off-screen.
  side?: "right" | "bottom";
}

export function NotificationBell({ variant = "dark", side = "right" }: Props) {
  const router = useRouter();
  const idleColor = variant === "dark" ? "rgba(255,255,255,0.48)" : "var(--text-muted)";
  const hoverColor = variant === "dark" ? "rgba(255,255,255,0.92)" : "var(--ink)";
  const hoverBg = variant === "dark" ? "rgba(255,255,255,0.06)" : "var(--line-soft)";
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications", { credentials: "same-origin" });
      if (res.ok) {
        const { data } = await res.json();
        setNotifications(data.notifications ?? []);
        setUnreadCount(data.unreadCount ?? 0);
      }
    } catch {
      // Non-critical background poll — fail silently
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 45_000);
    return () => clearInterval(id);
  }, [load]);

  async function markRead(n: NotificationRow) {
    if (!n.is_read) {
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
      setUnreadCount((c) => Math.max(0, c - 1));
      fetch(`/api/notifications/${n.id}/read`, { method: "POST", credentials: "same-origin" }).catch(() => {});
    }
    const href = linkFor(n);
    if (href) {
      setOpen(false);
      router.push(href);
    }
  }

  async function markAllRead() {
    setNotifications((prev) => prev.map((x) => ({ ...x, is_read: true })));
    setUnreadCount(0);
    await fetch("/api/notifications/read-all", { method: "POST", credentials: "same-origin" }).catch(() => {});
  }

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (v) load(); }}>
      <PopoverTrigger
        className="relative flex items-center justify-center transition-colors"
        style={{
          width: 32, height: 32, borderRadius: 8, border: "none", cursor: "pointer",
          background: "transparent", color: idleColor,
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = hoverBg; e.currentTarget.style.color = hoverColor; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = idleColor; }}
        aria-label="Notifications"
      >
        <Bell style={{ width: 16, height: 16 }} />
        {unreadCount > 0 && (
          <span
            className="absolute top-0.5 right-0.5 flex items-center justify-center text-[9px] font-bold text-white rounded-full"
            style={{ minWidth: 14, height: 14, padding: "0 3px", background: "var(--clr-red, #ef4444)" }}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align={side === "right" ? "start" : "end"} side={side} className="w-80 max-w-[90vw] max-h-[420px] p-0 gap-0 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-3.5 py-2.5 flex-shrink-0" style={{ borderBottom: "1px solid var(--line)" }}>
          <span className="text-[13px] font-bold" style={{ color: "var(--ink)" }}>Notifications</span>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="text-[11px] font-semibold transition-opacity hover:opacity-70"
              style={{ color: "var(--navy)" }}
            >
              Mark all read
            </button>
          )}
        </div>
        <div className="overflow-y-auto flex-1">
          {notifications.length === 0 ? (
            <p className="text-[12px] text-center py-8" style={{ color: "var(--text-muted)" }}>
              No notifications yet.
            </p>
          ) : (
            notifications.map((n) => {
              const Icon = TYPE_ICON[n.type] ?? Bell;
              const clickable = !!linkFor(n);
              return (
                <button
                  key={n.id}
                  onClick={() => markRead(n)}
                  className="w-full flex items-start gap-2.5 px-3.5 py-2.5 text-left transition-colors hover:bg-[var(--panel-bg)]"
                  style={{ cursor: clickable || !n.is_read ? "pointer" : "default" }}
                >
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background: "var(--panel-bg)", color: "var(--navy)" }}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12.5px] font-semibold leading-snug" style={{ color: "var(--ink)" }}>{n.title}</p>
                    {n.body && (
                      <p className="text-[11.5px] mt-0.5 leading-snug line-clamp-2" style={{ color: "var(--text-muted)" }}>{n.body}</p>
                    )}
                    <p className="text-[10.5px] mt-1" style={{ color: "var(--text-fine)" }}>{timeAgo(n.created_at)}</p>
                  </div>
                  {!n.is_read && (
                    <Circle className="h-2 w-2 flex-shrink-0 mt-1.5" style={{ fill: "var(--navy)", color: "var(--navy)" }} />
                  )}
                </button>
              );
            })
          )}
        </div>
        <button
          onClick={() => { setOpen(false); router.push("/notifications"); }}
          className="flex-shrink-0 text-[11.5px] font-semibold text-center py-2.5 transition-colors hover:bg-[var(--panel-bg)]"
          style={{ borderTop: "1px solid var(--line)", color: "var(--navy)" }}
        >
          View all
        </button>
      </PopoverContent>
    </Popover>
  );
}
