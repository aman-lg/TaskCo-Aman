import { type NextRequest } from "next/server";
import { withAdmin } from "@/lib/api/handler";
import { ok, ApiError } from "@/lib/api/response";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidUUID } from "@/lib/utils/validate";
import { updateFormSchema } from "@/lib/validations/forms";

// GET /api/forms/[id] — one form plus its questions, ordered for the builder
export const GET = withAdmin(async (_req: NextRequest, { params }) => {
  const id = params?.id;
  if (!isValidUUID(id)) return ApiError.badRequest("Invalid form id");

  const admin = createAdminClient();
  const [{ data: form, error: formErr }, { data: questions, error: qErr }] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin as any).from("forms").select("*").eq("id", id).maybeSingle(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin as any).from("form_questions").select("*").eq("form_id", id).order("position", { ascending: true }),
  ]);

  if (formErr) { console.error("[forms/[id] GET form]", formErr); return ApiError.internal(); }
  if (qErr) { console.error("[forms/[id] GET questions]", qErr); return ApiError.internal(); }
  if (!form) return ApiError.notFound("Form not found");

  return ok({ ...form, questions: questions ?? [] });
});

// PATCH /api/forms/[id] — update form metadata and/or toggle is_published
export const PATCH = withAdmin(async (req: NextRequest, { params }) => {
  const id = params?.id;
  if (!isValidUUID(id)) return ApiError.badRequest("Invalid form id");

  const body = await req.json().catch(() => null);
  const parsed = updateFormSchema.safeParse(body);
  if (!parsed.success) return ApiError.badRequest(parsed.error.issues[0].message);
  if (Object.keys(parsed.data).length === 0) return ApiError.badRequest("No fields to update");

  const admin = createAdminClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: current } = await (admin as any)
    .from("forms")
    .select("requires_login, has_rating_subject")
    .eq("id", id)
    .maybeSingle();
  if (!current) return ApiError.notFound("Form not found");

  const nextRequiresLogin = parsed.data.requires_login ?? current.requires_login;
  const nextHasRatingSubject = parsed.data.has_rating_subject ?? current.has_rating_subject;
  if (nextHasRatingSubject && !nextRequiresLogin) {
    return ApiError.badRequest("A rating-subject form must require login");
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any)
    .from("forms")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (error) { console.error("[forms/[id] PATCH]", error); return ApiError.internal(); }
  if (!data) return ApiError.notFound("Form not found");
  return ok(data);
});

// DELETE /api/forms/[id] — cascades to its questions/responses/answers via FK
export const DELETE = withAdmin(async (_req: NextRequest, { params }) => {
  const id = params?.id;
  if (!isValidUUID(id)) return ApiError.badRequest("Invalid form id");

  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any).from("forms").delete().eq("id", id);

  if (error) { console.error("[forms/[id] DELETE]", error); return ApiError.internal(); }
  return ok({ deleted: true });
});
