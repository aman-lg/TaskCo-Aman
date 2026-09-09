import { type NextRequest } from "next/server";
import { withAdmin } from "@/lib/api/handler";
import { ok, ApiError } from "@/lib/api/response";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidUUID } from "@/lib/utils/validate";
import { createQuestionSchema } from "@/lib/validations/forms";

// POST /api/forms/[id]/questions — append a question to the end of the form
export const POST = withAdmin(async (req: NextRequest, { params }) => {
  const formId = params?.id;
  if (!isValidUUID(formId)) return ApiError.badRequest("Invalid form id");

  const body = await req.json().catch(() => null);
  const parsed = createQuestionSchema.safeParse(body);
  if (!parsed.success) return ApiError.badRequest(parsed.error.issues[0].message);

  if ((parsed.data.question_type === "single_select" || parsed.data.question_type === "multi_select")
    && (!parsed.data.config.options || parsed.data.config.options.length === 0)) {
    return ApiError.badRequest("Select questions need at least one option");
  }

  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (admin as any)
    .from("form_questions")
    .select("position")
    .eq("form_id", formId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextPosition = (existing?.position ?? -1) + 1;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any)
    .from("form_questions")
    .insert({
      form_id: formId,
      position: nextPosition,
      label: parsed.data.label,
      question_type: parsed.data.question_type,
      config: parsed.data.config,
      is_required: parsed.data.is_required,
      cadence: parsed.data.cadence ?? null,
      page_break_before: parsed.data.page_break_before,
    })
    .select("*")
    .single();

  if (error) { console.error("[forms/[id]/questions POST]", error); return ApiError.internal(); }
  return ok(data, 201);
});
