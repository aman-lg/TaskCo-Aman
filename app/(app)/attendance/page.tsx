import { WorklogPageClient } from "@/components/worklog/worklog-page-client";

export default function AttendancePage() {
  return (
    <div>
      <h1 className="h1" style={{ color: "var(--ink)" }}>Worklog</h1>
      <p className="mt-2 mb-6" style={{ color: "var(--text-secondary)" }}>
        Mark your daily presence and see a history of what you worked on.
      </p>
      <WorklogPageClient />
    </div>
  );
}
