import { z } from "zod";

export const updateOrgSettingsSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Max 100 characters"),
});

export const createOrgUnitSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Max 100 characters"),
  parent_id: z.string().uuid("Invalid parent unit").nullable().optional(),
});

export const updateOrgUnitSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Max 100 characters").optional(),
  parent_id: z.string().uuid("Invalid parent unit").nullable().optional(),
});

export const addOrgUnitMemberSchema = z.object({
  user_id: z.string().uuid("Invalid user ID"),
  title: z.string().max(100, "Max 100 characters").optional().nullable(),
});

export type UpdateOrgSettingsInput = z.infer<typeof updateOrgSettingsSchema>;
export type CreateOrgUnitInput = z.infer<typeof createOrgUnitSchema>;
export type UpdateOrgUnitInput = z.infer<typeof updateOrgUnitSchema>;
export type AddOrgUnitMemberInput = z.infer<typeof addOrgUnitMemberSchema>;
