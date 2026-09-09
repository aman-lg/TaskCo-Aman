import { type NextRequest } from "next/server";
import { withAuth } from "@/lib/api/handler";
import { ok, ApiError } from "@/lib/api/response";
import { createClient } from "@/lib/supabase/server";
import { isValidUUID } from "@/lib/utils/validate";
import { getMyLedUnitMembers } from "@/lib/queries/org";

// GET /api/forms/[id]/subjects — who the current user can pick as the
// "who are you rating" subject: everyone in a unit where they're a
// lead/facilitator. Any authenticated user can call this for themselves —
// someone who leads nothing just gets an empty list, no special gate needed.
export const GET = withAuth(async (_req: NextRequest, { user, params }) => {
  const formId = params?.id;
  if (!isValidUUID(formId)) return ApiError.badRequest("Invalid form id");

  const supabase = await createClient();
  const people = await getMyLedUnitMembers(supabase, user.id);
  return ok(people);
});
