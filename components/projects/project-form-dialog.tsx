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
import { createProjectSchema, type CreateProjectInput } from "@/lib/validations/projects";
import type { Project } from "@/types";

const STATUS_OPTIONS = [
  { value: "active",    label: "Active" },
  { value: "on_hold",   label: "On Hold" },
  { value: "completed", label: "Completed" },
  { value: "archived",  label: "Archived" },
] as const;

const URGENCY_OPTIONS = [
  { value: "low",    label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high",   label: "High" },
  { value: "urgent", label: "Urgent" },
] as const;

const PROJECT_COLORS = [
  "#19183B", "#708993", "#A1C2BD", "#16A34A",
  "#D97706", "#DC2626", "#7C3AED", "#0891B2",
];

interface Props {
  open: boolean;
  onClose: () => void;
  project?: Project; // if provided → edit mode
}

export function ProjectFormDialog({ open, onClose, project }: Props) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const isEdit = !!project;

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CreateProjectInput>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(createProjectSchema) as any,
    defaultValues: {
      title: "",
      description: "",
      urgency: "medium",
      status: "active",
      color: PROJECT_COLORS[2],
    },
  });

  useEffect(() => {
    if (open && project) {
      reset({
        title: project.title,
        description: project.description ?? "",
        urgency: project.urgency ?? "medium",
        status: project.status ?? "active",
        color: project.color ?? PROJECT_COLORS[2],
        start_date: project.start_date ?? undefined,
        end_date: project.end_date ?? undefined,
        deadline: project.deadline ?? undefined,
      });
    } else if (open && !project) {
      reset({
        title: "",
        description: "",
        urgency: "medium",
        status: "active",
        color: PROJECT_COLORS[2],
      });
    }
    setServerError(null);
  }, [open, project, reset]);

  const selectedColor = watch("color");

  const onSubmit: SubmitHandler<CreateProjectInput> = async (values) => {
    setServerError(null);
    const url = isEdit ? `/api/projects/${project!.id}` : "/api/projects";
    const method = isEdit ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(values),
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
      <DialogContent className="max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="h3" style={{ fontFamily: "var(--font-display)" }}>
            {isEdit ? "Edit Project" : "New Project"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5 mt-1">
          {/* Title */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-semibold" style={{ color: "var(--ink)" }}>
              Title <span style={{ color: "var(--clr-red)" }}>*</span>
            </label>
            <input
              {...register("title")}
              className="h-10 px-3 rounded-lg border text-[14px] outline-none transition-[border-color,box-shadow] duration-150"
              style={{
                borderColor: errors.title ? "var(--clr-red)" : "var(--line)",
                background: "var(--surface-bg)",
                color: "var(--ink)",
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "var(--navy)")}
              onBlur={(e) =>
                (e.currentTarget.style.borderColor = errors.title
                  ? "var(--clr-red)"
                  : "var(--line)")
              }
              placeholder="e.g. Q3 Product Redesign"
            />
            {errors.title && (
              <p className="text-[12px] font-medium" style={{ color: "var(--clr-red)" }}>
                {errors.title.message}
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
              placeholder="Optional project overview…"
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

          {/* Color swatch picker */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-semibold" style={{ color: "var(--ink)" }}>
              Color
            </label>
            <div className="flex gap-2 flex-wrap">
              {PROJECT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setValue("color", c)}
                  className="w-7 h-7 rounded-full border-2 transition-transform duration-100 hover:scale-110"
                  style={{
                    background: c,
                    borderColor: selectedColor === c ? "var(--ink)" : "transparent",
                  }}
                  aria-label={`Pick color ${c}`}
                />
              ))}
            </div>
          </div>

          {serverError && (
            <p className="text-[13px] font-medium px-3 py-2 rounded-lg" style={{ color: "var(--clr-red)", background: "var(--clr-red-bg)" }}>
              {serverError}
            </p>
          )}

          <DialogFooter className="mt-2">
            <button
              type="button"
              onClick={onClose}
              className="h-10 px-5 rounded-full text-[14px] font-semibold border transition-colors duration-150"
              style={{ borderColor: "var(--line)", color: "var(--text-secondary)", background: "transparent" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="h-10 px-6 rounded-full text-[14px] font-bold text-white flex items-center gap-2 transition-[box-shadow,opacity] duration-150 hover:shadow-[var(--shadow-needle)] disabled:opacity-50"
              style={{ background: "var(--navy)" }}
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? "Save changes" : "Create project"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
