import { notFound, redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthUser } from "@/lib/supabase/server";
import { FormFillClient } from "@/components/forms/form-fill-client";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function FormFillPage({ params }: PageProps) {
  const { slug } = await params;
  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: form } = await (admin as any)
    .from("forms")
    .select("id, title, description, requires_login, has_rating_subject, is_published")
    .eq("slug", slug)
    .maybeSingle();

  if (!form || !form.is_published) notFound();

  if (form.requires_login) {
    const { data: { user } } = await getAuthUser();
    if (!user) redirect(`/login?redirectTo=${encodeURIComponent(`/form/${slug}`)}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: questions } = await (admin as any)
    .from("form_questions")
    .select("id, position, label, question_type, config, is_required, cadence, page_break_before")
    .eq("form_id", form.id)
    .order("position", { ascending: true });

  return <FormFillClient form={form} questions={questions ?? []} />;
}
