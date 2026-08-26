import { type NextRequest } from "next/server";
import { withAdmin } from "@/lib/api/handler";
import { ok, ApiError } from "@/lib/api/response";
import { createClient } from "@/lib/supabase/server";
import { isValidUUID } from "@/lib/utils/validate";
import { addOrgUnitMemberSchema } from "@/lib/validations/org";

// POST /api/org/units/[id]/members — place a team member into this unit (admin only)
export const POST = withAdmin(async (req: NextRequest, { user, params }) => {
  const unitId = params?.id;
  if (!isValidUUID(unitId)) return ApiError.badRequest("Invalid unit id");

  const body = await req.json().catch(() => null);
  const parsed = addOrgUnitMemberSchema.safeParse(body);
  if (!parsed.success) return ApiError.badRequest(parsed.error.issues[0].message);

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("org_unit_members")
    .insert({ unit_id: unitId, user_id: parsed.data.user_id, title: parsed.data.title ?? null, added_by: user.id })
    .select("user_id, title, added_at, profile:profiles!user_id(id, full_name, avatar_url, email)")
    .single();

  if (error) {
    console.error("[org/units/[id]/members POST]", error);
    if (error.code === "23505") return ApiError.badRequest("This person is already in that department.");
    return ApiError.internal();
  }
  return ok(data, 201);
});

// DELETE /api/org/units/[id]/members?user_id=... — remove a member from this unit (admin only)
export const DELETE = withAdmin(async (req: NextRequest, { params }) => {
  const unitId = params?.id;
  if (!isValidUUID(unitId)) return ApiError.badRequest("Invalid unit id");

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("user_id");
  if (!userId || !isValidUUID(userId)) return ApiError.badRequest("Invalid user_id param");

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("org_unit_members")
    .delete()
    .eq("unit_id", unitId)
    .eq("user_id", userId);

  if (error) {
    console.error("[org/units/[id]/members DELETE]", error);
    return ApiError.internal();
  }
  return ok({ removed: true });
});
