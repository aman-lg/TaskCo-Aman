import { type NextRequest } from "next/server";
import { withAdmin } from "@/lib/api/handler";
import { ok, ApiError } from "@/lib/api/response";
import { createAdminClient } from "@/lib/supabase/admin";
import { createFormSchema } from "@/lib/validations/forms";

function slugify(title: string): string {
  return title.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-+|-+$)/g, "") || "form";
}

// GET /api/forms — every form, newest first (admin only; forms/form_questions
// have zero client RLS policies, so even admin routes go through the
// service-role client, same as youtube_connections).
export const GET = withAdmin(async () => {
  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any)
    .from("forms")
    .select("id, title, slug, description, requires_login, has_rating_subject, is_published, created_at")
    .order("created_at", { ascending: false });

  if (error) { console.error("[forms GET]", error); return ApiError.internal(); }
  return ok(data ?? []);
});

// POST /api/forms — create a new (draft, unpublished) form
export const POST = withAdmin(async (req: NextRequest, { user }) => {
  const body = await req.json().catch(() => null);
  const parsed = createFormSchema.safeParse(body);
  if (!parsed.success) return ApiError.badRequest(parsed.error.issues[0].message);
  if (parsed.data.has_rating_subject && !parsed.data.requires_login) {
    return ApiError.badRequest("A rating-subject form must require login");
  }

  const admin = createAdminClient();
  const base = slugify(parsed.data.title);

  let lastError: { code?: string; message: string } | null = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = attempt === 0 ? base : `${base}-${Math.random().toString(36).slice(2, 6)}`;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (admin as any)
      .from("forms")
      .insert({
        title: parsed.data.title,
        slug: candidate,
        description: parsed.data.description ?? null,
        requires_login: parsed.data.requires_login,
        has_rating_subject: parsed.data.has_rating_subject,
        created_by: user.id,
      })
      .select("id, title, slug, description, requires_login, has_rating_subject, is_published, created_at")
      .single();

    if (!error) return ok(data, 201);
    lastError = error;
    if (error.code !== "23505") break; // not a unique-violation — don't retry
  }

  console.error("[forms POST]", lastError);
  return ApiError.internal();
});
