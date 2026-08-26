import { type NextRequest } from "next/server";
import { withAuth, withAdmin } from "@/lib/api/handler";
import { ok, ApiError } from "@/lib/api/response";
import { createClient } from "@/lib/supabase/server";
import { updateOrgSettingsSchema } from "@/lib/validations/org";

// GET /api/org/settings — visible to every authenticated user (it's the company's own structure)
export const GET = withAuth(async (_req: NextRequest) => {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("org_settings")
    .select("name, updated_at")
    .eq("id", true)
    .single();

  if (error) {
    console.error("[org/settings GET]", error);
    return ApiError.internal();
  }
  return ok(data);
});

// PATCH /api/org/settings — rename the organization, admin only
export const PATCH = withAdmin(async (req: NextRequest, { user }) => {
  const body = await req.json().catch(() => null);
  const parsed = updateOrgSettingsSchema.safeParse(body);
  if (!parsed.success) return ApiError.badRequest(parsed.error.issues[0].message);

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("org_settings")
    .update({ name: parsed.data.name, updated_by: user.id, updated_at: new Date().toISOString() })
    .eq("id", true)
    .select("name, updated_at")
    .single();

  if (error) {
    console.error("[org/settings PATCH]", error);
    return ApiError.internal();
  }
  return ok(data);
});
