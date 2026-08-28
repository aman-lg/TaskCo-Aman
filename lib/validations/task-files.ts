import { z } from "zod";

export const addTaskLinkSchema = z.object({
  kind: z.literal("link"),
  name: z.string().min(1, "Name is required").max(200, "Max 200 characters"),
  url: z.string().url("Must be a valid URL"),
  mime: z.string().max(200).optional(),
  size: z.number().int().nonnegative().optional(),
});

export type AddTaskLinkInput = z.infer<typeof addTaskLinkSchema>;
