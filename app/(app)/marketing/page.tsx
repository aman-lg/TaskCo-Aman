import { redirect } from "next/navigation";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { MarketingContent } from "./marketing-content";

export default async function MarketingPage() {
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
      <div className="mb-8">
        <h1 className="text-2xl font-bold" style={{ color: "var(--ink)" }}>Marketing</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
          Connect your channels and let Tasko tell you what's working.
        </p>
      </div>
      <MarketingContent />
    </div>
  );
}
