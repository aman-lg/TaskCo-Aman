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
import { createProjectSchema, type CreateProjectInput } from "@/lib/validations/projects";
import { cn } from "@/lib/utils";
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
  project?: Project;
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
      <DialogContent
        className="w-full max-w-[calc(100vw-2rem)] sm:max-w-[500px] p-0 gap-0 overflow-hidden"
        showCloseButton={false}
      >
        {/* ── Header ────────────────────────────────────────────── */}
        <DialogHeader className="flex flex-row items-center justify-between gap-3 px-6 py-4 border-b border-[var(--line)]">
          <DialogTitle className="h3 text-[var(--ink)]">
            {isEdit ? "Edit Project" : "New Project"}
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

              {/* Title */}
              <div className="float-label-wrap">
                <input
                  {...register("title")}
                  placeholder=" "
                  className={cn("float-label-input", errors.title && "error-state")}
                />
                <label className="float-label">
                  Project title <span className="text-[var(--clr-red)]">*</span>
                </label>
                {errors.title && (
                  <p className="mt-1 text-[11px] font-semibold text-[var(--clr-red)]">
                    {errors.title.message}
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

              {/* Colour picker */}
              <div className="flex flex-col gap-2">
                <p className="text-[10.5px] font-semibold text-[var(--text-muted)]" style={{ letterSpacing: "0.2px" }}>
                  Project colour
                </p>
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
                      aria-label={`Pick colour ${c}`}
                    />
                  ))}
                </div>
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
              {isEdit ? "Save changes" : "Create project"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
