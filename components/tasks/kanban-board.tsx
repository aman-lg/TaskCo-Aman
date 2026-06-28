"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, MoreHorizontal, Pencil, Trash2, Calendar, AlertCircle } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TaskFormDialog } from "./task-form-dialog";
import { TaskDetailSheet } from "./task-detail-sheet";
import type { Task } from "@/types";
import type { TaskWithMeta } from "@/lib/queries/tasks";

type TaskStatus = "todo" | "in_progress" | "done";
type TaskWithChecklist = TaskWithMeta;

const COLUMNS: { id: TaskStatus; label: string; colorToken: string }[] = [
  { id: "todo",        label: "To Do",       colorToken: "--status-todo" },
  { id: "in_progress", label: "In Progress",  colorToken: "--status-in-progress" },
  { id: "done",        label: "Done",         colorToken: "--status-done" },
];

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
  tasks: TaskWithChecklist[];
  projectId: string;
  currentUserId: string;
}

export function KanbanBoard({ tasks, projectId, currentUserId }: Props) {
  const router = useRouter();
  const [addingIn, setAddingIn] = useState<TaskStatus | null>(null);
  const [detailTask, setDetailTask] = useState<TaskWithChecklist | null>(null);
  const [editTask, setEditTask] = useState<Task | null>(null);

  async function deleteTask(task: Task) {
    if (!confirm(`Delete "${task.name}"?`)) return;
    await fetch(`/api/tasks/${task.id}`, { method: "DELETE", credentials: "same-origin" });
    router.refresh();
  }

  async function moveTask(task: Task, newStatus: TaskStatus) {
    await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ status: newStatus }),
    });
    router.refresh();
  }

  return (
    <>
      <div className="grid grid-cols-3 gap-4 items-start">
        {COLUMNS.map((col) => {
          const colTasks = tasks.filter((t) => t.status === col.id);
          return (
            <div
              key={col.id}
              className="flex flex-col gap-3 rounded-xl p-3 min-h-[200px]"
              style={{ background: "var(--panel-bg)", border: "1px solid var(--line-soft)" }}
            >
              {/* Column header */}
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: `var(${col.colorToken})` }}
                  />
                  <span
                    className="text-[12px] font-bold uppercase tracking-[0.8px]"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {col.label}
                  </span>
                  <span
                    className="text-[11px] font-semibold px-1.5 rounded"
                    style={{ background: "var(--line)", color: "var(--text-secondary)" }}
                  >
                    {colTasks.length}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setAddingIn(col.id)}
                  className="p-1 rounded-lg transition-opacity duration-100 hover:opacity-70"
                  style={{ color: "var(--text-muted)" }}
                  aria-label={`Add task to ${col.label}`}
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>

              {/* Task cards */}
              <div className="flex flex-col gap-2.5">
                {colTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    currentUserId={currentUserId}
                    onOpen={() => setDetailTask(task)}
                    onEdit={() => setEditTask(task)}
                    onDelete={() => deleteTask(task)}
                    onMove={(s) => moveTask(task, s)}
                  />
                ))}
              </div>

              {colTasks.length === 0 && (
                <p
                  className="text-center text-[12px] py-4"
                  style={{ color: "var(--text-fine)" }}
                >
                  No tasks
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Add task dialog */}
      <TaskFormDialog
        open={!!addingIn}
        onClose={() => setAddingIn(null)}
        projectId={projectId}
        defaultStatus={addingIn ?? "todo"}
      />

      {/* Edit task dialog */}
      {editTask && (
        <TaskFormDialog
          open={!!editTask}
          onClose={() => setEditTask(null)}
          projectId={projectId}
          task={editTask}
        />
      )}

      {/* Task detail sheet */}
      <TaskDetailSheet
        task={detailTask}
        open={!!detailTask}
        onClose={() => setDetailTask(null)}
        currentUserId={currentUserId}
      />
    </>
  );
}

// ── Individual task card ──────────────────────────────────────────────────────

interface CardProps {
  task: TaskWithChecklist;
  currentUserId: string;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onMove: (status: TaskStatus) => void;
}

function TaskCard({ task, currentUserId, onOpen, onEdit, onDelete, onMove }: CardProps) {
  const isCreator = task.created_by === currentUserId;
  const urgencyColor = `var(${URGENCY_TOKEN[task.urgency ?? "medium"]})`;
  const urgencyBg = `var(${URGENCY_BG_TOKEN[task.urgency ?? "medium"]})`;

  const checklist = task.task_checklist_items ?? [];
  const doneCnt = checklist.filter((i) => i.is_done).length;
  const totalCnt = checklist.length;

  const deadline = task.deadline
    ? new Date(task.deadline).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
    : null;
  const isPastDeadline =
    task.deadline && new Date(task.deadline) < new Date() && task.status !== "done";

  const otherStatuses: TaskStatus[] = (["todo", "in_progress", "done"] as TaskStatus[]).filter(
    (s) => s !== task.status
  );
  const STATUS_LABEL: Record<TaskStatus, string> = {
    todo: "To Do",
    in_progress: "In Progress",
    done: "Done",
  };

  return (
    <article
      className="group relative flex flex-col gap-2.5 p-3.5 rounded-lg border cursor-pointer transition-shadow duration-150 hover:shadow-[var(--shadow-soft)]"
      style={{ background: "var(--surface-bg)", borderColor: "var(--line)" }}
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onOpen()}
    >
      {/* Card menu — stops propagation so it doesn't open the sheet */}
      {isCreator && (
        <div
          className="absolute top-2.5 right-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-100"
          onClick={(e) => e.stopPropagation()}
        >
          <DropdownMenu>
            <DropdownMenuTrigger
              className="p-1 rounded-md transition-colors duration-100"
              style={{ color: "var(--text-muted)" }}
              aria-label="Task options"
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem onClick={onEdit}>
                <Pencil className="h-3.5 w-3.5 mr-2" /> Edit
              </DropdownMenuItem>
              {otherStatuses.map((s) => (
                <DropdownMenuItem key={s} onClick={() => onMove(s)}>
                  Move → {STATUS_LABEL[s]}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={onDelete}
                className="text-red-600 focus:text-red-600"
              >
                <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {/* Task name */}
      <p className="text-[13px] font-semibold pr-5 leading-snug" style={{ color: "var(--ink)" }}>
        {task.name}
      </p>

      {/* Urgency badge */}
      <span
        className="self-start inline-flex items-center h-5 px-2 rounded text-[10px] font-bold"
        style={{ background: urgencyBg, color: urgencyColor }}
      >
        {(task.urgency ?? "medium").toUpperCase()}
      </span>

      {/* Meta row */}
      <div className="flex items-center justify-between gap-2">
        {/* Checklist count */}
        {totalCnt > 0 && (
          <span className="text-[11px] font-medium" style={{ color: "var(--text-muted)" }}>
            ☑ {doneCnt}/{totalCnt}
          </span>
        )}

        {/* Deadline */}
        {deadline && (
          <span
            className="flex items-center gap-1 text-[11px] font-medium ml-auto"
            style={{ color: isPastDeadline ? "var(--clr-red)" : "var(--text-muted)" }}
          >
            {isPastDeadline ? (
              <AlertCircle className="h-3 w-3" />
            ) : (
              <Calendar className="h-3 w-3" />
            )}
            {deadline}
          </span>
        )}
      </div>
    </article>
  );
}
