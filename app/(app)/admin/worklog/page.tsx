import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { redirect } from "next/navigation";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { AdminWorklogClient } from "@/components/admin/admin-worklog-client";

export default async function AdminWorklogPage() {
  const supabase = await createClient();
  const { data: { user } } = await getAuthUser();
  if (!user) redirect("/login");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (supabase as any)
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) redirect("/dashboard");

  return (
    <div>
      <Link href="/admin" className="inline-flex items-center gap-1.5 text-[13px] font-semibold mb-4" style={{ color: "var(--text-muted)" }}>
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Admin
      </Link>
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: "var(--ink)" }}>Team Worklog</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
          Daily presence and activity for everyone in the org.
        </p>
      </div>
      <AdminWorklogClient />
    </div>
  );
}
