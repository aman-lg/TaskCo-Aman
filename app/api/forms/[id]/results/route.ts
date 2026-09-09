import { type NextRequest } from "next/server";
import { withAdmin } from "@/lib/api/handler";
import { ok, ApiError } from "@/lib/api/response";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidUUID } from "@/lib/utils/validate";
import { computePeriodKey, monthKeyForWeekKey, monthKeysInQuarter } from "@/lib/utils/form-periods";

const QUARTER_RE = /^\d{4}-Q[1-4]$/;

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

// GET /api/forms/[id]/results?subject_user_id=&quarter=YYYY-Q# — live-computed
// weekly -> monthly -> quarterly rollup for every rating/numeric question
// tagged with a cadence, for one subject. No cron, no cached tables — always
// reflects whatever responses exist right now.
export const GET = withAdmin(async (req: NextRequest, { params }) => {
  const formId = params?.id;
  if (!isValidUUID(formId)) return ApiError.badRequest("Invalid form id");

  const subjectUserId = req.nextUrl.searchParams.get("subject_user_id");
  if (!isValidUUID(subjectUserId)) return ApiError.badRequest("Invalid subject_user_id");

  const quarterParam = req.nextUrl.searchParams.get("quarter");
  const quarter = quarterParam && QUARTER_RE.test(quarterParam) ? quarterParam : computePeriodKey("quarterly");
  const monthKeys = monthKeysInQuarter(quarter);

  const admin = createAdminClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: questionRows, error: qErr } = await (admin as any)
    .from("form_questions")
    .select("id, label, question_type, cadence")
    .eq("form_id", formId)
    .in("question_type", ["numeric", "rating"])
    .in("cadence", ["weekly", "monthly", "quarterly"]);
  if (qErr) { console.error("[forms/[id]/results questions]", qErr); return ApiError.internal(); }

  const questions = (questionRows ?? []) as { id: string; label: string; question_type: string; cadence: "weekly" | "monthly" | "quarterly" }[];
  if (questions.length === 0) return ok({ subject_user_id: subjectUserId, quarter, questions: [] });

  const questionIds = questions.map((q) => q.id);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: allResponses } = await (admin as any)
    .from("form_responses")
    .select("id, cadence, period_key")
    .eq("form_id", formId)
    .eq("subject_user_id", subjectUserId)
    .in("cadence", ["weekly", "monthly", "quarterly"]);

  type ResponseRow = { id: string; cadence: "weekly" | "monthly" | "quarterly"; period_key: string };
  const responses = (allResponses ?? []) as ResponseRow[];

  // Only the responses relevant to this quarter: weekly ones whose week
  // falls in one of the quarter's months, monthly ones in those months,
  // quarterly ones matching the quarter key directly.
  const relevantResponses = responses.filter((r) => {
    if (r.cadence === "weekly") return monthKeys.includes(monthKeyForWeekKey(r.period_key));
    if (r.cadence === "monthly") return monthKeys.includes(r.period_key);
    return r.period_key === quarter;
  });
  const responseIds = relevantResponses.map((r) => r.id);
  const responseById = new Map(relevantResponses.map((r) => [r.id, r]));

  type AnswerRow = { response_id: string; question_id: string; value_number: number | null };
  let answerRows: AnswerRow[] = [];
  if (responseIds.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (admin as any)
      .from("form_answers")
      .select("response_id, question_id, value_number")
      .in("response_id", responseIds)
      .in("question_id", questionIds);
    answerRows = data ?? [];
  }

  const results = questions.map((q) => {
    const answersForQuestion = answerRows.filter((a) => a.question_id === q.id && a.value_number !== null);

    const weekly: Record<string, number> = {};
    const monthly: Record<string, number> = {};
    let quarterly: number | null = null;

    if (q.cadence === "weekly") {
      const byMonth = new Map<string, number[]>();
      for (const a of answersForQuestion) {
        const r = responseById.get(a.response_id);
        if (!r || r.cadence !== "weekly") continue;
        weekly[r.period_key] = a.value_number!;
        const monthKey = monthKeyForWeekKey(r.period_key);
        if (!byMonth.has(monthKey)) byMonth.set(monthKey, []);
        byMonth.get(monthKey)!.push(a.value_number!);
      }
      for (const monthKey of monthKeys) {
        const avg = average(byMonth.get(monthKey) ?? []);
        if (avg !== null) monthly[monthKey] = avg;
      }
      quarterly = average(Object.values(monthly));
    } else if (q.cadence === "monthly") {
      for (const a of answersForQuestion) {
        const r = responseById.get(a.response_id);
        if (!r || r.cadence !== "monthly") continue;
        monthly[r.period_key] = a.value_number!;
      }
      quarterly = average(Object.values(monthly));
    } else {
      const match = answersForQuestion.find((a) => {
        const r = responseById.get(a.response_id);
        return r && r.cadence === "quarterly" && r.period_key === quarter;
      });
      quarterly = match?.value_number ?? null;
    }

    return { question_id: q.id, label: q.label, cadence: q.cadence, weekly, monthly, quarterly };
  });

  return ok({ subject_user_id: subjectUserId, quarter, questions: results });
});
