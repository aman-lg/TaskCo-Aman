import { redirect } from "next/navigation";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { FormsListClient } from "@/components/forms/forms-list-client";

export default async function FormsPage() {
  const supabase = await createClient();
  const { data: { user } } = await getAuthUser();
  if (!user) redirect("/login");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (supabase as any).from("profiles").select("is_admin").eq("id", user.id).single();
  if (!profile?.is_admin) redirect("/dashboard");

  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: forms } = await (admin as any)
    .from("forms")
    .select("id, title, slug, description, requires_login, has_rating_subject, is_published, created_at")
    .order("created_at", { ascending: false });

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold" style={{ color: "var(--ink)" }}>Forms</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
          Build forms, share them, and review responses — including periodic rating rollups.
        </p>
      </div>
      <FormsListClient initialForms={forms ?? []} />
    </div>
  );
}
