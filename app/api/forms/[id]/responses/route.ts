import { type NextRequest } from "next/server";
import { withAdmin } from "@/lib/api/handler";
import { ok, ApiError } from "@/lib/api/response";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidUUID } from "@/lib/utils/validate";

// GET /api/forms/[id]/responses — raw response list (newest first), each
// with its answers joined and the subject's name resolved if applicable.
export const GET = withAdmin(async (_req: NextRequest, { params }) => {
  const formId = params?.id;
  if (!isValidUUID(formId)) return ApiError.badRequest("Invalid form id");

  const admin = createAdminClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: questions, error: qErr } = await (admin as any)
    .from("form_questions")
    .select("id, label, question_type, position")
    .eq("form_id", formId)
    .order("position", { ascending: true });
  if (qErr) { console.error("[forms/[id]/responses GET questions]", qErr); return ApiError.internal(); }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: responses, error } = await (admin as any)
    .from("form_responses")
    .select("id, subject_user_id, cadence, period_key, filler_name, filler_email, filler_phone, submitted_at, subject:profiles!subject_user_id(full_name)")
    .eq("form_id", formId)
    .order("submitted_at", { ascending: false })
    .limit(200);
  if (error) { console.error("[forms/[id]/responses GET]", error); return ApiError.internal(); }

  const responseIds = ((responses ?? []) as { id: string }[]).map((r) => r.id);
  if (responseIds.length === 0) return ok({ questions: questions ?? [], responses: [] });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: answers } = await (admin as any)
    .from("form_answers")
    .select("id, response_id, question_id, value_text, value_number, value_options, file_name")
    .in("response_id", responseIds);

  const answersByResponse = new Map<string, unknown[]>();
  for (const a of (answers ?? []) as { response_id: string }[]) {
    if (!answersByResponse.has(a.response_id)) answersByResponse.set(a.response_id, []);
    answersByResponse.get(a.response_id)!.push(a);
  }

  const result = ((responses ?? []) as { id: string; subject: { full_name: string | null } | null }[]).map((r) => ({
    ...r,
    subject_name: r.subject?.full_name ?? null,
    answers: answersByResponse.get(r.id) ?? [],
  }));

  return ok({ questions: questions ?? [], responses: result });
});
