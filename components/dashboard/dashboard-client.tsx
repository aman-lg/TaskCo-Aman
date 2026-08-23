"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import {
  ChevronLeft, ChevronRight, Plus, CheckSquare, Folder,
  Clock, AlertCircle, Video, Circle, RefreshCw,
} from "lucide-react";
import {
  PieChart, Pie, Cell, Tooltip as ReTooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";
import { TaskFormDialog } from "@/components/tasks/task-form-dialog";
import { AttendanceTimer } from "@/components/dashboard/attendance-timer";
import { cn } from "@/lib/utils";
import type { TodayTask } from "@/lib/queries/tasks";

const QUOTES = [
  "Great things are done by a series of small things brought together.",
  "The secret of getting ahead is getting started.",
  "Focus on being productive instead of busy.",
  "Don't watch the clock; do what it does — keep going.",
  "You don't have to be great to start, but you have to start to be great.",
  "Small daily improvements lead to stunning results.",
  "One task at a time leads to mountains moved.",
];

const DAYS_SHORT = ["S", "M", "T", "W", "T", "F", "S"];
const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

const URGENCY_TOKEN: Record<string, string> = {
  low: "--urgency-low", medium: "--urgency-medium",
  high: "--urgency-high", urgent: "--urgency-urgent",
};
const URGENCY_BG_TOKEN: Record<string, string> = {
  low: "--urgency-low-bg", medium: "--urgency-medium-bg",
  high: "--urgency-high-bg", urgent: "--urgency-urgent-bg",
};

type ActivityFilter = "all" | "in_progress" | "due_today";

interface StatusBreakdown { name: string; value: number; color: string }

interface Props {
  firstName: string;
  projectStats: { active: number; total: number };
  taskStats: {
    total: number; completed: number; pending: number; dueToday: number;
    statusBreakdown: StatusBreakdown[];
  };
  deadlineDates: { date: string; done: boolean }[];
  projects: { id: string; title: string; color: string | null }[];
  todayTasks: TodayTask[];
}

export function DashboardClient({ firstName, projectStats, taskStats, deadlineDates, projects, todayTasks }: Props) {
  const router = useRouter();
  const today = new Date();
  const quote = QUOTES[today.getDate() % QUOTES.length];
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const [activityFilter, setActivityFilter] = useState<ActivityFilter>("all");
  const [calMonth, setCalMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [addTaskOpen, setAddTaskOpen] = useState(false);
  const [addTaskDate, setAddTaskDate] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [meetingsConnected, setMeetingsConnected] = useState<boolean | null>(null);
  const [pendingBookings, setPendingBookings] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [statusRes, bookingsRes] = await Promise.all([
          fetch("/api/meetings/status", { credentials: "same-origin" }),
          fetch("/api/bookings", { credentials: "same-origin" }),
        ]);
        if (cancelled) return;
        if (statusRes.ok) setMeetingsConnected((await statusRes.json()).data.connected);
        if (bookingsRes.ok) {
          const rows: { status: string }[] = (await bookingsRes.json()).data ?? [];
          setPendingBookings(rows.filter((b) => b.status === "pending").length);
        }
      } catch {
        // Non-critical widget — leave it in its default state on failure.
      }
    })();
    return () => { cancelled = true; };
  }, []);

  function openAddTask(date: string | null) {
    if (projects.length === 0) {
      toast.error("Create a project first — tasks must belong to one.");
      return;
    }
    setAddTaskDate(date);
    setAddTaskOpen(true);
  }

  // ── Refresh helper ──────────────────────────────────────────────────────────
  const refresh = useCallback(() => {
    setRefreshing(true);
    router.refresh();
    setTimeout(() => setRefreshing(false), 600);
  }, [router]);

  // ── Supabase Realtime — instant push when any task row changes ───────────────
  // Requires: Realtime enabled on tasks table in Supabase (Table Editor → tasks → Realtime ON)
  // OR: ALTER PUBLICATION supabase_realtime ADD TABLE tasks;  in SQL Editor
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("dashboard-tasks-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () => {
        refresh();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [refresh]);

  // ── 30-second fallback poll (catches reconnects / missed events) ─────────────
  useEffect(() => {
    const id = setInterval(refresh, 30_000);
    return () => clearInterval(id);
  }, [refresh]);

  // ── Activity filter ─────────────────────────────────────────────────────────
  const filteredTasks = todayTasks.filter((t) => {
    if (activityFilter === "in_progress") return t.status === "in_progress";
    if (activityFilter === "due_today") return !!t.deadline && t.deadline.startsWith(todayStr);
    return true;
  });

  // ── Calendar ────────────────────────────────────────────────────────────────
  const dateMap: Record<string, { total: number; done: number }> = {};
  for (const { date, done } of deadlineDates) {
    if (!dateMap[date]) dateMap[date] = { total: 0, done: 0 };
    dateMap[date].total++;
    if (done) dateMap[date].done++;
  }

  const barData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const info = dateMap[ds] ?? { total: 0, done: 0 };
    return {
      day: i === 0 ? "Today" : d.toLocaleDateString("en-IN", { weekday: "short" }),
      pending: info.total - info.done,
      done: info.done,
    };
  });

  const year = calMonth.getFullYear();
  const month = calMonth.getMonth();
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const greeting = today.getHours() < 12 ? "Good morning"
    : today.getHours() < 17 ? "Good afternoon" : "Good evening";

  const pieData = taskStats.statusBreakdown.filter((s) => s.value > 0);

  // Card style — no shadow, just white-on-grey separation
  const card = { background: "var(--surface-bg)" } as React.CSSProperties;

  return (
    <div className="grid grid-cols-4 gap-5">

      {/* ── Welcome banner ── */}
      <div
        className="col-span-4 rounded-xl px-6 py-5 flex items-start justify-between gap-6"
        style={{ background: "var(--navy)", color: "#fff" }}
      >
        <div className="flex flex-col gap-1 min-w-0">
          <p className="text-[13px] font-medium opacity-70">{greeting},</p>
          <h1 className="text-[22px] font-bold" style={{ fontFamily: "var(--font-display)" }}>
            {firstName} 👋
          </h1>
          <p className="mt-1 text-[12px] italic opacity-55 leading-relaxed max-w-md">
            &ldquo;{quote}&rdquo;
          </p>
        </div>
        <AttendanceTimer />
      </div>

      {/* ── Stat cards ── */}
      <StatCard icon={<Folder className="h-5 w-5" />} label="Active Projects"
        value={projectStats.active} sub={`of ${projectStats.total} total`}
        color="var(--navy)" bg="var(--navy-l)" />
      <StatCard icon={<CheckSquare className="h-5 w-5" />} label="Completed Tasks"
        value={taskStats.completed} sub={`of ${taskStats.total} total`}
        color="var(--clr-green)" bg="var(--clr-green-bg)" />
      <StatCard icon={<Clock className="h-5 w-5" />} label="Pending Tasks"
        value={taskStats.pending} sub="in progress or to-do"
        color="var(--navy)" bg="var(--navy-l)" />
      <StatCard icon={<AlertCircle className="h-5 w-5" />} label="Due Today"
        value={taskStats.dueToday} sub="with today's deadline"
        color={taskStats.dueToday > 0 ? "var(--clr-red)" : "var(--text-muted)"}
        bg={taskStats.dueToday > 0 ? "var(--clr-red-bg)" : "var(--line-soft)"} />

      {/* ── Activity (2 cols) ── */}
      <div className="col-span-2 rounded-xl p-5 flex flex-col gap-3" style={card}>
        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <h2 className="h3" style={{ color: "var(--ink)" }}>Activity</h2>
          <div className="flex items-center gap-1.5">
            <button
              onClick={refresh}
              title="Refresh"
              className="p-1.5 rounded-lg transition-colors hover:bg-[var(--line-soft)]"
              style={{ color: "var(--text-muted)" }}
            >
              <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
            </button>
            <button
              onClick={() => openAddTask(todayStr)}
              className="flex items-center gap-1.5 h-7 px-3 rounded-lg text-[12px] font-semibold"
              style={{ background: "var(--navy)", color: "#fff" }}
            >
              <Plus className="h-3.5 w-3.5" /> Add
            </button>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-1">
          {(["all", "in_progress", "due_today"] as ActivityFilter[]).map((f) => {
            const labels: Record<ActivityFilter, string> = {
              all: "All Active",
              in_progress: "In Progress",
              due_today: "Due Today",
            };
            const active = activityFilter === f;
            return (
              <button
                key={f}
                onClick={() => setActivityFilter(f)}
                className="h-6 px-2.5 rounded-md text-[11px] font-semibold transition-colors"
                style={{
                  background: active ? "var(--navy)" : "transparent",
                  color: active ? "#fff" : "var(--text-muted)",
                }}
              >
                {labels[f]}
              </button>
            );
          })}
        </div>

        {/* Scrollable list — max 320px, scrolls inside card only */}
        {filteredTasks.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <CheckSquare className="h-8 w-8 opacity-20" style={{ color: "var(--ink)" }} />
            <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>
              {activityFilter === "all" ? "No active tasks" : "No tasks match this filter"}
            </p>
          </div>
        ) : (
          <ul
            className="flex flex-col divide-y overflow-y-auto"
            style={{ maxHeight: 320, borderColor: "var(--line-soft)" }}
          >
            {filteredTasks.map((task) => {
              const isDue = task.deadline?.startsWith(todayStr);
              const urgencyColor = `var(${URGENCY_TOKEN[task.urgency ?? "medium"]})`;
              const urgencyBg = `var(${URGENCY_BG_TOKEN[task.urgency ?? "medium"]})`;
              return (
                <li key={task.id} className="flex items-center gap-3 py-2.5 flex-shrink-0">
                  <Circle
                    className="h-3.5 w-3.5 flex-shrink-0"
                    style={{ color: task.status === "in_progress" ? "var(--navy)" : "var(--line)" }}
                  />
                  <span className="flex-1 text-[13px] font-medium truncate" style={{ color: "var(--ink)" }}>
                    {task.name}
                  </span>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {isDue && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                        style={{ background: "var(--clr-red-bg)", color: "var(--clr-red)" }}>
                        Due today
                      </span>
                    )}
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                      style={{ background: urgencyBg, color: urgencyColor }}>
                      {(task.urgency ?? "medium")[0].toUpperCase() + (task.urgency ?? "medium").slice(1)}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* ── Calendar (2 cols) ── */}
      <div className="col-span-2 rounded-xl p-5 flex flex-col gap-3" style={card}>
        <div className="flex items-center justify-between">
          <span className="text-[14px] font-bold" style={{ color: "var(--ink)" }}>
            {MONTHS[month]} {year}
          </span>
          <div className="flex items-center gap-0.5">
            <button onClick={() => setCalMonth(new Date(year, month - 1, 1))}
              className="p-1.5 rounded-lg transition-colors hover:bg-[var(--line-soft)]"
              style={{ color: "var(--text-muted)" }}>
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => setCalMonth(new Date(today.getFullYear(), today.getMonth(), 1))}
              className="px-2 h-6 rounded text-[11px] font-semibold transition-colors hover:bg-[var(--line-soft)]"
              style={{ color: "var(--navy)" }}>
              Today
            </button>
            <button onClick={() => setCalMonth(new Date(year, month + 1, 1))}
              className="p-1.5 rounded-lg transition-colors hover:bg-[var(--line-soft)]"
              style={{ color: "var(--text-muted)" }}>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        <div className="grid grid-cols-7">
          {DAYS_SHORT.map((d, i) => (
            <div key={i} className="text-center text-[11px] font-bold py-1" style={{ color: "var(--text-muted)" }}>{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-y-1 flex-1">
          {cells.map((day, i) => {
            if (!day) return <div key={`e-${i}`} />;
            const ds = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const info = dateMap[ds];
            const isToday = ds === todayStr;
            const allDone = info && info.done === info.total;
            return (
              <button
                key={ds}
                onClick={() => openAddTask(ds)}
                className={cn(
                  "relative h-9 w-full rounded-lg text-[13px] font-medium flex flex-col items-center justify-center transition-colors",
                  isToday ? "text-white" : "text-[var(--ink)] hover:bg-[var(--line-soft)]"
                )}
                style={isToday ? { background: "var(--navy)" } : {}}
              >
                {day}
                {info && (
                  <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                    style={{ background: isToday ? "rgba(255,255,255,0.7)" : allDone ? "var(--clr-green)" : "var(--navy)" }} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Task status donut (2 cols) ── */}
      <div className="col-span-2 rounded-xl p-5 flex flex-col gap-4" style={card}>
        <h2 className="h3" style={{ color: "var(--ink)" }}>Task Status</h2>
        {taskStats.total === 0 ? (
          <EmptyChart message="No tasks yet" />
        ) : (
          <div className="flex items-center gap-6">
            <div style={{ width: 150, height: 150, flexShrink: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData.length > 0 ? pieData : [{ name: "None", value: 1, color: "var(--line)" }]}
                    cx="50%" cy="50%"
                    innerRadius={42} outerRadius={68}
                    paddingAngle={pieData.length > 1 ? 3 : 0}
                    dataKey="value" strokeWidth={0}
                  >
                    {(pieData.length > 0 ? pieData : [{ name: "None", value: 1, color: "var(--line)" }]).map((entry, idx) => (
                      <Cell key={idx} fill={getCSSVar(entry.color)} />
                    ))}
                  </Pie>
                  <ReTooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: "none", boxShadow: "0 4px 16px rgba(0,0,0,0.1)" }}
                    formatter={(value, name) => [`${value} tasks`, name]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-col gap-2.5 flex-1">
              {taskStats.statusBreakdown.map((s) => (
                <div key={s.name} className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: getCSSVar(s.color) }} />
                  <span className="text-[13px] flex-1" style={{ color: "var(--ink)" }}>{s.name}</span>
                  <span className="text-[13px] font-bold" style={{ color: "var(--ink)" }}>{s.value}</span>
                </div>
              ))}
              <div className="mt-1 pt-2 border-t" style={{ borderColor: "var(--line-soft)" }}>
                <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>
                  {taskStats.total > 0
                    ? `${Math.round((taskStats.completed / taskStats.total) * 100)}% complete`
                    : "No tasks"}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Deadlines bar chart (2 cols) ── */}
      <div className="col-span-2 rounded-xl p-5 flex flex-col gap-4" style={card}>
        <h2 className="h3" style={{ color: "var(--ink)" }}>Deadlines — Next 7 Days</h2>
        {barData.every((d) => d.pending === 0 && d.done === 0) ? (
          <EmptyChart message="No upcoming deadlines" />
        ) : (
          <div style={{ height: 160 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} barSize={16} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--line-soft)" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} width={20} />
                <ReTooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: "none", boxShadow: "0 4px 16px rgba(0,0,0,0.1)" }}
                  cursor={{ fill: "var(--line-soft)", radius: 4 }}
                />
                <Bar dataKey="pending" name="Pending" fill={getCSSVar("var(--chart-bar-a)")} radius={[4, 4, 0, 0]} />
                <Bar dataKey="done"    name="Done"    fill={getCSSVar("var(--chart-bar-b)")} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
        <div className="flex items-center gap-4 text-[12px]" style={{ color: "var(--text-muted)" }}>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-sm" style={{ background: getCSSVar("var(--chart-bar-a)") }} />
            Pending
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-sm" style={{ background: getCSSVar("var(--chart-bar-b)") }} />
            Done
          </span>
        </div>
      </div>

      {/* ── Meetings ── */}
      <div className="col-span-4 rounded-xl p-5 flex flex-col gap-4" style={card}>
        <div className="flex items-center justify-between">
          <h2 className="h3" style={{ color: "var(--ink)" }}>Meetings</h2>
          {meetingsConnected && pendingBookings > 0 && (
            <span className="text-[11px] font-bold px-2 py-1 rounded-lg"
              style={{ background: "var(--clr-red-bg)", color: "var(--clr-red)" }}>
              {pendingBookings} pending request{pendingBookings !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: "var(--panel-bg)" }}>
            <Video className="h-6 w-6" style={{ color: "var(--text-muted)" }} />
          </div>
          <div>
            <p className="text-[14px] font-semibold" style={{ color: "var(--ink)" }}>
              {meetingsConnected ? "Manage booking requests" : "No meetings scheduled"}
            </p>
            <p className="text-[12px] mt-1 max-w-xs mx-auto" style={{ color: "var(--text-muted)" }}>
              {meetingsConnected
                ? "Confirm requests to generate a Google Meet link and notify the requester."
                : "Connect your Google Calendar to get a booking link people can use to request time with you."}
            </p>
          </div>
          <Link
            href="/meetings"
            className="h-8 px-4 rounded-lg text-[12px] font-semibold transition-colors hover:bg-[var(--line-soft)]"
            style={{ border: "1px solid var(--line)", color: "var(--text-secondary)" }}
          >
            {meetingsConnected ? "View Meetings" : "Connect Google Calendar"}
          </Link>
        </div>
      </div>

      {projects.length > 0 && (
        <TaskFormDialog
          open={addTaskOpen}
          onClose={() => setAddTaskOpen(false)}
          projectId={projects[0].id}
          projects={projects}
          defaultDeadline={addTaskDate ?? undefined}
        />
      )}
    </div>
  );
}

function getCSSVar(token: string): string {
  if (typeof window === "undefined") return "#19183B";
  const name = token.replace(/^var\(/, "").replace(/\)$/, "");
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "#19183B";
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex-1 flex items-center justify-center py-8">
      <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>{message}</p>
    </div>
  );
}

function StatCard({ icon, label, value, sub, color, bg }: {
  icon: React.ReactNode; label: string; value: number; sub: string; color: string; bg: string;
}) {
  return (
    <div className="rounded-xl p-4 flex flex-col gap-3" style={{ background: "var(--surface-bg)" }}>
      <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: bg, color }}>
        {icon}
      </div>
      <div>
        <p className="text-[24px] font-bold leading-none" style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}>
          {value}
        </p>
        <p className="mt-1 text-[12px] font-semibold" style={{ color: "var(--ink)" }}>{label}</p>
        <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>{sub}</p>
      </div>
    </div>
  );
}
