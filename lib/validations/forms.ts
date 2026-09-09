import { z } from "zod";

export const formQuestionTypeSchema = z.enum(["text", "numeric", "single_select", "multi_select", "rating", "upload"]);
export const formCadenceSchema = z.enum(["one_time", "weekly", "monthly", "quarterly"]);

export const createFormSchema = z.object({
  title: z.string().min(1, "Title is required").max(150, "Max 150 characters"),
  description: z.string().max(2000, "Max 2000 characters").optional().nullable(),
  requires_login: z.boolean().default(true),
  has_rating_subject: z.boolean().default(false),
});

export const updateFormSchema = z.object({
  title: z.string().min(1, "Title is required").max(150, "Max 150 characters").optional(),
  description: z.string().max(2000, "Max 2000 characters").optional().nullable(),
  requires_login: z.boolean().optional(),
  has_rating_subject: z.boolean().optional(),
  is_published: z.boolean().optional(),
});

// Loosely typed — the API layer validates the shape it actually needs per
// question_type at answer-submission time, not here (a single static shape
// can't express "options required for select types, max_size_mb for upload,
// etc." cleanly).
const questionConfigSchema = z
  .object({
    options: z.array(z.string().min(1).max(200)).max(50).optional(),
    min: z.number().optional(),
    max: z.number().optional(),
    max_size_mb: z.number().positive().max(25).optional(),
    allowed_mime: z.array(z.string().max(100)).max(20).optional(),
  })
  .partial();

export const createQuestionSchema = z.object({
  label: z.string().min(1, "Label is required").max(300, "Max 300 characters"),
  question_type: formQuestionTypeSchema,
  config: questionConfigSchema.default({}),
  is_required: z.boolean().default(true),
  cadence: formCadenceSchema.optional().nullable(),
});

export const updateQuestionSchema = z.object({
  label: z.string().min(1, "Label is required").max(300, "Max 300 characters").optional(),
  question_type: formQuestionTypeSchema.optional(),
  config: questionConfigSchema.optional(),
  is_required: z.boolean().optional(),
  cadence: formCadenceSchema.optional().nullable(),
  position: z.number().int().optional(),
});

export const uploadedFileRefSchema = z.object({
  file_storage_path: z.string().min(1),
  file_name: z.string().min(1).max(255),
  file_size: z.number().int().positive(),
  file_mime: z.string().max(255).nullable().optional(),
});

export const submitAnswerSchema = z.object({
  question_id: z.string().uuid(),
  value_text: z.string().max(5000, "Max 5000 characters").optional().nullable(),
  value_number: z.number().optional().nullable(),
  value_options: z.array(z.string().max(200)).max(50).optional().nullable(),
  file: uploadedFileRefSchema.optional().nullable(),
});

// filler_name/filler_email are NOT required here even though every response
// ends up with them — for a logged-in filler they're overridden from their
// profile server-side, so the client never even collects them; only the
// no-login path actually needs the "is it present and well-formed" check,
// enforced in the submit route itself once it knows whether a user is present.
export const submitResponseSchema = z.object({
  subject_user_id: z.string().uuid().optional().nullable(),
  cadence: formCadenceSchema.optional().nullable(),
  filler_name: z.string().max(150, "Max 150 characters").optional(),
  filler_email: z.string().max(255, "Max 255 characters").optional(),
  filler_phone: z.string().max(30, "Max 30 characters").optional().nullable(),
  answers: z.array(submitAnswerSchema).max(200),
});

export type FormQuestionType = z.infer<typeof formQuestionTypeSchema>;
export type FormCadence = z.infer<typeof formCadenceSchema>;
export type CreateFormInput = z.infer<typeof createFormSchema>;
export type UpdateFormInput = z.infer<typeof updateFormSchema>;
export type CreateQuestionInput = z.infer<typeof createQuestionSchema>;
export type UpdateQuestionInput = z.infer<typeof updateQuestionSchema>;
export type SubmitResponseInput = z.infer<typeof submitResponseSchema>;
