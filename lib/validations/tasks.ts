import { z } from "zod";

export const createTaskSchema = z.object({
  project_id: z.string().uuid("Must be a valid project ID"),
  name: z.string().min(1, "Task name is required").max(200, "Max 200 characters"),
  description: z.string().max(2000, "Max 2000 characters").optional().nullable(),
  start_date: z.string().datetime({ offset: true }).optional().nullable(),
  end_date: z.string().datetime({ offset: true }).optional().nullable(),
  deadline: z.string().datetime({ offset: true }).optional().nullable(),
  urgency: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  status: z.enum(["todo", "in_progress", "done"]).default("todo"),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Must be a valid hex color")
    .optional()
    .nullable(),
});

// project_id is not changeable after creation; no defaults applied (empty body → 400)
export const updateTaskSchema = z.object({
  name: z.string().min(1, "Task name is required").max(200, "Max 200 characters").optional(),
  description: z.string().max(2000, "Max 2000 characters").optional().nullable(),
  start_date: z.string().datetime({ offset: true }).optional().nullable(),
  end_date: z.string().datetime({ offset: true }).optional().nullable(),
  deadline: z.string().datetime({ offset: true }).optional().nullable(),
  urgency: z.enum(["low", "medium", "high", "urgent"]).optional(),
  status: z.enum(["todo", "in_progress", "done"]).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Must be a valid hex color").optional().nullable(),
});

export const assignTaskSchema = z.object({
  user_id: z.string().uuid("Must be a valid user ID"),
});

export const createChecklistItemSchema = z.object({
  content: z.string().min(1, "Content is required").max(500, "Max 500 characters"),
  position: z.number().int().min(0).optional(),
});

export const updateChecklistItemSchema = z.object({
  content: z.string().min(1).max(500).optional(),
  is_done: z.boolean().optional(),
  position: z.number().int().min(0).optional(),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type AssignTaskInput = z.infer<typeof assignTaskSchema>;
export type CreateChecklistItemInput = z.infer<typeof createChecklistItemSchema>;
export type UpdateChecklistItemInput = z.infer<typeof updateChecklistItemSchema>;
