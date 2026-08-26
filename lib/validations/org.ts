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

export const unitRoleSchema = z.enum(["lead", "facilitator", "member"]);

export const addOrgUnitMemberSchema = z.object({
  user_id: z.string().uuid("Invalid user ID"),
  title: z.string().max(100, "Max 100 characters").optional().nullable(),
  unit_role: unitRoleSchema.optional(),
});

export const updateOrgUnitMemberSchema = z.object({
  user_id: z.string().uuid("Invalid user ID"),
  unit_role: unitRoleSchema,
});

export type UpdateOrgSettingsInput = z.infer<typeof updateOrgSettingsSchema>;
export type CreateOrgUnitInput = z.infer<typeof createOrgUnitSchema>;
export type UpdateOrgUnitInput = z.infer<typeof updateOrgUnitSchema>;
export type AddOrgUnitMemberInput = z.infer<typeof addOrgUnitMemberSchema>;
export type UpdateOrgUnitMemberInput = z.infer<typeof updateOrgUnitMemberSchema>;
