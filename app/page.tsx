import type { Metadata } from "next";
import { getAuthUser } from "@/lib/supabase/server";
import { Homepage } from "@/components/marketing/homepage";

export const metadata: Metadata = {
  title: "TaskCo — AI-powered team task management",
  description: "Projects, tasks, chat, and Ask Tasko — an AI assistant grounded in your team's real work.",
};

export default async function RootPage() {
  const { data: { user } } = await getAuthUser();

  const currentUser = user
    ? {
        name: (user.user_metadata?.full_name as string | null) ?? null,
        email: user.email ?? null,
        avatarUrl: (user.user_metadata?.avatar_url as string | null) ?? null,
      }
    : null;

  return <Homepage currentUser={currentUser} />;
}
