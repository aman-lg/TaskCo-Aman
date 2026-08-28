"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Trash2, Calendar, AlertCircle, X, Users } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { TaskFormDialog } from "./task-form-dialog";
import { TaskChecklist } from "./task-checklist";
import { TaskFilesPanel } from "./task-files-panel";
import type { Task } from "@/types";
import type { AssigneeProfile } from "@/lib/queries/tasks";

interface AssigneeWithDept extends AssigneeProfile {
  department?: { department: string; subDepartment: string | null } | null;
}

function initials(name: string | null) {
  if (!name) return "?";
  return name.split(" ").map((p) => p[0]).join("").toUpperCase().slice(0, 2);
}

type ChecklistItemMin = { id: string; is_done: boolean; content: string | null; position: number | null };

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
  task: (Task & { task_checklist_items: ChecklistItemMin[]; task_assignees?: AssigneeProfile[] }) | null;
  open: boolean;
  onClose: () => void;
  currentUserId: string;
}

export function TaskDetailSheet({ task, open, onClose, currentUserId }: Props) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [assignees, setAssignees] = useState<AssigneeWithDept[]>(task?.task_assignees ?? []);

  const taskId = task?.id;
  useEffect(() => {
    if (!taskId || !open) return;
    setAssignees(task?.task_assignees ?? []);
    fetch(`/api/tasks/${taskId}/assignees`, { credentials: "same-origin" })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => { if (json?.data) setAssignees(json.data); })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId, open]);

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
    setDeleting(true);
    try {
      const res = await fetch(`/api/tasks/${task!.id}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        toast.error(json?.error?.message ?? "Failed to delete task");
        return;
      }
      setConfirmDeleteOpen(false);
      onClose();
      router.refresh();
    } catch (err) {
      console.error("[task-detail-sheet] delete failed", err);
      toast.error("Failed to delete task — check your connection");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
        <SheetContent
          className="w-full sm:max-w-[480px] p-0 flex flex-col gap-0"
          showCloseButton={false}
          style={{ background: "var(--surface-bg)" }}
        >
          {/* ── Header ──────────────────────────────────────── */}
          <SheetHeader className="flex-shrink-0 px-6 py-5 border-b border-[var(--line)] flex-row items-start justify-between gap-3">
            <SheetTitle
              className="h2 text-balance leading-snug flex-1"
              style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}
            >
              {task.name}
            </SheetTitle>

            <div className="flex items-center gap-0.5 flex-shrink-0 mt-0.5">
              {isCreator && (
                <>
                  <button
                    type="button"
                    onClick={() => setEditOpen(true)}
                    className="p-2 rounded-lg text-[var(--text-muted)] transition-colors hover:bg-[var(--line-soft)]"
                    aria-label="Edit task"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteOpen(true)}
                    disabled={deleting}
                    className="p-2 rounded-lg text-[var(--clr-red)] transition-colors hover:bg-[var(--clr-red-bg)]"
                    aria-label="Delete task"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-lg text-[var(--text-muted)] transition-colors hover:bg-[var(--line-soft)]"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </SheetHeader>

          {/* ── Scrollable body ──────────────────────────────── */}
          <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-6">
            {/* Status + Urgency badges */}
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className="inline-flex items-center h-5 px-2 rounded text-[10px] font-bold"
                style={{ background: "var(--accent-bg)", color: "var(--navy)" }}
              >
                {STATUS_LABELS[task.status ?? "todo"]}
              </span>
              <span
                className="inline-flex items-center h-5 px-2 rounded text-[10px] font-bold"
                style={{ background: urgencyBg, color: urgencyColor }}
              >
                {(task.urgency ?? "medium").charAt(0).toUpperCase() +
                  (task.urgency ?? "medium").slice(1)}
              </span>
            </div>

            {/* Assigned To */}
            <div className="flex flex-col gap-1.5">
              <p className="text-[11px] font-bold uppercase tracking-[0.8px] flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}>
                <Users className="h-3 w-3" /> Assigned To
              </p>
              {assignees.length === 0 ? (
                <p className="text-[13px]" style={{ color: "var(--text-fine)" }}>Unassigned</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {assignees.map((a) => (
                    <div key={a.user_id} className="flex items-center gap-2.5">
                      <Avatar className="w-7 h-7">
                        <AvatarImage src={a.assignee?.avatar_url ?? undefined} />
                        <AvatarFallback className="text-[10px] font-semibold" style={{ background: "var(--navy-l)", color: "var(--navy)" }}>
                          {initials(a.assignee?.full_name ?? null)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium truncate" style={{ color: "var(--ink)" }}>
                          {a.assignee?.full_name ?? "Unknown"}
                        </p>
                        {a.department && (
                          <p className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>
                            {a.department.subDepartment
                              ? `${a.department.department} / ${a.department.subDepartment}`
                              : a.department.department}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Description */}
            {task.description && (
              <div className="flex flex-col gap-1.5">
                <p className="text-[11px] font-bold uppercase tracking-[0.8px]" style={{ color: "var(--text-muted)" }}>
                  Description
                </p>
                <div
                  className="text-[14px] leading-relaxed"
                  style={{ color: "var(--text-secondary)" }}
                  dangerouslySetInnerHTML={{ __html: task.description }}
                />
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
                  {isPastDeadline
                    ? <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    : <Calendar className="h-4 w-4 flex-shrink-0" />}
                  {deadline}
                  {isPastDeadline && (
                    <span
                      className="ml-1 text-[10px] font-bold px-1.5 py-0.5 rounded"
                      style={{ background: "var(--clr-red-bg)", color: "var(--clr-red)" }}
                    >
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

            {/* Divider */}
            <div style={{ borderTop: "1px solid var(--line)" }} />

            {/* Files */}
            <TaskFilesPanel taskId={task.id} currentUserId={currentUserId} canManage={isCreator} />
          </div>
        </SheetContent>
      </Sheet>

      <TaskFormDialog
        open={editOpen}
        onClose={() => { setEditOpen(false); router.refresh(); }}
        projectId={task.project_id}
        task={task}
      />

      <ConfirmDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        title={`Delete "${task.name}"?`}
        description="This action cannot be undone."
        confirmLabel="Delete"
        destructive
        loading={deleting}
        onConfirm={handleDelete}
      />
    </>
  );
}
