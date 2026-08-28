export const dynamic = "force-dynamic"; // never serve cached task data

import { createClient, getAuthUser } from "@/lib/supabase/server";
import { getProjects } from "@/lib/queries/projects";
import { getTaskStats, getTodayTasks } from "@/lib/queries/tasks";
import { DashboardClient } from "@/components/dashboard/dashboard-client";
import { AiInsightsCard } from "@/components/shared/ai-insights-card";

export default async function DashboardPage() {
  const supabase = await createClient();

  const [
    { data: { user } },
    projects,
    taskStats,
    todayTasks,
  ] = await Promise.all([
    getAuthUser(),
    getProjects(supabase),
    getTaskStats(supabase),
    getTodayTasks(supabase),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (supabase as any)
    .from("profiles")
    .select("full_name")
    .eq("id", user!.id)
    .single();

  const firstName = (profile as { full_name: string | null } | null)?.full_name?.split(" ")[0] ?? "there";

  return (
    <div className="flex flex-col gap-5">
      <AiInsightsCard scope="dashboard" title="Tasko's take" />
      <DashboardClient
        firstName={firstName}
        projectStats={{
          active: projects.filter((p) => p.status === "active").length,
          total: projects.length,
        }}
        taskStats={{
          total: taskStats.total,
          completed: taskStats.completed,
          pending: taskStats.pending,
          dueToday: taskStats.dueToday,
          statusBreakdown: taskStats.statusBreakdown,
        }}
        deadlineDates={taskStats.deadlineDates}
        projects={projects.map((p) => ({ id: p.id, title: p.title, color: p.color }))}
        todayTasks={todayTasks}
      />
    </div>
  );
}
