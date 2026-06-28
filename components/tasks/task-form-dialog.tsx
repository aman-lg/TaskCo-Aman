"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronDown, Loader2, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createTaskSchema, type CreateTaskInput } from "@/lib/validations/tasks";
import { cn } from "@/lib/utils";
import type { Task } from "@/types";

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
  task?: Task;
  defaultStatus?: "todo" | "in_progress" | "done";
  defaultDeadline?: string;
}

export function TaskFormDialog({ open, onClose, projectId, task, defaultStatus = "todo", defaultDeadline }: Props) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const isEdit = !!task;

  const {
    register,
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
    } else if (open && !task) {
      reset({
        project_id: projectId,
        name: "",
        description: "",
        urgency: "medium",
        status: defaultStatus,
        deadline: defaultDeadline ? `${defaultDeadline}T09:00` : undefined,
      });
    }
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
            <input type="hidden" {...register("project_id")} />

            {/* Form fields card */}
            <div className="flex flex-col gap-4 p-4 rounded-lg bg-[var(--panel-bg)] border border-[var(--line-soft)]">

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
              <div className="float-label-wrap">
                <textarea
                  {...register("description")}
                  placeholder=" "
                  className="float-label-textarea"
                />
                <label className="float-label">Description (optional)</label>
              </div>

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
