import { createClient } from "@/lib/supabase/server";
import { getProjects } from "@/lib/queries/projects";
import { getTaskStats, getTodayTasks } from "@/lib/queries/tasks";
import { DashboardClient } from "@/components/dashboard/dashboard-client";

export default async function DashboardPage() {
  const supabase = await createClient();

  const [
    { data: { user } },
    projects,
    taskStats,
    todayTasks,
  ] = await Promise.all([
    supabase.auth.getUser(),
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
  );
}
