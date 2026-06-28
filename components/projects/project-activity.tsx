"use client";

import { useState, useEffect, useCallback } from "react";
import { CheckSquare, Plus, ArrowRight, Pencil, Trash2, UserPlus, UserMinus } from "lucide-react";

interface ActivityEntry {
  id: string;
  action: string;
  entity_type: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
  actor: { full_name: string | null } | null;
}

function getActivityIcon(action: string, entityType: string) {
  if (action === "checked") return <CheckSquare className="h-3.5 w-3.5" style={{ color: "var(--clr-green)" }} />;
  if (action === "unchecked") return <CheckSquare className="h-3.5 w-3.5" style={{ color: "var(--text-muted)" }} />;
  if (action === "created" && entityType === "task") return <Plus className="h-3.5 w-3.5" style={{ color: "var(--navy)" }} />;
  if (action === "created") return <Plus className="h-3.5 w-3.5" style={{ color: "var(--accent-brand)" }} />;
  if (action === "status_changed") return <ArrowRight className="h-3.5 w-3.5" style={{ color: "var(--accent-brand)" }} />;
  if (action === "updated") return <Pencil className="h-3.5 w-3.5" style={{ color: "var(--text-muted)" }} />;
  if (action === "deleted") return <Trash2 className="h-3.5 w-3.5" style={{ color: "var(--clr-red)" }} />;
  if (action === "assigned") return <UserPlus className="h-3.5 w-3.5" style={{ color: "var(--clr-green)" }} />;
  if (action === "unassigned") return <UserMinus className="h-3.5 w-3.5" style={{ color: "var(--clr-red)" }} />;
  return <div className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--line)" }} />;
}

function getActivityText(entry: ActivityEntry): string {
  const meta = entry.metadata ?? {};
  const actor = entry.actor?.full_name ?? "Someone";
  switch (entry.action) {
    case "created":
      if (entry.entity_type === "task") return `${actor} created task "${meta.name ?? "Untitled"}"`;
      if (entry.entity_type === "checklist_item") return `${actor} added checklist item "${meta.content ?? ""}"`;
      if (entry.entity_type === "project") return `${actor} created project "${meta.title ?? ""}"`;
      return `${actor} created ${entry.entity_type}`;
    case "updated":
      if (entry.entity_type === "task") return `${actor} updated task "${meta.name ?? ""}"`;
      if (entry.entity_type === "project") return `${actor} updated project "${meta.title ?? ""}"`;
      return `${actor} updated ${entry.entity_type}`;
    case "status_changed":
      if (entry.entity_type === "task") return `${actor} moved "${meta.name ?? "task"}" from ${String(meta.from ?? "").replace("_", " ")} → ${String(meta.to ?? "").replace("_", " ")}`;
      return `${actor} changed status from ${meta.from} → ${meta.to}`;
    case "checked":
      return `${actor} checked "${meta.content ?? "item"}"`;
    case "unchecked":
      return `${actor} unchecked "${meta.content ?? "item"}"`;
    case "deleted":
      if (entry.entity_type === "task") return `${actor} deleted task "${meta.name ?? ""}"`;
      if (entry.entity_type === "checklist_item") return `${actor} deleted checklist item "${meta.content ?? ""}"`;
      return `${actor} deleted ${entry.entity_type}`;
    case "assigned":
      return `${actor} assigned a team member`;
    case "unassigned":
      return `${actor} removed a team member`;
    default:
      return `${actor} ${entry.action} ${entry.entity_type}`;
  }
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

interface Props {
  projectId: string;
}

export function ProjectActivity({ projectId }: Props) {
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}/activity`, { credentials: "same-origin" });
    if (res.ok) {
      const { data } = await res.json();
      setActivities(data ?? []);
    }
    setLoading(false);
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-3 items-start">
            <div className="w-6 h-6 rounded-full animate-pulse flex-shrink-0" style={{ background: "var(--line)" }} />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 w-3/4 rounded animate-pulse" style={{ background: "var(--line)" }} />
              <div className="h-2.5 w-1/4 rounded animate-pulse" style={{ background: "var(--line-soft)" }} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <p className="text-[13px] py-4 text-center" style={{ color: "var(--text-muted)" }}>
        No activity yet. Create tasks to get started.
      </p>
    );
  }

  return (
    <div className="flex flex-col">
      {activities.map((entry, idx) => (
        <div key={entry.id} className="flex gap-3 items-start group">
          <div className="flex flex-col items-center flex-shrink-0" style={{ width: 24 }}>
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: "var(--panel-bg)", border: "1px solid var(--line)" }}
            >
              {getActivityIcon(entry.action, entry.entity_type)}
            </div>
            {idx < activities.length - 1 && (
              <div className="w-px flex-1 mt-1" style={{ background: "var(--line-soft)", minHeight: 16 }} />
            )}
          </div>

          <div className="pb-4 flex-1 min-w-0">
            <p className="text-[13px] leading-snug" style={{ color: "var(--ink)" }}>
              {getActivityText(entry)}
            </p>
            <p className="mt-0.5 text-[11px]" style={{ color: "var(--text-muted)" }}>
              {timeAgo(entry.created_at)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
