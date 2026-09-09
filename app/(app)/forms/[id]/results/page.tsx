import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidUUID } from "@/lib/utils/validate";
import { FormResultsClient } from "@/components/forms/form-results-client";

export default async function FormResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isValidUUID(id)) notFound();

  const supabase = await createClient();
  const { data: { user } } = await getAuthUser();
  if (!user) redirect("/login");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (supabase as any).from("profiles").select("is_admin").eq("id", user.id).single();
  if (!profile?.is_admin) redirect("/dashboard");

  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: form } = await (admin as any).from("forms").select("id, title, has_rating_subject").eq("id", id).maybeSingle();
  if (!form || !form.has_rating_subject) notFound();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: responseRows } = await (admin as any)
    .from("form_responses")
    .select("subject_user_id, subject:profiles!subject_user_id(id, full_name)")
    .eq("form_id", id)
    .not("subject_user_id", "is", null);

  type Row = { subject_user_id: string; subject: { id: string; full_name: string | null } | null };
  const seen = new Set<string>();
  const subjects: { id: string; full_name: string | null }[] = [];
  for (const r of (responseRows ?? []) as Row[]) {
    if (r.subject && !seen.has(r.subject.id)) { seen.add(r.subject.id); subjects.push(r.subject); }
  }
  subjects.sort((a, b) => (a.full_name ?? "").localeCompare(b.full_name ?? ""));

  return (
    <div>
      <Link href={`/forms/${id}`} className="inline-flex items-center gap-1.5 text-[13px] font-semibold mb-4" style={{ color: "var(--text-muted)" }}>
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Builder
      </Link>
      <h1 className="text-2xl font-bold mb-6" style={{ color: "var(--ink)" }}>{form.title} — Results</h1>
      <FormResultsClient formId={id} subjects={subjects} />
    </div>
  );
}
