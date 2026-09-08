import { z } from "zod";

export const worklogPresenceTypeSchema = z.enum(["wfh", "wfo", "leave_full", "leave_half"]);

export const markWorklogSchema = z.object({
  presence_type: worklogPresenceTypeSchema,
  notes: z.string().max(1000, "Max 1000 characters").optional().nullable(),
});

export type WorklogPresenceType = z.infer<typeof worklogPresenceTypeSchema>;
export type MarkWorklogInput = z.infer<typeof markWorklogSchema>;
