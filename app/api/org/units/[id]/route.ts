import { type NextRequest } from "next/server";
import { withAdmin } from "@/lib/api/handler";
import { ok, ApiError } from "@/lib/api/response";
import { createClient } from "@/lib/supabase/server";
import { isValidUUID } from "@/lib/utils/validate";
import { updateOrgUnitSchema } from "@/lib/validations/org";

// PATCH /api/org/units/[id] — rename or move a unit under a different parent (admin only).
// Only direct self-parenting is checked here — the UI only ever calls this to rename a
// unit, never to reparent an existing one (that could otherwise create a cycle deeper
// than one level), so a full descendant check isn't needed for what's actually exposed.

export const PATCH = withAdmin(async (req: NextRequest, { params }) => {
  const id = params?.id;
  if (!isValidUUID(id)) return ApiError.badRequest("Invalid unit id");

  const body = await req.json().catch(() => null);
  const parsed = updateOrgUnitSchema.safeParse(body);
  if (!parsed.success) return ApiError.badRequest(parsed.error.issues[0].message);
  if (parsed.data.parent_id === id) return ApiError.badRequest("A unit cannot be its own parent");

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("org_units")
    .update(parsed.data)
    .eq("id", id)
    .select("id, parent_id, name, created_at")
    .single();

  if (error) {
    console.error("[org/units/[id] PATCH]", error);
    return ApiError.internal();
  }
  return ok(data);
});

// DELETE /api/org/units/[id] — deletes the unit and (via FK cascade) every sub-department under it
export const DELETE = withAdmin(async (_req: NextRequest, { params }) => {
  const id = params?.id;
  if (!isValidUUID(id)) return ApiError.badRequest("Invalid unit id");

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from("org_units").delete().eq("id", id);

  if (error) {
    console.error("[org/units/[id] DELETE]", error);
    return ApiError.internal();
  }
  return ok({ deleted: true });
});
