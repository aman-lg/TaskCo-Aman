"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Plus, X, Loader2, ChevronDown, Table2 } from "lucide-react";

interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  email: string | null;
}

interface Unit {
  id: string;
  parent_id: string | null;
  name: string;
  members: { user_id: string; profile: Profile }[];
}

interface Project {
  id: string;
  title: string;
}

interface Row {
  key: string;
  deptId: string | null;
  subDeptId: string | null;
  projectId: string;
  title: string;
  description: string;
  deadline: string;
}

function newRow(deptId: string | null, subDeptId: string | null, projectId: string): Row {
  return { key: crypto.randomUUID(), deptId, subDeptId, projectId, title: "", description: "", deadline: "" };
}

const cellSelectClass =
  "h-9 w-full px-2 rounded-lg text-[12.5px] outline-none disabled:opacity-50";
const cellSelectStyle = { background: "var(--surface-bg)", border: "1px solid var(--line)", color: "var(--ink)" };
const cellInputClass = "h-9 w-full px-2.5 rounded-lg text-[12.5px] outline-none";

interface Props {
  projects: Project[];
}

export function BulkAssignGrid({ projects }: Props) {
  const router = useRouter();
  const [units, setUnits] = useState<Unit[]>([]);
  const [loadingUnits, setLoadingUnits] = useState(true);

  const [filterDept, setFilterDept] = useState<string>("");
  const [filterSubDept, setFilterSubDept] = useState<string>("");
  const [filterProject, setFilterProject] = useState<string>(projects[0]?.id ?? "");

  const [rows, setRows] = useState<Row[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/org/units", { credentials: "same-origin" })
      .then((r) => r.json())
      .then((j) => setUnits(j.data ?? []))
      .finally(() => setLoadingUnits(false));
  }, []);

  const rootDepartments = useMemo(() => units.filter((u) => !u.parent_id), [units]);
  const subDepartmentsOf = (deptId: string) => units.filter((u) => u.parent_id === deptId);
  const unitById = (id: string | null) => units.find((u) => u.id === id) ?? null;
  const membersFor = (deptId: string | null, subDeptId: string | null) =>
    unitById(subDeptId || deptId)?.members ?? [];

  function addRow() {
    if (!filterDept) { toast.error("Select a department first"); return; }
    if (!filterProject) { toast.error("Select a project first"); return; }
    setRows((prev) => [...prev, newRow(filterDept, filterSubDept || null, filterProject)]);
  }

  function updateRow(key: string, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function removeRow(key: string) {
    setRows((prev) => prev.filter((r) => r.key !== key));
  }

  const rowMemberCounts = useMemo(
    () => new Map(rows.map((r) => [r.key, membersFor(r.deptId, r.subDeptId).length])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, units]
  );
  const totalTasks = rows.reduce((sum, r) => sum + (rowMemberCounts.get(r.key) ?? 0), 0);

  async function handleSaveAll() {
    if (rows.length === 0) { toast.error("Add at least one row"); return; }
    if (rows.some((r) => !r.title.trim())) { toast.error("Every row needs a Task Title"); return; }
    if (rows.some((r) => !r.projectId || !r.deptId)) { toast.error("Every row needs a Department and Project"); return; }
    if (rows.some((r) => (rowMemberCounts.get(r.key) ?? 0) === 0)) {
      toast.error("One of the rows' department/sub-department has no members to assign to");
      return;
    }

    setSubmitting(true);
    try {
      let createdTotal = 0;
      let assignedTotal = 0;
      const failures: string[] = [];

      for (const row of rows) {
        const assigneeIds = membersFor(row.deptId, row.subDeptId).map((m) => m.user_id);
        const res = await fetch("/api/tasks/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({
            project_id: row.projectId,
            name: row.title.trim(),
            description: row.description.trim() || undefined,
            deadline: row.deadline || undefined,
            assignee_ids: assigneeIds,
          }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          failures.push(`"${row.title}": ${json?.error?.message ?? "failed"}`);
          continue;
        }
        createdTotal += json.data?.created ?? 0;
        assignedTotal += json.data?.assigned ?? 0;
      }

      if (failures.length > 0) {
        toast.error(`${failures.length} row${failures.length !== 1 ? "s" : ""} failed: ${failures.join("; ")}`);
      }
      if (createdTotal > 0) {
        toast.success(`Created ${createdTotal} task${createdTotal !== 1 ? "s" : ""} for ${assignedTotal} ${assignedTotal !== 1 ? "people" : "person"}`);
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
            Pick a Department, Sub-Department and Project, then add rows — each row assigns one task to everyone in that group.
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
            <div className="select-wrap flex-1 min-w-[180px]">
              <select
                value={filterDept}
                onChange={(e) => { setFilterDept(e.target.value); setFilterSubDept(""); }}
                className="select-field"
              >
                <option value="">Choose…</option>
                {rootDepartments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              <span className="select-label">Department</span>
              <ChevronDown className="select-arrow" />
            </div>

            <div className="select-wrap flex-1 min-w-[180px]">
              <select
                value={filterSubDept}
                onChange={(e) => setFilterSubDept(e.target.value)}
                disabled={!filterDept || subDepartmentsOf(filterDept).length === 0}
                className="select-field"
              >
                <option value="">
                  {filterDept && subDepartmentsOf(filterDept).length === 0 ? "No sub-departments" : "Whole department"}
                </option>
                {subDepartmentsOf(filterDept).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              <span className="select-label">Sub-Department</span>
              <ChevronDown className="select-arrow" />
            </div>

            <div className="select-wrap flex-1 min-w-[180px]">
              <select value={filterProject} onChange={(e) => setFilterProject(e.target.value)} className="select-field">
                {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
              <span className="select-label">Project</span>
              <ChevronDown className="select-arrow" />
            </div>

            <button
              type="button"
              onClick={addRow}
              className="flex items-center gap-2 h-9 px-4 rounded-xl text-[13px] font-bold text-white transition-colors duration-150 bg-[var(--navy)] hover:bg-[var(--navy-hover)]"
            >
              <Plus className="h-4 w-4" /> Assign Task
            </button>
          </div>

          {/* Grid */}
          {rows.length > 0 && (
            <div className="rounded-xl overflow-hidden" style={{ background: "var(--surface-bg)", boxShadow: "0 1px 8px rgba(0,0,0,0.07), 0 0 0 1px rgba(0,0,0,0.04)" }}>
              <div className="overflow-x-auto">
                <div style={{ minWidth: 920 }}>
                  {/* Header */}
                  <div
                    className="grid gap-2 px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider"
                    style={{ gridTemplateColumns: "150px 150px 150px 1fr 1.3fr 170px 32px", color: "var(--text-muted)", borderBottom: "1px solid var(--line-soft)" }}
                  >
                    <span>Department</span>
                    <span>Sub-Department</span>
                    <span>Project</span>
                    <span>Task Title</span>
                    <span>Description</span>
                    <span>Deadline</span>
                    <span />
                  </div>

                  {rows.map((row, idx) => {
                    const subDepts = subDepartmentsOf(row.deptId ?? "");
                    const memberCount = rowMemberCounts.get(row.key) ?? 0;
                    return (
                      <div
                        key={row.key}
                        className="grid gap-2 px-4 py-2.5 items-center"
                        style={{
                          gridTemplateColumns: "150px 150px 150px 1fr 1.3fr 170px 32px",
                          borderTop: idx > 0 ? "1px solid var(--line-soft)" : undefined,
                        }}
                      >
                        <select
                          value={row.deptId ?? ""}
                          onChange={(e) => updateRow(row.key, { deptId: e.target.value || null, subDeptId: null })}
                          className={cellSelectClass}
                          style={cellSelectStyle}
                        >
                          <option value="">Choose…</option>
                          {rootDepartments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>

                        <select
                          value={row.subDeptId ?? ""}
                          onChange={(e) => updateRow(row.key, { subDeptId: e.target.value || null })}
                          disabled={!row.deptId || subDepts.length === 0}
                          className={cellSelectClass}
                          style={cellSelectStyle}
                        >
                          <option value="">{subDepts.length === 0 ? "—" : "Whole dept"}</option>
                          {subDepts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>

                        <select
                          value={row.projectId}
                          onChange={(e) => updateRow(row.key, { projectId: e.target.value })}
                          className={cellSelectClass}
                          style={cellSelectStyle}
                        >
                          {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
                        </select>

                        <input
                          value={row.title}
                          onChange={(e) => updateRow(row.key, { title: e.target.value })}
                          placeholder="Task title"
                          className={cellInputClass}
                          style={cellSelectStyle}
                        />

                        <input
                          value={row.description}
                          onChange={(e) => updateRow(row.key, { description: e.target.value })}
                          placeholder="Description (optional)"
                          className={cellInputClass}
                          style={cellSelectStyle}
                        />

                        <input
                          type="datetime-local"
                          value={row.deadline}
                          onChange={(e) => updateRow(row.key, { deadline: e.target.value })}
                          className={cellInputClass}
                          style={cellSelectStyle}
                        />

                        <button type="button" onClick={() => removeRow(row.key)} style={{ color: "var(--text-muted)" }} aria-label="Remove row">
                          <X className="h-4 w-4" />
                        </button>

                        {memberCount === 0 && (
                          <p className="text-[11px]" style={{ color: "var(--clr-red)", gridColumn: "1 / -1" }}>
                            No one is in this department/sub-department yet.
                          </p>
                        )}
                      </div>
                    );
                  })}
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
              <p className="text-[13px]">Pick a Department and Project above, then click &quot;Assign Task&quot; to add a row.</p>
            </div>
          )}

          {rows.length > 0 && (
            <div className="flex items-center justify-between">
              <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>
                {rows.length} row{rows.length !== 1 ? "s" : ""} · will create {totalTasks} task{totalTasks !== 1 ? "s" : ""}
              </p>
              <button
                type="button"
                onClick={handleSaveAll}
                disabled={submitting}
                className="flex items-center gap-2 h-10 px-6 rounded-xl text-[13px] font-bold text-white bg-[var(--navy)] hover:bg-[var(--navy-hover)] disabled:opacity-50"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Create {totalTasks || ""} Task{totalTasks !== 1 ? "s" : ""}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
