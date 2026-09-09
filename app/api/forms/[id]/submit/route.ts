import { type NextRequest } from "next/server";
import { ApiError, ok } from "@/lib/api/response";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthUser } from "@/lib/supabase/server";
import { isValidUUID } from "@/lib/utils/validate";
import { submitResponseSchema, type SubmitResponseInput } from "@/lib/validations/forms";
import { computePeriodKey } from "@/lib/utils/form-periods";
import { getMyLedUnitMembers } from "@/lib/queries/org";

type Cadence = "one_time" | "weekly" | "monthly" | "quarterly";
type PeriodCadence = "weekly" | "monthly" | "quarterly";

interface QuestionRow {
  id: string;
  label: string;
  question_type: "text" | "numeric" | "single_select" | "multi_select" | "rating" | "upload";
  config: { options?: string[]; min?: number; max?: number; max_size_mb?: number; allowed_mime?: string[] };
  is_required: boolean;
  cadence: Cadence | null;
}

type SubmitAnswer = SubmitResponseInput["answers"][number];

function validateAnswer(q: QuestionRow, answer: SubmitAnswer | undefined): string | null {
  const hasValue = !!answer && (
    (!!answer.value_text && answer.value_text.length > 0) ||
    (answer.value_number !== undefined && answer.value_number !== null) ||
    (!!answer.value_options && answer.value_options.length > 0) ||
    !!answer.file
  );
  if (q.is_required && !hasValue) return "This question is required";
  if (!hasValue) return null;

  switch (q.question_type) {
    case "numeric":
    case "rating": {
      const n = answer!.value_number;
      if (typeof n !== "number") return "Expected a number";
      const min = q.question_type === "rating" ? 1 : q.config.min;
      const max = q.question_type === "rating" ? (q.config.max ?? 5) : q.config.max;
      if (min !== undefined && n < min) return `Must be at least ${min}`;
      if (max !== undefined && n > max) return `Must be at most ${max}`;
      return null;
    }
    case "single_select": {
      const opts = answer!.value_options;
      if (!opts || opts.length !== 1) return "Select exactly one option";
      if (q.config.options && !q.config.options.includes(opts[0])) return "Invalid option";
      return null;
    }
    case "multi_select": {
      const opts = answer!.value_options;
      if (!opts || opts.length === 0) return "Select at least one option";
      if (q.config.options && opts.some((o) => !q.config.options!.includes(o))) return "Invalid option";
      return null;
    }
    case "upload":
      if (!answer!.file) return "A file is required";
      return null;
    default:
      return null;
  }
}

// POST /api/forms/[id]/submit — not wrapped in withAuth: a no-login form
// must accept an anonymous visitor, same as app/api/booking/[slug]/route.ts.
// Does its own optional-auth check based on the form's own requires_login.
export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id: formId } = await context.params;
  if (!isValidUUID(formId)) return ApiError.badRequest("Invalid form id");

  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: form } = await (admin as any).from("forms").select("*").eq("id", formId).maybeSingle();
  if (!form || !form.is_published) return ApiError.notFound("Form not found");

  const { data: { user } } = await getAuthUser();
  if (form.requires_login && !user) return ApiError.unauthorized();

  const body = await req.json().catch(() => null);
  const parsed = submitResponseSchema.safeParse(body);
  if (!parsed.success) return ApiError.badRequest(parsed.error.issues[0].message);

  // Logged-in fillers' identity always comes from their own profile — never
  // from client-sent fields — so a submission can't be spoofed as someone
  // else. The no-login path is the only one that actually needs these from
  // the client, so that's the only path that validates them.
  let fillerName = parsed.data.filler_name;
  let fillerEmail = parsed.data.filler_email;
  let fillerPhone = parsed.data.filler_phone ?? null;
  if (user) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: profile } = await (admin as any).from("profiles").select("full_name, email, phone").eq("id", user.id).single();
    fillerName = profile?.full_name || fillerName;
    fillerEmail = profile?.email || fillerEmail;
    fillerPhone = profile?.phone ?? fillerPhone;
  } else {
    if (!fillerName?.trim()) return ApiError.badRequest("Name is required");
    if (!fillerEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fillerEmail)) return ApiError.badRequest("A valid email is required");
  }

  let subjectUserId: string | null = null;
  if (form.has_rating_subject) {
    if (!user) return ApiError.unauthorized();
    if (!parsed.data.subject_user_id) return ApiError.badRequest("Please select who you're rating");
    const led = await getMyLedUnitMembers(admin, user.id);
    if (!led.some((p) => p.id === parsed.data.subject_user_id)) {
      return ApiError.forbidden("You can only rate people on your team");
    }
    subjectUserId = parsed.data.subject_user_id;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: questionRows } = await (admin as any).from("form_questions").select("*").eq("form_id", formId);
  const allQuestions = (questionRows ?? []) as QuestionRow[];

  const cadenceTabs = Array.from(
    new Set(allQuestions.map((q) => q.cadence).filter((c): c is PeriodCadence => c === "weekly" || c === "monthly" || c === "quarterly"))
  );

  let cadence: PeriodCadence | null = null;
  if (cadenceTabs.length > 0) {
    if (!parsed.data.cadence || !cadenceTabs.includes(parsed.data.cadence as PeriodCadence)) {
      return ApiError.badRequest(`cadence must be one of: ${cadenceTabs.join(", ")}`);
    }
    cadence = parsed.data.cadence as PeriodCadence;
  }

  // Which one_time questions has this subject (or this anonymous-form
  // stream) already answered — shown once ever, never again.
  const oneTimeQuestionIds = allQuestions.filter((q) => q.cadence === "one_time").map((q) => q.id);
  const answeredOneTimeIds = new Set<string>();
  if (oneTimeQuestionIds.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let respQuery = (admin as any).from("form_responses").select("id").eq("form_id", formId);
    respQuery = subjectUserId ? respQuery.eq("subject_user_id", subjectUserId) : respQuery.is("subject_user_id", null);
    const { data: priorResponses } = await respQuery;
    const priorResponseIds = ((priorResponses ?? []) as { id: string }[]).map((r) => r.id);
    if (priorResponseIds.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: priorAnswers } = await (admin as any)
        .from("form_answers")
        .select("question_id")
        .in("response_id", priorResponseIds)
        .in("question_id", oneTimeQuestionIds);
      for (const a of (priorAnswers ?? []) as { question_id: string }[]) answeredOneTimeIds.add(a.question_id);
    }
  }

  const activeQuestions = allQuestions.filter((q) =>
    q.cadence === null ||
    (cadence !== null && q.cadence === cadence) ||
    (q.cadence === "one_time" && !answeredOneTimeIds.has(q.id))
  );

  const answerByQuestionId = new Map(parsed.data.answers.map((a) => [a.question_id, a]));

  for (const q of activeQuestions) {
    const err = validateAnswer(q, answerByQuestionId.get(q.id));
    if (err) return ApiError.badRequest(`"${q.label}": ${err}`);
  }

  const periodKey = cadence ? computePeriodKey(cadence) : null;
  const nowIso = new Date().toISOString();

  let responseId: string;
  if (subjectUserId && cadence) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: resp, error } = await (admin as any)
      .from("form_responses")
      .upsert(
        {
          form_id: formId, subject_user_id: subjectUserId, cadence, period_key: periodKey,
          filler_user_id: user?.id ?? null, filler_name: fillerName, filler_email: fillerEmail, filler_phone: fillerPhone,
          submitted_at: nowIso,
        },
        { onConflict: "form_id,subject_user_id,cadence,period_key" }
      )
      .select("id")
      .single();
    if (error) { console.error("[forms/submit] upsert response", error); return ApiError.internal(); }
    responseId = resp.id;
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: resp, error } = await (admin as any)
      .from("form_responses")
      .insert({
        form_id: formId, subject_user_id: subjectUserId, cadence, period_key: periodKey,
        filler_user_id: user?.id ?? null, filler_name: fillerName, filler_email: fillerEmail, filler_phone: fillerPhone,
      })
      .select("id")
      .single();
    if (error) { console.error("[forms/submit] insert response", error); return ApiError.internal(); }
    responseId = resp.id;
  }

  const answerRows = activeQuestions.map((q) => {
    const a = answerByQuestionId.get(q.id);
    return {
      response_id: responseId,
      question_id: q.id,
      value_text: q.question_type === "text" ? (a?.value_text ?? null) : null,
      value_number: (q.question_type === "numeric" || q.question_type === "rating") ? (a?.value_number ?? null) : null,
      value_options: (q.question_type === "single_select" || q.question_type === "multi_select") ? (a?.value_options ?? null) : null,
      file_storage_path: q.question_type === "upload" ? (a?.file?.file_storage_path ?? null) : null,
      file_name: q.question_type === "upload" ? (a?.file?.file_name ?? null) : null,
      file_size: q.question_type === "upload" ? (a?.file?.file_size ?? null) : null,
      file_mime: q.question_type === "upload" ? (a?.file?.file_mime ?? null) : null,
    };
  });

  if (answerRows.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (admin as any).from("form_answers").upsert(answerRows, { onConflict: "response_id,question_id" });
    if (error) { console.error("[forms/submit] upsert answers", error); return ApiError.internal(); }
  }

  return ok({ response_id: responseId }, 201);
}
