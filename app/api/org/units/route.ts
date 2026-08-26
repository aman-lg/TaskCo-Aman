import { type NextRequest } from "next/server";
import { withAuth, withAdmin } from "@/lib/api/handler";
import { ok, ApiError } from "@/lib/api/response";
import { createClient } from "@/lib/supabase/server";
import { createOrgUnitSchema } from "@/lib/validations/org";

// GET /api/org/units — every unit, flat (with its members embedded), for the client to build the tree
export const GET = withAuth(async (_req: NextRequest) => {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("org_units")
    .select(`
      id, parent_id, name, created_at,
      members:org_unit_members(user_id, title, added_at, profile:profiles!user_id(id, full_name, avatar_url, email))
    `)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[org/units GET]", error);
    return ApiError.internal();
  }
  return ok(data ?? []);
});

// POST /api/org/units — create a department or sub-department (admin only)
export const POST = withAdmin(async (req: NextRequest, { user }) => {
  const body = await req.json().catch(() => null);
  const parsed = createOrgUnitSchema.safeParse(body);
  if (!parsed.success) return ApiError.badRequest(parsed.error.issues[0].message);

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("org_units")
    .insert({ name: parsed.data.name, parent_id: parsed.data.parent_id ?? null, created_by: user.id })
    .select("id, parent_id, name, created_at")
    .single();

  if (error) {
    console.error("[org/units POST]", error);
    return ApiError.internal();
  }
  return ok({ ...data, members: [] }, 201);
});
