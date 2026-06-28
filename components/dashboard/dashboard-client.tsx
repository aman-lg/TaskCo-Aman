"use client";

import { useState } from "react";
import {
  ChevronLeft, ChevronRight, Plus, CheckSquare, Folder,
  Clock, AlertCircle, Video, Circle,
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
  const today = new Date();
  const quote = QUOTES[today.getDate() % QUOTES.length];
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  // Build date map for calendar dots
  const dateMap: Record<string, { total: number; done: number }> = {};
  for (const { date, done } of deadlineDates) {
    if (!dateMap[date]) dateMap[date] = { total: 0, done: 0 };
    dateMap[date].total++;
    if (done) dateMap[date].done++;
  }

  // Build bar chart data from deadlineDates (upcoming 7 days)
  const barData: { day: string; pending: number; done: number }[] = Array.from({ length: 7 }, (_, i) => {
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

  const [calMonth, setCalMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [addTaskOpen, setAddTaskOpen] = useState(false);
  const [addTaskDate, setAddTaskDate] = useState<string | null>(null);
  const [addTaskProject, setAddTaskProject] = useState<string | null>(() => projects[0]?.id ?? null);

  const year = calMonth.getFullYear();
  const month = calMonth.getMonth();
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const greeting = today.getHours() < 12 ? "Good morning"
    : today.getHours() < 17 ? "Good afternoon"
    : "Good evening";

  // Pie chart: filter out zero-value slices
  const pieData = taskStats.statusBreakdown.filter((s) => s.value > 0);

  return (
    <div className="grid grid-cols-4 gap-5">

      {/* ── Welcome banner (full width) ── */}
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

      {/* ── Stat cards (4 cols, one each) ── */}
      <StatCard icon={<Folder className="h-5 w-5" />} label="Active Projects"
        value={projectStats.active} sub={`of ${projectStats.total} total`}
        color="var(--navy)" bg="var(--accent-bg)" />
      <StatCard icon={<CheckSquare className="h-5 w-5" />} label="Completed Tasks"
        value={taskStats.completed} sub={`of ${taskStats.total} total`}
        color="var(--clr-green)" bg="color-mix(in srgb, var(--clr-green) 10%, transparent)" />
      <StatCard icon={<Clock className="h-5 w-5" />} label="Pending Tasks"
        value={taskStats.pending} sub="in progress or to-do"
        color="var(--accent-brand)" bg="color-mix(in srgb, var(--accent-brand) 12%, transparent)" />
      <StatCard icon={<AlertCircle className="h-5 w-5" />} label="Due Today"
        value={taskStats.dueToday} sub="with today's deadline"
        color={taskStats.dueToday > 0 ? "var(--clr-red)" : "var(--text-muted)"}
        bg={taskStats.dueToday > 0 ? "var(--clr-red-bg)" : "var(--line-soft)"} />

      {/* ── Today's Tasks (2 cols) ── */}
      <div
        className="col-span-2 rounded-xl border p-5 flex flex-col gap-4"
        style={{ background: "var(--surface-bg)", borderColor: "var(--line)" }}
      >
        <div className="flex items-center justify-between">
          <h2 className="h3" style={{ color: "var(--ink)" }}>Today&rsquo;s Tasks</h2>
          {addTaskProject && (
            <button
              onClick={() => { setAddTaskDate(todayStr); setAddTaskOpen(true); }}
              className="flex items-center gap-1.5 h-7 px-3 rounded-lg text-[12px] font-semibold"
              style={{ background: "var(--navy)", color: "#fff" }}
            >
              <Plus className="h-3.5 w-3.5" />
              Add
            </button>
          )}
        </div>
        {todayTasks.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <CheckSquare className="h-8 w-8 opacity-20" style={{ color: "var(--ink)" }} />
            <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>No active or due-today tasks!</p>
          </div>
        ) : (
          <ul className="flex flex-col divide-y" style={{ borderColor: "var(--line-soft)" }}>
            {todayTasks.map((task) => {
              const isDue = task.deadline && new Date(task.deadline).toDateString() === today.toDateString();
              const urgencyColor = `var(${URGENCY_TOKEN[task.urgency ?? "medium"]})`;
              const urgencyBg = `var(${URGENCY_BG_TOKEN[task.urgency ?? "medium"]})`;
              return (
                <li key={task.id} className="flex items-center gap-3 py-2.5">
                  <Circle className="h-3.5 w-3.5 flex-shrink-0"
                    style={{ color: task.status === "in_progress" ? "var(--accent-brand)" : "var(--line)" }} />
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
                      {(task.urgency ?? "medium").charAt(0).toUpperCase() + (task.urgency ?? "medium").slice(1)}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* ── Calendar (2 cols) ── */}
      <div
        className="col-span-2 rounded-xl border p-5 flex flex-col gap-3"
        style={{ background: "var(--surface-bg)", borderColor: "var(--line)" }}
      >
        {/* Header */}
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

        {/* Day labels */}
        <div className="grid grid-cols-7">
          {DAYS_SHORT.map((d, i) => (
            <div key={i} className="text-center text-[11px] font-bold py-1" style={{ color: "var(--text-muted)" }}>{d}</div>
          ))}
        </div>

        {/* Grid */}
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
                onClick={() => { setAddTaskDate(ds); setAddTaskOpen(true); }}
                className={cn(
                  "relative h-9 w-full rounded-lg text-[13px] font-medium flex flex-col items-center justify-center transition-colors",
                  isToday ? "text-white" : "text-[var(--ink)] hover:bg-[var(--line-soft)]"
                )}
                style={isToday ? { background: "var(--navy)" } : {}}
                title={info ? `${info.total} task(s)` : "Add task"}
              >
                {day}
                {info && (
                  <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                    style={{ background: isToday ? "rgba(255,255,255,0.7)" : allDone ? "var(--clr-green)" : "var(--accent-brand)" }} />
                )}
              </button>
            );
          })}
        </div>

        {/* Project selector */}
        {projects.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t" style={{ borderColor: "var(--line-soft)" }}>
            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Add to:</span>
            {projects.map((p) => (
              <button key={p.id} onClick={() => setAddTaskProject(p.id)}
                className={cn("flex items-center gap-1 h-5 px-2 rounded text-[11px] font-semibold transition-colors",
                  addTaskProject === p.id ? "text-white" : "text-[var(--text-secondary)] hover:bg-[var(--line-soft)]"
                )}
                style={addTaskProject === p.id ? { background: p.color ?? "var(--navy)" } : {}}>
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: p.color ?? "var(--text-muted)" }} />
                {p.title}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Task status donut (2 cols) ── */}
      <div
        className="col-span-2 rounded-xl border p-5 flex flex-col gap-4"
        style={{ background: "var(--surface-bg)", borderColor: "var(--line)" }}
      >
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
                    cx="50%"
                    cy="50%"
                    innerRadius={42}
                    outerRadius={68}
                    paddingAngle={pieData.length > 1 ? 3 : 0}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    {(pieData.length > 0 ? pieData : [{ name: "None", value: 1, color: "var(--line)" }]).map((entry, idx) => (
                      <Cell key={idx} fill={entry.color.startsWith("var(") ? getCSSVar(entry.color) : entry.color} />
                    ))}
                  </Pie>
                  <ReTooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
                    formatter={(value, name) => [`${value} tasks`, name]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-col gap-2.5 flex-1">
              {taskStats.statusBreakdown.map((s) => (
                <div key={s.name} className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ background: s.color }} />
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

      {/* ── Upcoming deadline bar chart (2 cols) ── */}
      <div
        className="col-span-2 rounded-xl border p-5 flex flex-col gap-4"
        style={{ background: "var(--surface-bg)", borderColor: "var(--line)" }}
      >
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
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
                  cursor={{ fill: "var(--line-soft)", radius: 4 }}
                />
                <Bar dataKey="pending" name="Pending" fill={getCSSVar("var(--accent-brand)")} radius={[4, 4, 0, 0]} />
                <Bar dataKey="done" name="Done" fill={getCSSVar("var(--clr-green)")} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
        <div className="flex items-center gap-4 text-[12px]" style={{ color: "var(--text-muted)" }}>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-sm" style={{ background: "var(--accent-brand)" }} />
            Pending
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-sm" style={{ background: "var(--clr-green)" }} />
            Done
          </span>
        </div>
      </div>

      {/* ── Meetings (full width) ── */}
      <div
        className="col-span-4 rounded-xl border p-5 flex flex-col gap-4"
        style={{ background: "var(--surface-bg)", borderColor: "var(--line)" }}
      >
        <div className="flex items-center justify-between">
          <h2 className="h3" style={{ color: "var(--ink)" }}>Meetings</h2>
          <span className="text-[11px] font-semibold px-2 py-1 rounded-lg"
            style={{ background: "var(--accent-bg)", color: "var(--navy)" }}>
            Google Meet — coming soon
          </span>
        </div>
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: "var(--panel-bg)" }}>
            <Video className="h-6 w-6" style={{ color: "var(--text-muted)" }} />
          </div>
          <div>
            <p className="text-[14px] font-semibold" style={{ color: "var(--ink)" }}>No meetings scheduled</p>
            <p className="text-[12px] mt-1 max-w-xs mx-auto" style={{ color: "var(--text-muted)" }}>
              Connect your Google account to see and join meetings directly from TaskCo.
            </p>
          </div>
          <button className="h-8 px-4 rounded-lg text-[12px] font-semibold border transition-colors hover:bg-[var(--line-soft)]"
            style={{ borderColor: "var(--line)", color: "var(--text-secondary)" }}>
            Connect Google Meet
          </button>
        </div>
      </div>

      {/* Add-task dialog */}
      {addTaskProject && (
        <TaskFormDialog
          open={addTaskOpen}
          onClose={() => setAddTaskOpen(false)}
          projectId={addTaskProject}
          defaultDeadline={addTaskDate ?? undefined}
        />
      )}
    </div>
  );
}

// Resolve CSS variable to actual color for recharts (runs in browser only)
function getCSSVar(token: string): string {
  if (typeof window === "undefined") return "#888";
  // token is like "var(--clr-green)"
  const name = token.replace(/^var\(/, "").replace(/\)$/, "");
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "#888";
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
    <div className="rounded-xl border p-4 flex flex-col gap-3" style={{ background: "var(--surface-bg)", borderColor: "var(--line)" }}>
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
