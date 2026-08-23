import { z } from "zod";

export const createBookingSchema = z.object({
  requester_name: z.string().min(1, "Name is required").max(200, "Max 200 characters"),
  requester_email: z.string().email("Must be a valid email"),
  // Additional invitees beyond the primary requester — capped at 9 (10 total
  // attendees including the requester) to keep Google Calendar invites sane.
  participant_emails: z.array(z.string().email("Must be a valid email")).max(9).optional(),
  note: z.string().max(1000, "Max 1000 characters").optional().nullable(),
  start_at: z.string().datetime({ offset: true, message: "Must be a valid ISO datetime" }),
  end_at: z.string().datetime({ offset: true, message: "Must be a valid ISO datetime" }),
});

export type CreateBookingInput = z.infer<typeof createBookingSchema>;

export const directBookingSchema = z.object({
  requester_name: z.string().min(1, "Name is required").max(200, "Max 200 characters"),
  requester_email: z.string().email("Must be a valid email"),
  participant_emails: z.array(z.string().email("Must be a valid email")).max(9).optional(),
  note: z.string().max(1000, "Max 1000 characters").optional().nullable(),
  start_at: z.string().datetime({ offset: true, message: "Must be a valid ISO datetime" }),
  end_at: z.string().datetime({ offset: true, message: "Must be a valid ISO datetime" }),
});

export type DirectBookingInput = z.infer<typeof directBookingSchema>;
