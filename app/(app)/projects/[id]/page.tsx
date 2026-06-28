import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronRight, Calendar, AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getProjectById } from "@/lib/queries/projects";
import { getTasksForProject, type TaskWithMeta } from "@/lib/queries/tasks";
import { KanbanBoard } from "@/components/tasks/kanban-board";
import { ProjectActivity } from "@/components/projects/project-activity";

const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  on_hold: "On Hold",
  completed: "Completed",
  archived: "Archived",
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

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ProjectDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const [project, tasks, { data: { user } }] = await Promise.all([
    getProjectById(supabase, id),
    getTasksForProject(supabase, id),
    supabase.auth.getUser(),
  ]);

  if (!project) notFound();

  const urgencyColor = `var(${URGENCY_TOKEN[project.urgency ?? "medium"]})`;
  const urgencyBg = `var(${URGENCY_BG_TOKEN[project.urgency ?? "medium"]})`;

  const deadline = project.deadline
    ? new Date(project.deadline).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null;

  const isPastDeadline =
    project.deadline &&
    new Date(project.deadline) < new Date() &&
    project.status !== "completed";

  return (
    <div className="flex flex-col gap-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-[13px]" aria-label="Breadcrumb">
        <Link
          href="/projects"
          className="font-medium transition-colors duration-100"
          style={{ color: "var(--text-muted)" }}
        >
          Projects
        </Link>
        <ChevronRight className="h-3.5 w-3.5 flex-shrink-0" style={{ color: "var(--text-fine)" }} />
        <span className="font-semibold truncate max-w-[280px]" style={{ color: "var(--ink)" }}>
          {project.title}
        </span>
      </nav>

      {/* Project header */}
      <div
        className="rounded-xl p-6"
        style={{ background: "var(--surface-bg)", boxShadow: "0 1px 8px rgba(0,0,0,0.07), 0 0 0 1px rgba(0,0,0,0.04)" }}
      >
        <div className="flex items-start gap-4">
          {/* Color dot */}
          <div
            className="mt-1 w-3 h-3 rounded-full flex-shrink-0"
            style={{ background: project.color ?? "var(--accent-brand)" }}
          />

          <div className="flex-1 min-w-0">
            <h1
              className="h1 text-balance"
              style={{ color: "var(--ink)" }}
            >
              {project.title}
            </h1>

            {project.description && (
              <p
                className="mt-2 text-[14px] leading-relaxed"
                style={{ color: "var(--text-secondary)" }}
              >
                {project.description}
              </p>
            )}

            <div className="flex items-center gap-3 mt-4 flex-wrap">
              {/* Status */}
              <span
                className="inline-flex items-center h-5 px-2.5 rounded-[6px] text-[10px] font-bold"
                style={{ background: "var(--accent-bg)", color: "var(--navy)" }}
              >
                {STATUS_LABELS[project.status ?? "active"]}
              </span>

              {/* Urgency */}
              <span
                className="inline-flex items-center h-5 px-2.5 rounded-[6px] text-[10px] font-bold"
                style={{ background: urgencyBg, color: urgencyColor }}
              >
                {(project.urgency ?? "medium").charAt(0).toUpperCase() +
                  (project.urgency ?? "medium").slice(1)}
              </span>

              {/* Deadline */}
              {deadline && (
                <span
                  className="flex items-center gap-1.5 text-[12px] font-medium"
                  style={{ color: isPastDeadline ? "var(--clr-red)" : "var(--text-muted)" }}
                >
                  {isPastDeadline ? (
                    <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                  ) : (
                    <Calendar className="h-3.5 w-3.5 flex-shrink-0" />
                  )}
                  {deadline}
                </span>
              )}

              {/* Task count */}
              <span className="text-[12px] font-medium ml-auto" style={{ color: "var(--text-muted)" }}>
                {tasks.length} task{tasks.length !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Kanban board */}
      <KanbanBoard
        tasks={tasks as TaskWithMeta[]}
        projectId={project.id}
        currentUserId={user?.id ?? ""}
      />

      {/* Activity Feed */}
      <div
        className="rounded-xl p-6"
        style={{ background: "var(--surface-bg)", boxShadow: "0 1px 8px rgba(0,0,0,0.07), 0 0 0 1px rgba(0,0,0,0.04)" }}
      >
        <h2 className="h3 mb-4" style={{ color: "var(--ink)" }}>Activity</h2>
        <ProjectActivity projectId={project.id} />
      </div>
    </div>
  );
}
