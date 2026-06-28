"use client";

import { useState, useEffect } from "react";
import { Plus } from "lucide-react";
import { ProjectCard } from "@/components/projects/project-card";
import { ProjectFormDialog } from "@/components/projects/project-form-dialog";
import type { Project } from "@/types";

const STATUS_TABS = [
  { value: "all",       label: "All" },
  { value: "active",    label: "Active" },
  { value: "on_hold",   label: "On Hold" },
  { value: "completed", label: "Completed" },
  { value: "archived",  label: "Archived" },
] as const;

type StatusFilter = (typeof STATUS_TABS)[number]["value"];

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>("");

  async function load() {
    setLoading(true);
    const [projRes, userRes] = await Promise.all([
      fetch("/api/projects", { credentials: "same-origin" }),
      fetch("/api/auth/me", { credentials: "same-origin" }),
    ]);
    if (projRes.ok) {
      const { data } = await projRes.json();
      setProjects(data ?? []);
    }
    if (userRes.ok) {
      const { data } = await userRes.json();
      setCurrentUserId(data?.id ?? "");
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const filtered =
    statusFilter === "all"
      ? projects
      : projects.filter((p) => p.status === statusFilter);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="h1" style={{ color: "var(--ink)" }}>
            Projects
          </h1>
          <p className="mt-1 text-[14px]" style={{ color: "var(--text-secondary)" }}>
            {projects.length} project{projects.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-2 h-10 px-5 rounded-xl text-[14px] font-bold text-white transition-[box-shadow,opacity] duration-150 hover:shadow-[var(--shadow-needle)]"
          style={{ background: "var(--navy)" }}
        >
          <Plus className="h-4 w-4" />
          New project
        </button>
      </div>

      {/* Status filter tabs */}
      <div
        className="flex items-center gap-1 p-1 rounded-xl w-fit"
        style={{ background: "var(--panel-bg)", border: "1px solid var(--line-soft)" }}
      >
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setStatusFilter(tab.value)}
            className="h-8 px-3.5 rounded-lg text-[13px] font-semibold transition-[background,color,box-shadow] duration-150"
            style={
              statusFilter === tab.value
                ? {
                    background: "var(--surface-bg)",
                    color: "var(--navy)",
                    boxShadow: "var(--shadow-card)",
                  }
                : {
                    background: "transparent",
                    color: "var(--text-muted)",
                  }
            }
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-48 rounded-xl animate-pulse"
              style={{ background: "var(--line-soft)" }}
            />
          ))}
        </div>
      ) : filtered.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((p) => (
            <ProjectCard key={p.id} project={p} currentUserId={currentUserId} />
          ))}
        </div>
      ) : (
        <div
          className="flex flex-col items-center justify-center py-20 rounded-xl border border-dashed"
          style={{ borderColor: "var(--line)", color: "var(--text-muted)" }}
        >
          <p className="text-[15px] font-semibold mb-1" style={{ color: "var(--ink)" }}>
            {statusFilter === "all" ? "No projects yet" : `No ${statusFilter.replace("_", " ")} projects`}
          </p>
          <p className="text-[13px]">
            {statusFilter === "all" ? "Create your first project to get started." : "Try a different filter."}
          </p>
          {statusFilter === "all" && (
            <button
              onClick={() => setCreateOpen(true)}
              className="mt-5 flex items-center gap-2 h-9 px-4 rounded-xl text-[13px] font-bold text-white"
              style={{ background: "var(--navy)" }}
            >
              <Plus className="h-3.5 w-3.5" /> New project
            </button>
          )}
        </div>
      )}

      <ProjectFormDialog
        open={createOpen}
        onClose={() => { setCreateOpen(false); load(); }}
      />
    </div>
  );
}
