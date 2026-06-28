"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, Calendar, AlertCircle } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { TaskFormDialog } from "./task-form-dialog";
import { TaskChecklist } from "./task-checklist";
import type { Task } from "@/types";

type ChecklistItemMin = { id: string; is_done: boolean; content?: string; position?: number };

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
const STATUS_LABELS: Record<string, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  done: "Done",
};

interface Props {
  task: (Task & { task_checklist_items: ChecklistItemMin[] }) | null;
  open: boolean;
  onClose: () => void;
  currentUserId: string;
}

export function TaskDetailSheet({ task, open, onClose, currentUserId }: Props) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (!task) return null;

  const isCreator = task.created_by === currentUserId;
  const urgencyColor = `var(${URGENCY_TOKEN[task.urgency ?? "medium"]})`;
  const urgencyBg = `var(${URGENCY_BG_TOKEN[task.urgency ?? "medium"]})`;

  const deadline = task.deadline
    ? new Date(task.deadline).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  const isPastDeadline =
    task.deadline && new Date(task.deadline) < new Date() && task.status !== "done";

  async function handleDelete() {
    if (!confirm(`Delete "${task!.name}"?`)) return;
    setDeleting(true);
    await fetch(`/api/tasks/${task!.id}`, {
      method: "DELETE",
      credentials: "same-origin",
    });
    onClose();
    router.refresh();
  }

  return (
    <>
      <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
        <SheetContent className="w-full sm:max-w-[520px] flex flex-col overflow-y-auto" style={{ background: "var(--surface-bg)" }}>
          <SheetHeader className="flex-shrink-0">
            <div className="flex items-start justify-between gap-3 pr-8">
              <SheetTitle
                className="h2 text-balance leading-snug"
                style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}
              >
                {task.name}
              </SheetTitle>

              {isCreator && (
                <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
                  <button
                    type="button"
                    onClick={() => setEditOpen(true)}
                    className="p-2 rounded-lg transition-colors duration-100"
                    style={{ color: "var(--text-muted)" }}
                    aria-label="Edit task"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={deleting}
                    className="p-2 rounded-lg transition-colors duration-100"
                    style={{ color: "var(--clr-red)" }}
                    aria-label="Delete task"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          </SheetHeader>

          <div className="flex-1 flex flex-col gap-6 mt-5 overflow-y-auto pr-1">
            {/* Badges */}
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className="inline-flex items-center h-6 px-2.5 rounded-full text-[11px] font-bold"
                style={{ background: "var(--accent-bg)", color: "var(--navy)" }}
              >
                {STATUS_LABELS[task.status ?? "todo"]}
              </span>
              <span
                className="inline-flex items-center h-6 px-2.5 rounded-full text-[11px] font-bold"
                style={{ background: urgencyBg, color: urgencyColor }}
              >
                {(task.urgency ?? "medium").charAt(0).toUpperCase() +
                  (task.urgency ?? "medium").slice(1)}
              </span>
            </div>

            {/* Description */}
            {task.description && (
              <div className="flex flex-col gap-1.5">
                <p className="text-[11px] font-bold uppercase tracking-[0.8px]" style={{ color: "var(--text-muted)" }}>
                  Description
                </p>
                <p className="text-[14px] leading-relaxed" style={{ color: "var(--text-secondary)", whiteSpace: "pre-wrap" }}>
                  {task.description}
                </p>
              </div>
            )}

            {/* Deadline */}
            {deadline && (
              <div className="flex flex-col gap-1.5">
                <p className="text-[11px] font-bold uppercase tracking-[0.8px]" style={{ color: "var(--text-muted)" }}>
                  Deadline
                </p>
                <div
                  className="flex items-center gap-1.5 text-[13px] font-medium"
                  style={{ color: isPastDeadline ? "var(--clr-red)" : "var(--ink)" }}
                >
                  {isPastDeadline ? (
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  ) : (
                    <Calendar className="h-4 w-4 flex-shrink-0" />
                  )}
                  {deadline}
                  {isPastDeadline && (
                    <span className="ml-1 text-[11px] font-bold px-1.5 py-0.5 rounded" style={{ background: "var(--clr-red-bg)", color: "var(--clr-red)" }}>
                      Overdue
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Divider */}
            <div style={{ borderTop: "1px solid var(--line)" }} />

            {/* Checklist */}
            <TaskChecklist
              taskId={task.id}
              items={task.task_checklist_items.map((i) => ({
                id: i.id,
                content: i.content ?? "",
                is_done: i.is_done ?? false,
                position: i.position ?? 0,
              }))}
            />
          </div>
        </SheetContent>
      </Sheet>

      <TaskFormDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        projectId={task.project_id}
        task={task}
      />
    </>
  );
}
