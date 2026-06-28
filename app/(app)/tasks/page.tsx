import Link from "next/link";
import { Calendar, AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getAllTasks } from "@/lib/queries/tasks";
import { getProjects } from "@/lib/queries/projects";

const STATUS_LABELS: Record<string, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  done: "Done",
};

const STATUS_COLOR: Record<string, string> = {
  todo:        "--status-todo",
  in_progress: "--status-in-progress",
  done:        "--status-done",
};

const URGENCY_TOKEN: Record<string, string> = {
  low:    "--urgency-low",
  medium: "--urgency-medium",
  high:   "--urgency-high",
  urgent: "--urgency-urgent",
};
const URGENCY_BG_TOKEN: Record<string, string> = {
  low:    "--urgency-low-bg",
  medium: "--urgency-medium-bg",
  high:   "--urgency-high-bg",
  urgent: "--urgency-urgent-bg",
};

export default async function TasksPage() {
  const supabase = await createClient();
  const [tasks, projects] = await Promise.all([
    getAllTasks(supabase),
    getProjects(supabase),
  ]);

  // Group tasks by project
  const projectMap = Object.fromEntries(projects.map((p) => [p.id, p]));
  const grouped = tasks.reduce<Record<string, typeof tasks>>(
    (acc, task) => {
      const pid = task.project_id;
      if (!acc[pid]) acc[pid] = [];
      acc[pid].push(task);
      return acc;
    },
    {}
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="h1" style={{ color: "var(--ink)" }}>
          All Tasks
        </h1>
        <p className="mt-1 text-[14px]" style={{ color: "var(--text-secondary)" }}>
          {tasks.length} task{tasks.length !== 1 ? "s" : ""} across {projects.length} project{projects.length !== 1 ? "s" : ""}
        </p>
      </div>

      {tasks.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-20 rounded-xl border border-dashed"
          style={{ borderColor: "var(--line)", color: "var(--text-muted)" }}
        >
          <p className="text-[15px] font-semibold mb-1" style={{ color: "var(--ink)" }}>
            No tasks yet
          </p>
          <p className="text-[13px]">Open a project to create tasks.</p>
          <Link
            href="/projects"
            className="mt-5 h-9 px-4 rounded-xl text-[13px] font-bold text-white flex items-center transition-colors duration-150 bg-[var(--navy)] hover:bg-[var(--navy-hover)]"
          >
            Go to Projects
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {Object.entries(grouped).map(([projectId, projectTasks]) => {
            const project = projectMap[projectId];
            return (
              <section key={projectId}>
                {/* Project label */}
                <div className="flex items-center gap-2 mb-3">
                  <div
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ background: project?.color ?? "var(--accent-brand)" }}
                  />
                  <Link
                    href={`/projects/${projectId}`}
                    className="text-[13px] font-bold transition-opacity duration-100 hover:opacity-70"
                    style={{ color: "var(--navy)", fontFamily: "var(--font-display)" }}
                  >
                    {project?.title ?? "Unknown Project"}
                  </Link>
                  <span
                    className="text-[11px] font-semibold px-1.5 rounded"
                    style={{ background: "var(--line)", color: "var(--text-muted)" }}
                  >
                    {projectTasks.length}
                  </span>
                </div>

                {/* Task table */}
                <div
                  className="rounded-xl overflow-hidden"
                  style={{ background: "var(--surface-bg)", boxShadow: "0 1px 8px rgba(0,0,0,0.07), 0 0 0 1px rgba(0,0,0,0.04)" }}
                >
                  {projectTasks.map((task, idx) => {
                    const urgencyColor = `var(${URGENCY_TOKEN[task.urgency ?? "medium"]})`;
                    const urgencyBg = `var(${URGENCY_BG_TOKEN[task.urgency ?? "medium"]})`;
                    const statusColor = `var(${STATUS_COLOR[task.status ?? "todo"]})`;
                    const deadline = task.deadline
                      ? new Date(task.deadline).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                        })
                      : null;
                    const isPastDeadline =
                      task.deadline &&
                      new Date(task.deadline) < new Date() &&
                      task.status !== "done";
                    const checklist = task.task_checklist_items ?? [];
                    const doneCnt = checklist.filter((c) => c.is_done).length;

                    return (
                      <Link
                        key={task.id}
                        href={`/projects/${projectId}`}
                        className="flex items-center gap-4 px-4 py-3 transition-colors duration-100"
                        style={{
                          borderTop: idx > 0 ? "1px solid var(--line-soft)" : undefined,
                        }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.background = "var(--panel-bg)")
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.background = "transparent")
                        }
                      >
                        {/* Status dot */}
                        <span
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ background: statusColor }}
                        />

                        {/* Name */}
                        <span
                          className="flex-1 text-[14px] font-medium truncate"
                          style={{
                            color: "var(--ink)",
                            textDecoration: task.status === "done" ? "line-through" : "none",
                          }}
                        >
                          {task.name}
                        </span>

                        {/* Urgency */}
                        <span
                          className="flex-shrink-0 inline-flex items-center h-5 px-2 rounded text-[10px] font-bold"
                          style={{ background: urgencyBg, color: urgencyColor }}
                        >
                          {(task.urgency ?? "medium").toUpperCase()}
                        </span>

                        {/* Status label */}
                        <span
                          className="flex-shrink-0 text-[12px] font-medium w-24 text-right hidden sm:block"
                          style={{ color: "var(--text-muted)" }}
                        >
                          {STATUS_LABELS[task.status ?? "todo"]}
                        </span>

                        {/* Checklist */}
                        {checklist.length > 0 && (
                          <span
                            className="flex-shrink-0 text-[12px] font-medium hidden md:block"
                            style={{ color: "var(--text-muted)" }}
                          >
                            ☑ {doneCnt}/{checklist.length}
                          </span>
                        )}

                        {/* Deadline */}
                        {deadline && (
                          <span
                            className="flex-shrink-0 flex items-center gap-1 text-[12px] font-medium hidden lg:flex"
                            style={{ color: isPastDeadline ? "var(--clr-red)" : "var(--text-muted)" }}
                          >
                            {isPastDeadline ? (
                              <AlertCircle className="h-3.5 w-3.5" />
                            ) : (
                              <Calendar className="h-3.5 w-3.5" />
                            )}
                            {deadline}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
