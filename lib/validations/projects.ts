import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD");

export const createProjectSchema = z.object({
  title: z.string().min(1, "Title is required").max(100, "Max 100 characters"),
  description: z.string().max(500, "Max 500 characters").optional(),
  start_date: isoDate.optional().nullable(),
  end_date: isoDate.optional().nullable(),
  deadline: z.string().datetime({ offset: true }).optional().nullable(),
  urgency: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  status: z.enum(["active", "on_hold", "completed", "archived"]).default("active"),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Must be a valid hex color")
    .optional()
    .nullable(),
});

export const updateProjectSchema = z.object({
  title: z.string().min(1, "Title is required").max(100, "Max 100 characters").optional(),
  description: z.string().max(500, "Max 500 characters").optional(),
  start_date: isoDate.optional().nullable(),
  end_date: isoDate.optional().nullable(),
  deadline: z.string().datetime({ offset: true }).optional().nullable(),
  urgency: z.enum(["low", "medium", "high", "urgent"]).optional(),
  status: z.enum(["active", "on_hold", "completed", "archived"]).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Must be a valid hex color").optional().nullable(),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
