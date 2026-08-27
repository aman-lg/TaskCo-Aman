"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, X, Loader2, ChevronDown, Table2, Paperclip } from "lucide-react";
import { useOrgUnits } from "@/lib/hooks/use-org-units";
import { AssignedToPicker, type AssignedToValue, ASSIGNED_TO_SELECT_STYLE } from "./assigned-to-picker";

interface Project {
  id: string;
  title: string;
}

interface RowData {
  title: string;
  description: string;
  deadline: string;
  file: File | null;
}

const EMPTY_ROW: RowData = { title: "", description: "", deadline: "", file: null };
const cellInputClass = "h-9 w-full px-2.5 rounded-lg text-[12.5px] outline-none";

interface Props {
  projects: Project[];
}

export function BulkAssignGrid({ projects }: Props) {
  const router = useRouter();
  const { units, loading: loadingUnits } = useOrgUnits();

  const [filters, setFilters] = useState<AssignedToValue>({ deptId: null, subDeptId: null, personIds: [] });
  const [filterProject, setFilterProject] = useState<string>(projects[0]?.id ?? "");
  const [rowData, setRowData] = useState<Map<string, RowData>>(new Map());
  const [submitting, setSubmitting] = useState(false);

  const rootDepartments = useMemo(() => units.filter((u) => !u.parent_id), [units]);
  const unitById = (id: string | null) => units.find((u) => u.id === id) ?? null;
  const candidates = unitById(filters.subDeptId ?? filters.deptId)?.members ?? [];

  // Rows are directly derived from the people multi-select — checking a
  // person adds their row, unchecking removes it, no separate "add row"
  // step. This effect only keeps each row's own typed data (title/
  // description/deadline/attachment) around in a side map so it survives
  // re-renders and isn't wiped just because someone else's checkbox changed.
  useEffect(() => {
    setRowData((prev) => {
      const next = new Map(prev);
      let changed = false;
      for (const key of Array.from(next.keys())) {
        if (!filters.personIds.includes(key)) { next.delete(key); changed = true; }
      }
      for (const id of filters.personIds) {
        if (!next.has(id)) { next.set(id, { ...EMPTY_ROW }); changed = true; }
      }
      return changed ? next : prev;
    });
  }, [filters.personIds]);

  function updateRow(personId: string, patch: Partial<RowData>) {
    setRowData((prev) => {
      const next = new Map(prev);
      next.set(personId, { ...(next.get(personId) ?? EMPTY_ROW), ...patch });
      return next;
    });
  }

  function removePerson(personId: string) {
    setFilters((prev) => ({ ...prev, personIds: prev.personIds.filter((id) => id !== personId) }));
  }

  const rows = filters.personIds.map((personId) => {
    const person = candidates.find((c) => c.user_id === personId);
    return {
      personId,
      name: person?.profile.full_name ?? person?.profile.email ?? "Unknown",
      ...(rowData.get(personId) ?? EMPTY_ROW),
    };
  });

  async function handleSaveAll() {
    if (rows.length === 0) { toast.error("Select at least one person"); return; }
    if (!filterProject) { toast.error("Select a project"); return; }
    if (rows.some((r) => !r.title.trim())) { toast.error("Every row needs a Task Title"); return; }

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
            project_id: filterProject,
            name: row.title.trim(),
            description: row.description.trim() || undefined,
            deadline: row.deadline || undefined,
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

      if (failures.length > 0) {
        toast.error(`${failures.length} row${failures.length !== 1 ? "s" : ""} failed: ${failures.join("; ")}`);
      }
      if (createdTotal > 0) {
        toast.success(`Created ${createdTotal} task${createdTotal !== 1 ? "s" : ""}`);
        setFilters((prev) => ({ ...prev, personIds: [] }));
        router.push("/tasks");
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
        <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>Create a project before bulk-assigning tasks.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Link href="/tasks" className="p-1.5 rounded-xl hover:bg-[var(--line-soft)]" style={{ color: "var(--text-muted)" }} aria-label="Back to Tasks">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="h1" style={{ color: "var(--ink)" }}>Bulk Assign Tasks</h1>
          <p className="mt-1 text-[14px]" style={{ color: "var(--text-secondary)" }}>
            Pick a Department, Sub-Department, Project and the people to assign — a row appears for each person you check, and stays as you check/uncheck others.
          </p>
        </div>
      </div>

      {loadingUnits ? (
        <p className="text-[13px] text-center py-8" style={{ color: "var(--text-muted)" }}>Loading departments…</p>
      ) : rootDepartments.length === 0 ? (
        <p className="text-[13px] text-center py-8" style={{ color: "var(--text-fine)" }}>
          No departments set up yet — add them on the Org Chart page first.
        </p>
      ) : (
        <>
          {/* Filters */}
          <div
            className="flex flex-wrap items-end gap-3 p-4 rounded-xl"
            style={{ background: "var(--panel-bg)", border: "1px solid var(--line-soft)" }}
          >
            <AssignedToPicker
              units={units}
              value={filters}
              onChange={setFilters}
              className="contents"
              fieldClassName="flex-1 min-w-[160px]"
            />

            <div className="select-wrap flex-1 min-w-[180px]">
              <select value={filterProject} onChange={(e) => setFilterProject(e.target.value)} className="select-field">
                {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
              <span className="select-label">Project</span>
              <ChevronDown className="select-arrow" />
            </div>
          </div>

          {/* Grid */}
          {rows.length > 0 && (
            <div className="rounded-xl overflow-hidden" style={{ background: "var(--surface-bg)", boxShadow: "0 1px 8px rgba(0,0,0,0.07), 0 0 0 1px rgba(0,0,0,0.04)" }}>
              <div className="overflow-x-auto">
                <div style={{ minWidth: 760 }}>
                  {/* Header */}
                  <div
                    className="grid gap-2 px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider"
                    style={{ gridTemplateColumns: "160px 1.4fr 1.4fr 170px 130px 32px", color: "var(--text-muted)", borderBottom: "1px solid var(--line-soft)" }}
                  >
                    <span>Person</span>
                    <span>Task Title</span>
                    <span>Description</span>
                    <span>Deadline</span>
                    <span>Attachment</span>
                    <span />
                  </div>

                  {rows.map((row, idx) => (
                    <div
                      key={row.personId}
                      className="grid gap-2 px-4 py-2.5 items-center"
                      style={{
                        gridTemplateColumns: "160px 1.4fr 1.4fr 170px 130px 32px",
                        borderTop: idx > 0 ? "1px solid var(--line-soft)" : undefined,
                      }}
                    >
                      <span className="text-[13px] font-medium truncate" style={{ color: "var(--ink)" }}>{row.name}</span>

                      <input
                        value={row.title}
                        onChange={(e) => updateRow(row.personId, { title: e.target.value })}
                        placeholder="Task title"
                        className={cellInputClass}
                        style={ASSIGNED_TO_SELECT_STYLE}
                      />

                      <input
                        value={row.description}
                        onChange={(e) => updateRow(row.personId, { description: e.target.value })}
                        placeholder="Description (optional)"
                        className={cellInputClass}
                        style={ASSIGNED_TO_SELECT_STYLE}
                      />

                      <input
                        type="datetime-local"
                        value={row.deadline}
                        onChange={(e) => updateRow(row.personId, { deadline: e.target.value })}
                        className={cellInputClass}
                        style={ASSIGNED_TO_SELECT_STYLE}
                      />

                      <div className="flex items-center gap-1">
                        <label
                          className="h-9 w-full px-2.5 rounded-lg text-[12.5px] outline-none flex items-center gap-1.5 cursor-pointer"
                          style={ASSIGNED_TO_SELECT_STYLE}
                        >
                          <input
                            type="file"
                            className="hidden"
                            onChange={(e) => updateRow(row.personId, { file: e.target.files?.[0] ?? null })}
                          />
                          <Paperclip className="h-3.5 w-3.5 flex-shrink-0" style={{ color: "var(--text-muted)" }} />
                          <span className="truncate" style={{ color: row.file ? "var(--ink)" : "var(--text-muted)" }}>
                            {row.file ? row.file.name : "Attach…"}
                          </span>
                        </label>
                        {row.file && (
                          <button
                            type="button"
                            onClick={() => updateRow(row.personId, { file: null })}
                            style={{ color: "var(--text-muted)" }}
                            aria-label="Remove attachment"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>

                      <button type="button" onClick={() => removePerson(row.personId)} style={{ color: "var(--text-muted)" }} aria-label={`Remove ${row.name}`}>
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {rows.length === 0 && (
            <div
              className="flex flex-col items-center justify-center py-14 rounded-xl border border-dashed text-center"
              style={{ borderColor: "var(--line)", color: "var(--text-muted)" }}
            >
              <Table2 className="h-6 w-6 mb-2" />
              <p className="text-[13px]">Pick a Department and check people above — a row appears for each one.</p>
            </div>
          )}

          {rows.length > 0 && (
            <div className="flex items-center justify-between">
              <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>
                {rows.length} task{rows.length !== 1 ? "s" : ""} queued
              </p>
              <button
                type="button"
                onClick={handleSaveAll}
                disabled={submitting}
                className="flex items-center gap-2 h-10 px-6 rounded-xl text-[13px] font-bold text-white bg-[var(--navy)] hover:bg-[var(--navy-hover)] disabled:opacity-50"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Create {rows.length || ""} Task{rows.length !== 1 ? "s" : ""}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
