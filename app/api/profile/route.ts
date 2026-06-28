import { type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { withAuth } from "@/lib/api/handler";
import { ok, ApiError } from "@/lib/api/response";

const updateProfileSchema = z.object({
  full_name: z.string().min(1, "Name is required").max(100, "Max 100 characters").optional(),
  avatar_url: z.string().url("Must be a valid URL").refine(
    (url) => {
      try {
        const u = new URL(url);
        return u.protocol === "https:" && (u.hostname.endsWith(".supabase.co") || u.hostname === "localhost");
      } catch { return false; }
    },
    { message: "Avatar URL must be a valid HTTPS Supabase storage URL" }
  ).nullable().optional(),
});

export const GET = withAuth(async (_req: NextRequest, { user }) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (await createClient() as any)
    .from("profiles")
    .select("id, full_name, avatar_url, email, created_at")
    .eq("id", user.id)
    .single();
  if (error) return ApiError.notFound("Profile not found");
  return ok(data);
});

export const PATCH = withAuth(async (req: NextRequest, { user }) => {
  let body: unknown;
  try { body = await req.json(); } catch { return ApiError.badRequest("Invalid JSON"); }

  const result = updateProfileSchema.safeParse(body);
  if (!result.success) {
    const msg = Object.values(result.error.flatten().fieldErrors).flat()[0] ?? "Validation failed";
    return ApiError.badRequest(msg);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (await createClient() as any)
    .from("profiles")
    .update({ ...result.data, updated_at: new Date().toISOString() })
    .eq("id", user.id);

  if (error) { console.error("[profile PATCH]", error); return ApiError.internal(); }
  return ok({ success: true });
});
