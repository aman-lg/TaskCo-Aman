"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronDown, Loader2, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { createTaskSchema, type CreateTaskInput } from "@/lib/validations/tasks";
import { cn } from "@/lib/utils";
import type { Task } from "@/types";
import type { AssigneeProfile } from "@/lib/queries/tasks";
import { useOrgUnits } from "@/lib/hooks/use-org-units";
import { AssignedToPicker, type AssignedToValue } from "./assigned-to-picker";

const URGENCY_OPTIONS = [
  { value: "low",    label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high",   label: "High" },
  { value: "urgent", label: "Urgent" },
] as const;

const STATUS_OPTIONS = [
  { value: "todo",        label: "To Do" },
  { value: "in_progress", label: "In Progress" },
  { value: "done",        label: "Done" },
] as const;

interface Props {
  open: boolean;
  onClose: () => void;
  projectId: string;
  task?: Task & { task_assignees?: AssigneeProfile[] };
  defaultStatus?: "todo" | "in_progress" | "done";
  defaultDeadline?: string;
  /** When provided, renders a visible Project selector instead of a fixed hidden field (used where the target project is ambiguous, e.g. the dashboard). */
  projects?: { id: string; title: string }[];
}

export function TaskFormDialog({ open, onClose, projectId, task, defaultStatus = "todo", defaultDeadline, projects }: Props) {
  const router = useRouter();
  const { units } = useOrgUnits();
  const [serverError, setServerError] = useState<string | null>(null);
  const isEdit = !!task;

  // Existing assignees (edit mode) shown as removable chips, separate from
  // the department-scoped picker below which is only for adding new people —
  // current assignees rarely all belong to one department/sub-department, so
  // trying to force them through that same narrowing picker would silently
  // hide whoever doesn't match whatever department happens to be selected.
  const [currentAssignees, setCurrentAssignees] = useState<AssigneeProfile[]>([]);
  const [removedAssigneeIds, setRemovedAssigneeIds] = useState<string[]>([]);
  const [addAssignees, setAddAssignees] = useState<AssignedToValue>({ deptId: null, subDeptId: null, personIds: [] });

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateTaskInput>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(createTaskSchema) as any,
    defaultValues: {
      project_id: projectId,
      name: "",
      description: "",
      urgency: "medium",
      status: defaultStatus,
    },
  });

  useEffect(() => {
    if (open && task) {
      reset({
        project_id: projectId,
        name: task.name,
        description: task.description ?? "",
        urgency: task.urgency ?? "medium",
        status: task.status ?? "todo",
        deadline: task.deadline ?? undefined,
        start_date: task.start_date ?? undefined,
        end_date: task.end_date ?? undefined,
      });
      setCurrentAssignees(task.task_assignees ?? []);
    } else if (open && !task) {
      reset({
        project_id: projectId,
        name: "",
        description: "",
        urgency: "medium",
        status: defaultStatus,
        deadline: defaultDeadline ? `${defaultDeadline}T09:00` : undefined,
      });
      setCurrentAssignees([]);
    }
    setRemovedAssigneeIds([]);
    setAddAssignees({ deptId: null, subDeptId: null, personIds: [] });
    setServerError(null);
  }, [open, task, projectId, defaultStatus, defaultDeadline, reset]);

  const onSubmit: SubmitHandler<CreateTaskInput> = async (values) => {
    setServerError(null);
    const url = isEdit ? `/api/tasks/${task!.id}` : "/api/tasks";
    const method = isEdit ? "PATCH" : "POST";
    const body = isEdit
      ? (() => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { project_id: _pid, ...rest } = values;
          return rest;
        })()
      : values;

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) {
      setServerError(json.error?.message ?? "Something went wrong");
      return;
    }

    const taskId: string = isEdit ? task!.id : json.data.id;
    const currentIds = new Set(currentAssignees.map((a) => a.user_id));
    const toAdd = addAssignees.personIds.filter((id) => !currentIds.has(id));
    const toRemove = removedAssigneeIds.filter((id) => currentIds.has(id));

    await Promise.all([
      ...toAdd.map((user_id) =>
        fetch(`/api/tasks/${taskId}/assignees`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ user_id }),
        })
      ),
      ...toRemove.map((user_id) =>
        fetch(`/api/tasks/${taskId}/assignees?user_id=${user_id}`, {
          method: "DELETE",
          credentials: "same-origin",
        })
      ),
    ]);

    router.refresh();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="w-full max-w-[calc(100vw-2rem)] sm:max-w-[500px] p-0 gap-0 overflow-hidden"
        showCloseButton={false}
      >
        {/* ── Header ────────────────────────────────────────────── */}
        <DialogHeader className="flex flex-row items-center justify-between gap-3 px-6 py-4 border-b border-[var(--line)]">
          <DialogTitle className="h3 text-[var(--ink)]">
            {isEdit ? "Edit Task" : "New Task"}
          </DialogTitle>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-[var(--text-muted)] transition-colors hover:bg-[var(--line-soft)] flex-shrink-0"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </DialogHeader>

        {/* ── Form ──────────────────────────────────────────────── */}
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="p-5 max-h-[65vh] overflow-y-auto">
            {/* Form fields card */}
            <div className="flex flex-col gap-4 p-4 rounded-lg bg-[var(--panel-bg)] border border-[var(--line-soft)]">

              {/* Project — visible selector when the target project is ambiguous
                  (e.g. dashboard); fixed elsewhere (e.g. inside a project's board),
                  and never changeable once a task exists. */}
              {projects && projects.length > 0 && !isEdit ? (
                <div className="select-wrap">
                  <select {...register("project_id")} className="select-field">
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>{p.title}</option>
                    ))}
                  </select>
                  <span className="select-label">Project</span>
                  <ChevronDown className="select-arrow" />
                </div>
              ) : (
                <input type="hidden" {...register("project_id")} />
              )}
              {isEdit && projects && projects.length > 0 && (
                <p className="text-[12px] font-medium" style={{ color: "var(--text-muted)" }}>
                  Project: {projects.find((p) => p.id === projectId)?.title ?? "—"}
                </p>
              )}

              {/* Name */}
              <div className="float-label-wrap">
                <input
                  {...register("name")}
                  placeholder=" "
                  className={cn("float-label-input", errors.name && "error-state")}
                />
                <label className="float-label">
                  Task name <span className="text-[var(--clr-red)]">*</span>
                </label>
                {errors.name && (
                  <p className="mt-1 text-[11px] font-semibold text-[var(--clr-red)]">
                    {errors.name.message}
                  </p>
                )}
              </div>

              {/* Description */}
              <Controller
                name="description"
                control={control}
                render={({ field }) => (
                  <RichTextEditor
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    placeholder="Description (optional)"
                  />
                )}
              />

              {/* Status + Urgency */}
              <div className="grid grid-cols-2 gap-3">
                <div className="select-wrap">
                  <select {...register("status")} className="select-field">
                    {STATUS_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  <span className="select-label">Status</span>
                  <ChevronDown className="select-arrow" />
                </div>
                <div className="select-wrap">
                  <select {...register("urgency")} className="select-field">
                    {URGENCY_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  <span className="select-label">Urgency</span>
                  <ChevronDown className="select-arrow" />
                </div>
              </div>

              {/* Deadline — float-label-input keeps native calendar icon; label is always lifted */}
              <div className="float-label-wrap">
                <input
                  {...register("deadline")}
                  type="datetime-local"
                  className="float-label-input"
                />
                <label className="float-label">Deadline (optional)</label>
              </div>

              {/* Assigned To */}
              <div className="flex flex-col gap-2">
                <p className="text-[12px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                  Assigned To
                </p>

                {currentAssignees.filter((a) => !removedAssigneeIds.includes(a.user_id)).length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {currentAssignees
                      .filter((a) => !removedAssigneeIds.includes(a.user_id))
                      .map((a) => (
                        <span
                          key={a.user_id}
                          className="flex items-center gap-1.5 h-7 pl-2.5 pr-1.5 rounded-full text-[12px] font-medium"
                          style={{ background: "var(--navy-l)", color: "var(--navy)" }}
                        >
                          {a.assignee?.full_name ?? "Unknown"}
                          <button
                            type="button"
                            onClick={() => setRemovedAssigneeIds((prev) => [...prev, a.user_id])}
                            className="p-0.5 rounded-full hover:bg-black/10"
                            aria-label={`Remove ${a.assignee?.full_name ?? "assignee"}`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                  </div>
                )}

                <AssignedToPicker units={units} value={addAssignees} onChange={setAddAssignees} />
              </div>

              {serverError && (
                <p className="text-[13px] font-medium px-3 py-2 rounded-xl text-[var(--clr-red)] bg-[var(--clr-red-bg)]">
                  {serverError}
                </p>
              )}
            </div>
          </div>

          {/* ── Footer ────────────────────────────────────────────── */}
          <div className="px-5 py-4 flex justify-end gap-2 border-t border-[var(--line)] bg-[var(--panel-bg)]">
            <button
              type="button"
              onClick={onClose}
              className="h-10 px-5 rounded-xl text-[13px] font-semibold border border-[var(--line)] text-[var(--text-secondary)] bg-transparent transition-colors duration-150 hover:bg-[var(--line-soft)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="h-10 px-6 rounded-xl text-[13px] font-bold text-white flex items-center gap-2 transition-colors duration-150 bg-[var(--navy)] hover:bg-[var(--navy-hover)] disabled:opacity-50"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? "Save changes" : "Create task"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
