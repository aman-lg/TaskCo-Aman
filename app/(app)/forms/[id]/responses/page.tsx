import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidUUID } from "@/lib/utils/validate";
import { FormResponsesTable } from "@/components/forms/form-responses-table";

export default async function FormResponsesPage({ params }: { params: Promise<{ id: string }> }) {
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
  const { data: form } = await (admin as any).from("forms").select("id, title").eq("id", id).maybeSingle();
  if (!form) notFound();

  return (
    <div>
      <Link href={`/forms/${id}`} className="inline-flex items-center gap-1.5 text-[13px] font-semibold mb-4" style={{ color: "var(--text-muted)" }}>
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Builder
      </Link>
      <h1 className="text-2xl font-bold mb-6" style={{ color: "var(--ink)" }}>{form.title} — Responses</h1>
      <FormResponsesTable formId={id} />
    </div>
  );
}
