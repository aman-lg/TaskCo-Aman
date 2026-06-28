import { type NextRequest } from "next/server";
import { z } from "zod";
import { withAdmin } from "@/lib/api/handler";
import { ok, ApiError } from "@/lib/api/response";
import { createAdminClient } from "@/lib/supabase/admin";

const inviteSchema = z.object({
  email: z.string().email().transform(v => v.toLowerCase()),
});

export const POST = withAdmin(async (req: NextRequest) => {
  const body = await req.json().catch(() => null);
  const parsed = inviteSchema.safeParse(body);
  if (!parsed.success) return ApiError.badRequest(parsed.error.issues[0].message);

  const adminClient = createAdminClient();
  const { data, error } = await adminClient.auth.admin.inviteUserByEmail(parsed.data.email);

  if (error) {
    console.error("[admin/invite POST]", error);
    if (error.message?.toLowerCase().includes("already been registered")) {
      return ApiError.badRequest("A user with this email already exists.");
    }
    return ApiError.internal();
  }

  return ok({ id: data.user.id, email: data.user.email });
});
