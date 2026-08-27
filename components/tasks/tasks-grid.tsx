"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown, X, Loader2, Table2, Paperclip } from "lucide-react";
import { useOrgUnits } from "@/lib/hooks/use-org-units";
import { AssignedToPicker, type AssignedToValue, ASSIGNED_TO_SELECT_STYLE } from "./assigned-to-picker";
import type { TaskWithMeta } from "@/lib/queries/tasks";

interface Project {
  id: string;
  title: string;
}

type Urgency = "low" | "medium" | "high" | "urgent";

interface DraftData {
  projectId: string;
  title: string;
  description: string;
  deadline: string;
  urgency: Urgency;
  file: File | null;
}

const EMPTY_DRAFT = (projectId: string): DraftData => ({ projectId, title: "", description: "", deadline: "", urgency: "medium", file: null });

type ColKey = "dept" | "subdept" | "project" | "title" | "description" | "attachment" | "assignedDate" | "assignedBy" | "assignedTo" | "deadline" | "urgency";

const ALL_COLUMNS: { key: ColKey; label: string; width: string }[] = [
  { key: "dept", label: "Department", width: "140px" },
  { key: "subdept", label: "Sub-Department", width: "140px" },
  { key: "project", label: "Project Name", width: "150px" },
  { key: "title", label: "Task Title", width: "minmax(200px, 1.2fr)" },
  { key: "description", label: "Task Description", width: "minmax(200px, 1.4fr)" },
  { key: "attachment", label: "Attachment", width: "150px" },
  { key: "assignedDate", label: "Date of Assignment", width: "140px" },
  { key: "assignedBy", label: "Assigned By", width: "140px" },
  { key: "assignedTo", label: "Assigned To", width: "140px" },
  { key: "deadline", label: "Deadline", width: "170px" },
  { key: "urgency", label: "Urgency", width: "110px" },
];

const cellInputClass = "h-9 w-full px-2.5 rounded-lg text-[12.5px] outline-none";
const cellSelectClass = "h-9 w-full px-2 rounded-lg text-[12.5px] outline-none";

const URGENCY_TOKEN: Record<string, string> = { low: "--urgency-low", medium: "--urgency-medium", high: "--urgency-high", urgent: "--urgency-urgent" };
const URGENCY_BG_TOKEN: Record<string, string> = { low: "--urgency-low-bg", medium: "--urgency-medium-bg", high: "--urgency-high-bg", urgent: "--urgency-urgent-bg" };

function stripHtml(html: string | null): string {
  if (!html) return "";
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

interface Props {
  tasks: TaskWithMeta[];
  projects: Project[];
  currentUserName: string;
}

export function TasksGrid({ tasks, projects, currentUserName }: Props) {
  const router = useRouter();
  const { units, loading: loadingUnits } = useOrgUnits();

  const [filters, setFilters] = useState<AssignedToValue>({ deptId: null, subDeptId: null, personIds: [] });
  const [filterProject, setFilterProject] = useState<string>("");
  const [draftData, setDraftData] = useState<Map<string, DraftData>>(new Map());
  const [submitting, setSubmitting] = useState(false);

  const rootDepartments = useMemo(() => units.filter((u) => !u.parent_id), [units]);
  const unitById = (id: string | null) => units.find((u) => u.id === id) ?? null;
  const candidates = unitById(filters.subDeptId ?? filters.deptId)?.members ?? [];
  const projectNameById = useMemo(() => new Map(projects.map((p) => [p.id, p.title])), [projects]);

  // A user's "home" placement for display: prefer their sub-department
  // membership (and its parent as department); fall back to a direct
  // department membership. People can technically belong to more than one
  // unit — this picks one consistently rather than showing every match.
  const placementByUser = useMemo(() => {
    const map = new Map<string, { deptName: string | null; subDeptName: string | null }>();
    for (const unit of units) {
      if (!unit.parent_id) continue;
      const parent = units.find((u) => u.id === unit.parent_id);
      for (const m of unit.members) {
        if (!map.has(m.user_id)) map.set(m.user_id, { deptName: parent?.name ?? null, subDeptName: unit.name });
      }
    }
    for (const unit of units) {
      if (unit.parent_id) continue;
      for (const m of unit.members) {
        if (!map.has(m.user_id)) map.set(m.user_id, { deptName: unit.name, subDeptName: null });
      }
    }
    return map;
  }, [units]);

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (filterProject && t.project_id !== filterProject) return false;
      const assigneeIds = t.task_assignees.map((a) => a.user_id);
      if (filters.personIds.length > 0) return assigneeIds.some((id) => filters.personIds.includes(id));
      if (filters.deptId) {
        const candidateIds = new Set(candidates.map((c) => c.user_id));
        return assigneeIds.some((id) => candidateIds.has(id));
      }
      return true;
    });
  }, [tasks, filterProject, filters.personIds, filters.deptId, candidates]);

  // Checking a person means "show or create their task here" — if they
  // already have a matching task in view, that's enough; otherwise a blank
  // draft row appears for them.
  const draftPersonIds = useMemo(() => {
    const assignedIds = new Set(filteredTasks.flatMap((t) => t.task_assignees.map((a) => a.user_id)));
    return filters.personIds.filter((id) => !assignedIds.has(id));
  }, [filters.personIds, filteredTasks]);

  useEffect(() => {
    setDraftData((prev) => {
      const next = new Map(prev);
      let changed = false;
      for (const key of Array.from(next.keys())) {
        if (!draftPersonIds.includes(key)) { next.delete(key); changed = true; }
      }
      for (const id of draftPersonIds) {
        if (!next.has(id)) { next.set(id, EMPTY_DRAFT(filterProject)); changed = true; }
      }
      return changed ? next : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftPersonIds]);

  function updateDraft(personId: string, patch: Partial<DraftData>) {
    setDraftData((prev) => {
      const next = new Map(prev);
      next.set(personId, { ...(next.get(personId) ?? EMPTY_DRAFT(filterProject)), ...patch });
      return next;
    });
  }

  function removeDraftPerson(personId: string) {
    setFilters((prev) => ({ ...prev, personIds: prev.personIds.filter((id) => id !== personId) }));
  }

  async function openAttachment(taskId: string, fileId: string) {
    const res = await fetch(`/api/tasks/${taskId}/files/${fileId}`, { credentials: "same-origin" });
    const json = await res.json().catch(() => ({}));
    if (json?.data?.url) window.open(json.data.url, "_blank", "noopener");
    else toast.error("Couldn't open attachment");
  }

  const hidden: Record<ColKey, boolean> = {
    dept: !!filters.deptId,
    subdept: !!filters.subDeptId,
    project: !!filterProject,
    title: false,
    description: false,
    attachment: false,
    assignedDate: false,
    assignedBy: false,
    assignedTo: filters.personIds.length === 1,
    deadline: false,
    urgency: false,
  };
  const visibleColumns = ALL_COLUMNS.filter((c) => !hidden[c.key]);
  const gridTemplateColumns = `${visibleColumns.map((c) => c.width).join(" ")} 32px`;
  const gridMinWidth = visibleColumns.reduce((sum, c) => sum + (c.width.includes("fr") ? 200 : parseInt(c.width, 10)), 32);

  async function handleSaveAll() {
    if (draftPersonIds.length === 0) { toast.error("Check at least one person to create a task for"); return; }
    const rows = draftPersonIds.map((personId) => ({ personId, ...(draftData.get(personId) ?? EMPTY_DRAFT(filterProject)) }));
    if (rows.some((r) => !r.title.trim())) { toast.error("Every new row needs a Task Title"); return; }
    if (rows.some((r) => !r.projectId)) { toast.error("Every new row needs a Project"); return; }

    setSubmitting(true);
    try {
      let createdTotal = 0;
      const failures: string[] = [];

      for (const row of rows) {
        const taskRes = await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({
            project_id: row.projectId,
            name: row.title.trim(),
            description: row.description.trim() || undefined,
            deadline: row.deadline || undefined,
            urgency: row.urgency,
          }),
        });
        const taskJson = await taskRes.json().catch(() => ({}));
        if (!taskRes.ok) {
          failures.push(`"${row.title}": ${taskJson?.error?.message ?? "failed"}`);
          continue;
        }

        const assignRes = await fetch(`/api/tasks/${taskJson.data.id}/assignees`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ user_id: row.personId }),
        });
        if (!assignRes.ok) {
          const assignJson = await assignRes.json().catch(() => ({}));
          failures.push(`"${row.title}": task created but assigning failed (${assignJson?.error?.message ?? "unknown error"})`);
        }

        if (row.file) {
          const fileForm = new FormData();
          fileForm.append("file", row.file);
          const fileRes = await fetch(`/api/tasks/${taskJson.data.id}/files`, {
            method: "POST",
            credentials: "same-origin",
            body: fileForm,
          });
          if (!fileRes.ok) {
            const fileJson = await fileRes.json().catch(() => ({}));
            failures.push(`"${row.title}": task created but attachment failed (${fileJson?.error?.message ?? "unknown error"})`);
          }
        }

        createdTotal += 1;
      }

      if (failures.length > 0) toast.error(`${failures.length} row${failures.length !== 1 ? "s" : ""} failed: ${failures.join("; ")}`);
      if (createdTotal > 0) {
        toast.success(`Created ${createdTotal} task${createdTotal !== 1 ? "s" : ""}`);
        setFilters((prev) => ({ ...prev, personIds: [] }));
        router.refresh();
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-[15px] font-semibold mb-1" style={{ color: "var(--ink)" }}>No projects yet</p>
        <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>Create a project before assigning tasks.</p>
      </div>
    );
  }

  const isEmpty = filteredTasks.length === 0 && draftPersonIds.length === 0;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="h1" style={{ color: "var(--ink)" }}>Tasks</h1>
        <p className="mt-1 text-[14px]" style={{ color: "var(--text-secondary)" }}>
          Filter by Department, Sub-Department, Project or People. Checking a person shows their task here, or gives you a blank row to create one.
        </p>
      </div>

      {/* Filters */}
      <div
        className="flex flex-wrap items-end gap-3 p-4 rounded-xl"
        style={{ background: "var(--panel-bg)", border: "1px solid var(--line-soft)" }}
      >
        {loadingUnits ? (
          <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>Loading departments…</p>
        ) : (
          <AssignedToPicker
            units={units}
            value={filters}
            onChange={setFilters}
            className="contents"
            fieldClassName="flex-1 min-w-[160px]"
          />
        )}

        <div className="select-wrap flex-1 min-w-[180px]">
          <select value={filterProject} onChange={(e) => setFilterProject(e.target.value)} className="select-field">
            <option value="">All Projects</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
          <span className="select-label">Project</span>
          <ChevronDown className="select-arrow" />
        </div>
      </div>

      {/* Grid */}
      {!isEmpty && (
        <div className="rounded-xl overflow-hidden" style={{ background: "var(--surface-bg)", boxShadow: "0 1px 8px rgba(0,0,0,0.07), 0 0 0 1px rgba(0,0,0,0.04)" }}>
          <div className="overflow-x-auto">
            <div style={{ minWidth: gridMinWidth }}>
              {/* Header */}
              <div
                className="grid gap-2 px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider"
                style={{ gridTemplateColumns, color: "var(--text-muted)", borderBottom: "1px solid var(--line-soft)" }}
              >
                {visibleColumns.map((c) => <span key={c.key}>{c.label}</span>)}
                <span />
              </div>

              {/* Draft (new, unsaved) rows */}
              {draftPersonIds.map((personId, idx) => {
                const person = candidates.find((c) => c.user_id === personId);
                const name = person?.profile.full_name ?? person?.profile.email ?? "Unknown";
                const data = draftData.get(personId) ?? EMPTY_DRAFT(filterProject);
                return (
                  <div
                    key={`draft-${personId}`}
                    className="grid gap-2 px-4 py-2.5 items-center"
                    style={{ gridTemplateColumns, borderTop: idx > 0 ? "1px solid var(--line-soft)" : undefined, background: "var(--accent-bg)" }}
                  >
                    {visibleColumns.map((c) => {
                      switch (c.key) {
                        case "project":
                          return (
                            <select
                              key={c.key}
                              value={data.projectId}
                              onChange={(e) => updateDraft(personId, { projectId: e.target.value })}
                              className={cellSelectClass}
                              style={ASSIGNED_TO_SELECT_STYLE}
                            >
                              <option value="">Choose…</option>
                              {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
                            </select>
                          );
                        case "title":
                          return (
                            <input
                              key={c.key}
                              value={data.title}
                              onChange={(e) => updateDraft(personId, { title: e.target.value })}
                              placeholder="Task title"
                              className={cellInputClass}
                              style={ASSIGNED_TO_SELECT_STYLE}
                            />
                          );
                        case "description":
                          return (
                            <input
                              key={c.key}
                              value={data.description}
                              onChange={(e) => updateDraft(personId, { description: e.target.value })}
                              placeholder="Description (optional)"
                              className={cellInputClass}
                              style={ASSIGNED_TO_SELECT_STYLE}
                            />
                          );
                        case "attachment":
                          return (
                            <div key={c.key} className="flex items-center gap-1">
                              <label className={`${cellInputClass} flex items-center gap-1.5 cursor-pointer`} style={ASSIGNED_TO_SELECT_STYLE}>
                                <input type="file" className="hidden" onChange={(e) => updateDraft(personId, { file: e.target.files?.[0] ?? null })} />
                                <Paperclip className="h-3.5 w-3.5 flex-shrink-0" style={{ color: "var(--text-muted)" }} />
                                <span className="truncate" style={{ color: data.file ? "var(--ink)" : "var(--text-muted)" }}>
                                  {data.file ? data.file.name : "Attach…"}
                                </span>
                              </label>
                              {data.file && (
                                <button type="button" onClick={() => updateDraft(personId, { file: null })} style={{ color: "var(--text-muted)" }} aria-label="Remove attachment">
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          );
                        case "assignedDate":
                          return <span key={c.key} className="text-[12px]" style={{ color: "var(--text-muted)" }}>Today</span>;
                        case "assignedBy":
                          return <span key={c.key} className="text-[12.5px] truncate" style={{ color: "var(--text-muted)" }}>{currentUserName}</span>;
                        case "assignedTo":
                          return <span key={c.key} className="text-[13px] font-medium truncate" style={{ color: "var(--ink)" }}>{name}</span>;
                        case "deadline":
                          return (
                            <input
                              key={c.key}
                              type="datetime-local"
                              value={data.deadline}
                              onChange={(e) => updateDraft(personId, { deadline: e.target.value })}
                              className={cellInputClass}
                              style={ASSIGNED_TO_SELECT_STYLE}
                            />
                          );
                        case "urgency":
                          return (
                            <select
                              key={c.key}
                              value={data.urgency}
                              onChange={(e) => updateDraft(personId, { urgency: e.target.value as Urgency })}
                              className={cellSelectClass}
                              style={ASSIGNED_TO_SELECT_STYLE}
                            >
                              <option value="low">Low</option>
                              <option value="medium">Medium</option>
                              <option value="high">High</option>
                              <option value="urgent">Urgent</option>
                            </select>
                          );
                        default:
                          return <span key={c.key} />;
                      }
                    })}
                    <button type="button" onClick={() => removeDraftPerson(personId)} style={{ color: "var(--text-muted)" }} aria-label={`Remove ${name}`}>
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}

              {/* Real, already-created tasks */}
              {filteredTasks.map((task, idx) => {
                const primary = task.task_assignees[0];
                const extra = task.task_assignees.length - 1;
                const placement = primary ? placementByUser.get(primary.user_id) : undefined;
                return (
                  <div
                    key={task.id}
                    className="grid gap-2 px-4 py-2.5 items-center cursor-pointer transition-colors duration-100"
                    style={{
                      gridTemplateColumns,
                      borderTop: idx > 0 || draftPersonIds.length > 0 ? "1px solid var(--line-soft)" : undefined,
                    }}
                    onClick={() => router.push(`/projects/${task.project_id}`)}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--panel-bg)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    {visibleColumns.map((c) => {
                      switch (c.key) {
                        case "dept":
                          return <span key={c.key} className="text-[12.5px] truncate" style={{ color: "var(--text-secondary)" }}>{placement?.deptName ?? "—"}</span>;
                        case "subdept":
                          return <span key={c.key} className="text-[12.5px] truncate" style={{ color: "var(--text-secondary)" }}>{placement?.subDeptName ?? "—"}</span>;
                        case "project":
                          return <span key={c.key} className="text-[12.5px] truncate" style={{ color: "var(--text-secondary)" }}>{projectNameById.get(task.project_id) ?? "—"}</span>;
                        case "title":
                          return (
                            <span
                              key={c.key}
                              className="text-[13px] font-medium truncate"
                              style={{ color: "var(--ink)", textDecoration: task.status === "done" ? "line-through" : "none" }}
                            >
                              {task.name}
                            </span>
                          );
                        case "description":
                          return <span key={c.key} className="text-[12.5px] truncate" style={{ color: "var(--text-muted)" }}>{stripHtml(task.description) || "—"}</span>;
                        case "attachment":
                          return (
                            <div key={c.key} className="flex items-center gap-1 flex-wrap" onClick={(e) => e.stopPropagation()}>
                              {task.task_files.length === 0 ? (
                                <span className="text-[12px]" style={{ color: "var(--text-fine)" }}>—</span>
                              ) : (
                                task.task_files.map((f) => (
                                  <button
                                    key={f.id}
                                    type="button"
                                    onClick={() => openAttachment(task.id, f.id)}
                                    className="flex items-center gap-1 h-7 px-2 rounded-md text-[11.5px] truncate max-w-[130px]"
                                    style={{ background: "var(--panel-bg)", color: "var(--navy)" }}
                                    title={f.name}
                                  >
                                    <Paperclip className="h-3 w-3 flex-shrink-0" />
                                    <span className="truncate">{f.name}</span>
                                  </button>
                                ))
                              )}
                            </div>
                          );
                        case "assignedDate":
                          return <span key={c.key} className="text-[12px]" style={{ color: "var(--text-muted)" }}>{formatDate(primary?.assigned_at ?? task.created_at)}</span>;
                        case "assignedBy":
                          return <span key={c.key} className="text-[12.5px] truncate" style={{ color: "var(--text-secondary)" }}>{primary?.assigner?.full_name ?? task.creator?.full_name ?? "—"}</span>;
                        case "assignedTo":
                          return (
                            <span key={c.key} className="text-[12.5px] truncate" style={{ color: "var(--text-secondary)" }}>
                              {primary?.assignee?.full_name ?? "Unassigned"}{extra > 0 ? ` +${extra}` : ""}
                            </span>
                          );
                        case "deadline": {
                          const isPastDeadline = task.deadline && new Date(task.deadline) < new Date() && task.status !== "done";
                          return (
                            <span key={c.key} className="text-[12px]" style={{ color: isPastDeadline ? "var(--clr-red)" : "var(--text-muted)" }}>
                              {task.deadline ? formatDate(task.deadline) : "—"}
                            </span>
                          );
                        }
                        case "urgency": {
                          const u = task.urgency ?? "medium";
                          return (
                            <span
                              key={c.key}
                              className="inline-flex items-center h-5 px-2 rounded text-[10px] font-bold w-fit"
                              style={{ background: `var(${URGENCY_BG_TOKEN[u]})`, color: `var(${URGENCY_TOKEN[u]})` }}
                            >
                              {u.toUpperCase()}
                            </span>
                          );
                        }
                        default:
                          return <span key={c.key} />;
                      }
                    })}
                    <span />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {isEmpty && (
        <div
          className="flex flex-col items-center justify-center py-14 rounded-xl border border-dashed text-center"
          style={{ borderColor: "var(--line)", color: "var(--text-muted)" }}
        >
          <Table2 className="h-6 w-6 mb-2" />
          <p className="text-[13px]">
            {tasks.length === 0 ? "No tasks yet — pick a Department and check people above to create one." : "No tasks match these filters."}
          </p>
        </div>
      )}

      {draftPersonIds.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>
            {draftPersonIds.length} new task{draftPersonIds.length !== 1 ? "s" : ""} to create
          </p>
          <button
            type="button"
            onClick={handleSaveAll}
            disabled={submitting}
            className="flex items-center gap-2 h-10 px-6 rounded-xl text-[13px] font-bold text-white bg-[var(--navy)] hover:bg-[var(--navy-hover)] disabled:opacity-50"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Create {draftPersonIds.length} Task{draftPersonIds.length !== 1 ? "s" : ""}
          </button>
        </div>
      )}
    </div>
  );
}
