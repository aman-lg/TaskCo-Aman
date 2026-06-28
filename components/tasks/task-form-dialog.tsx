"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { createTaskSchema, type CreateTaskInput } from "@/lib/validations/tasks";
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
}

export function TaskFormDialog({ open, onClose, projectId, task, defaultStatus = "todo" }: Props) {
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
      });
    }
    setServerError(null);
  }, [open, task, projectId, defaultStatus, reset]);

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
      <DialogContent className="max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="h3">
            {isEdit ? "Edit Task" : "New Task"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5 mt-1">
          {/* Hidden project_id */}
          <input type="hidden" {...register("project_id")} />

          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-semibold" style={{ color: "var(--ink)" }}>
              Task name <span style={{ color: "var(--clr-red)" }}>*</span>
            </label>
            <input
              {...register("name")}
              className="h-10 px-3 rounded-lg border text-[14px] outline-none transition-[border-color] duration-150"
              style={{
                borderColor: errors.name ? "var(--clr-red)" : "var(--line)",
                background: "var(--surface-bg)",
                color: "var(--ink)",
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "var(--navy)")}
              onBlur={(e) =>
                (e.currentTarget.style.borderColor = errors.name ? "var(--clr-red)" : "var(--line)")
              }
              placeholder="e.g. Design login screen mockup"
            />
            {errors.name && (
              <p className="text-[12px] font-medium" style={{ color: "var(--clr-red)" }}>
                {errors.name.message}
              </p>
            )}
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-semibold" style={{ color: "var(--ink)" }}>
              Description
            </label>
            <textarea
              {...register("description")}
              rows={3}
              className="px-3 py-2.5 rounded-lg border text-[14px] outline-none resize-none transition-[border-color] duration-150"
              style={{
                borderColor: "var(--line)",
                background: "var(--surface-bg)",
                color: "var(--ink)",
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "var(--navy)")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "var(--line)")}
              placeholder="Optional details, context, or requirements…"
            />
          </div>

          {/* Status + Urgency */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-semibold" style={{ color: "var(--ink)" }}>
                Status
              </label>
              <select
                {...register("status")}
                className="h-10 px-3 rounded-lg border text-[14px] outline-none"
                style={{
                  borderColor: "var(--line)",
                  background: "var(--surface-bg)",
                  color: "var(--ink)",
                }}
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-semibold" style={{ color: "var(--ink)" }}>
                Urgency
              </label>
              <select
                {...register("urgency")}
                className="h-10 px-3 rounded-lg border text-[14px] outline-none"
                style={{
                  borderColor: "var(--line)",
                  background: "var(--surface-bg)",
                  color: "var(--ink)",
                }}
              >
                {URGENCY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Deadline */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-semibold" style={{ color: "var(--ink)" }}>
              Deadline
            </label>
            <input
              {...register("deadline")}
              type="datetime-local"
              className="h-10 px-3 rounded-lg border text-[14px] outline-none"
              style={{
                borderColor: "var(--line)",
                background: "var(--surface-bg)",
                color: "var(--ink)",
              }}
            />
          </div>

          {serverError && (
            <p
              className="text-[13px] font-medium px-3 py-2 rounded-lg"
              style={{ color: "var(--clr-red)", background: "var(--clr-red-bg)" }}
            >
              {serverError}
            </p>
          )}

          <DialogFooter className="mt-2">
            <button
              type="button"
              onClick={onClose}
              className="h-10 px-5 rounded-xl text-[14px] font-semibold border transition-colors duration-150"
              style={{
                borderColor: "var(--line)",
                color: "var(--text-secondary)",
                background: "transparent",
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="h-10 px-6 rounded-xl text-[14px] font-bold text-white flex items-center gap-2 transition-[box-shadow,opacity] duration-150 hover:shadow-[var(--shadow-needle)] disabled:opacity-50"
              style={{ background: "var(--navy)" }}
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? "Save changes" : "Create task"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
