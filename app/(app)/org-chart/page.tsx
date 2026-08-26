import { createClient, getAuthUser } from "@/lib/supabase/server";
import { OrgChartClient } from "@/components/org-chart/org-chart-client";

export default async function OrgChartPage() {
  const supabase = await createClient();
  const { data: { user } } = await getAuthUser();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const [{ data: settings }, { data: units }, { data: profile }, { data: allProfiles }] = await Promise.all([
    db.from("org_settings").select("name, updated_at").eq("id", true).single(),
    db
      .from("org_units")
      .select(`
        id, parent_id, name, created_at,
        members:org_unit_members(user_id, title, added_at, profile:profiles!user_id(id, full_name, avatar_url, email))
      `)
      .order("created_at", { ascending: true }),
    db.from("profiles").select("is_admin").eq("id", user?.id).single(),
    db.from("profiles").select("id, full_name, avatar_url, email").order("full_name", { ascending: true }),
  ]);

  return (
    <OrgChartClient
      initialName={settings?.name ?? "My Organization"}
      initialUnits={units ?? []}
      allProfiles={allProfiles ?? []}
      isAdmin={!!profile?.is_admin}
    />
  );
}
