"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  MoreHorizontal,
  Pencil,
  Trash2,
  Calendar,
  AlertCircle,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ProjectFormDialog } from "./project-form-dialog";
import type { Project } from "@/types";

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

interface Props {
  project: Project;
  currentUserId: string;
}

export function ProjectCard({ project, currentUserId }: Props) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const isOwner = project.owner_id === currentUserId;

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
    project.deadline && new Date(project.deadline) < new Date() && project.status !== "completed";

  async function handleDelete() {
    if (!confirm(`Delete "${project.title}"? This will delete all tasks inside.`)) return;
    setDeleting(true);
    await fetch(`/api/projects/${project.id}`, {
      method: "DELETE",
      credentials: "same-origin",
    });
    router.refresh();
  }

  return (
    <>
      <article
        className="relative flex flex-col rounded-xl border overflow-hidden transition-shadow duration-150 hover:shadow-[var(--shadow-soft)]"
        style={{ background: "var(--surface-bg)", borderColor: "var(--line)" }}
      >
        {/* Color accent stripe */}
        <div
          className="h-1 w-full flex-shrink-0"
          style={{ background: project.color ?? "var(--accent-brand)" }}
        />

        <div className="flex-1 flex flex-col p-5 gap-3">
          {/* Header row */}
          <div className="flex items-start justify-between gap-2">
            <Link
              href={`/projects/${project.id}`}
              className="group flex-1 min-w-0"
            >
              <h3
                className="h3 truncate transition-colors duration-100 group-hover:underline"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {project.title}
              </h3>
            </Link>

            {isOwner && (
              <DropdownMenu>
                <DropdownMenuTrigger
                  className="flex-shrink-0 p-1 rounded-xl transition-colors duration-100"
                  style={{ color: "var(--text-muted)" }}
                  aria-label="Project options"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-36">
                  <DropdownMenuItem onClick={() => setEditOpen(true)}>
                    <Pencil className="h-3.5 w-3.5 mr-2" /> Edit
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleDelete}
                    disabled={deleting}
                    style={{ color: "var(--clr-red)" }}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          {project.description && (
            <p
              className="text-[13px] leading-snug line-clamp-2"
              style={{ color: "var(--text-secondary)" }}
            >
              {project.description}
            </p>
          )}

          {/* Badges */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Status */}
            <span
              className="inline-flex items-center h-5 px-2 rounded text-[11px] font-semibold"
              style={{
                background: "var(--accent-bg)",
                color: "var(--navy)",
              }}
            >
              {STATUS_LABELS[project.status ?? "active"]}
            </span>

            {/* Urgency */}
            <span
              className="inline-flex items-center h-5 px-2 rounded text-[11px] font-semibold"
              style={{ background: urgencyBg, color: urgencyColor }}
            >
              {(project.urgency ?? "medium").charAt(0).toUpperCase() +
                (project.urgency ?? "medium").slice(1)}
            </span>
          </div>

          {/* Deadline */}
          {deadline && (
            <div
              className="flex items-center gap-1.5 text-[12px] font-medium mt-auto"
              style={{ color: isPastDeadline ? "var(--clr-red)" : "var(--text-muted)" }}
            >
              {isPastDeadline ? (
                <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
              ) : (
                <Calendar className="h-3.5 w-3.5 flex-shrink-0" />
              )}
              {deadline}
            </div>
          )}
        </div>
      </article>

      <ProjectFormDialog open={editOpen} onClose={() => setEditOpen(false)} project={project} />
    </>
  );
}
