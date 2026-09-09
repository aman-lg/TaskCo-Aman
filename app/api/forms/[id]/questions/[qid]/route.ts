import { type NextRequest } from "next/server";
import { withAdmin } from "@/lib/api/handler";
import { ok, ApiError } from "@/lib/api/response";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidUUID } from "@/lib/utils/validate";
import { updateQuestionSchema } from "@/lib/validations/forms";

// PATCH /api/forms/[id]/questions/[qid] — edit a question's label/type/config/
// cadence/required flag, and/or its position (used by the builder's up/down move)
export const PATCH = withAdmin(async (req: NextRequest, { params }) => {
  const formId = params?.id;
  const qid = params?.qid;
  if (!isValidUUID(formId) || !isValidUUID(qid)) return ApiError.badRequest("Invalid id");

  const body = await req.json().catch(() => null);
  const parsed = updateQuestionSchema.safeParse(body);
  if (!parsed.success) return ApiError.badRequest(parsed.error.issues[0].message);
  if (Object.keys(parsed.data).length === 0) return ApiError.badRequest("No fields to update");

  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any)
    .from("form_questions")
    .update(parsed.data)
    .eq("id", qid)
    .eq("form_id", formId)
    .select("*")
    .maybeSingle();

  if (error) { console.error("[forms/[id]/questions/[qid] PATCH]", error); return ApiError.internal(); }
  if (!data) return ApiError.notFound("Question not found");
  return ok(data);
});

// DELETE /api/forms/[id]/questions/[qid]
export const DELETE = withAdmin(async (_req: NextRequest, { params }) => {
  const formId = params?.id;
  const qid = params?.qid;
  if (!isValidUUID(formId) || !isValidUUID(qid)) return ApiError.badRequest("Invalid id");

  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any).from("form_questions").delete().eq("id", qid).eq("form_id", formId);

  if (error) { console.error("[forms/[id]/questions/[qid] DELETE]", error); return ApiError.internal(); }
  return ok({ deleted: true });
});
