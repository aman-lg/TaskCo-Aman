import { z } from "zod";

export const addProjectLinkSchema = z.object({
  kind: z.literal("link"),
  name: z.string().min(1, "Name is required").max(200, "Max 200 characters"),
  url: z.string().url("Must be a valid URL"),
});

export type AddProjectLinkInput = z.infer<typeof addProjectLinkSchema>;
