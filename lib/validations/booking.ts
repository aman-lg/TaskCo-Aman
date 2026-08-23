import { z } from "zod";

export const createBookingSchema = z.object({
  requester_name: z.string().min(1, "Name is required").max(200, "Max 200 characters"),
  requester_email: z.string().email("Must be a valid email"),
  note: z.string().max(1000, "Max 1000 characters").optional().nullable(),
  start_at: z.string().datetime({ offset: true, message: "Must be a valid ISO datetime" }),
  end_at: z.string().datetime({ offset: true, message: "Must be a valid ISO datetime" }),
});

export type CreateBookingInput = z.infer<typeof createBookingSchema>;
