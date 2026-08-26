"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, X, Loader2, ChevronDown } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { RichTextEditor } from "@/components/ui/rich-text-editor";

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

interface Group {
  key: string;
  deptId: string | null;
  subDeptId: string | null;
  personIds: string[];
}

function newGroup(): Group {
  return { key: crypto.randomUUID(), deptId: null, subDeptId: null, personIds: [] };
}

function initials(name?: string | null, email?: string | null) {
  if (name) return name.split(" ").map((p) => p[0]).join("").toUpperCase().slice(0, 2);
  return (email?.[0] ?? "?").toUpperCase();
}

interface Props {
  open: boolean;
  onClose: () => void;
  projects: Project[];
}

export function BulkTaskDialog({ open, onClose, projects }: Props) {
  const router = useRouter();
  const [units, setUnits] = useState<Unit[]>([]);
  const [loadingUnits, setLoadingUnits] = useState(false);
  const [groups, setGroups] = useState<Group[]>([newGroup()]);

  const [projectId, setProjectId] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [urgency, setUrgency] = useState<"low" | "medium" | "high" | "urgent">("medium");
  const [deadline, setDeadline] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setProjectId(projects[0]?.id ?? "");
    setName("");
    setDescription("");
    setUrgency("medium");
    setDeadline("");
    setGroups([newGroup()]);
    if (units.length === 0) {
      setLoadingUnits(true);
      fetch("/api/org/units", { credentials: "same-origin" })
        .then((r) => r.json())
        .then((j) => setUnits(j.data ?? []))
        .finally(() => setLoadingUnits(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const rootDepartments = useMemo(() => units.filter((u) => !u.parent_id), [units]);
  const subDepartmentsOf = (deptId: string | null) => units.filter((u) => u.parent_id === deptId);
  const unitById = (id: string | null) => units.find((u) => u.id === id) ?? null;

  function candidatesFor(group: Group): { user_id: string; profile: Profile }[] {
    const unit = unitById(group.subDeptId ?? group.deptId);
    return unit?.members ?? [];
  }

  const allSelectedIds = useMemo(
    () => Array.from(new Set(groups.flatMap((g) => g.personIds))),
    [groups]
  );

  function updateGroup(key: string, patch: Partial<Group>) {
    setGroups((prev) => prev.map((g) => (g.key === key ? { ...g, ...patch } : g)));
  }

  function togglePerson(groupKey: string, userId: string) {
    setGroups((prev) => prev.map((g) => {
      if (g.key !== groupKey) return g;
      const has = g.personIds.includes(userId);
      return { ...g, personIds: has ? g.personIds.filter((id) => id !== userId) : [...g.personIds, userId] };
    }));
  }

  async function handleSubmit() {
    if (!projectId) { toast.error("Select a project"); return; }
    if (!name.trim()) { toast.error("Enter a task name"); return; }
    if (allSelectedIds.length === 0) { toast.error("Select at least one person to assign this to"); return; }

    setSubmitting(true);
    try {
      const res = await fetch("/api/tasks/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          project_id: projectId,
          name: name.trim(),
          description: description || undefined,
          urgency,
          deadline: deadline || undefined,
          assignee_ids: allSelectedIds,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json?.error?.message ?? "Failed to create tasks");
        return;
      }
      if (json.data?.warning) {
        toast.error(json.data.warning);
      } else {
        toast.success(`Created ${json.data.created} task${json.data.created !== 1 ? "s" : ""} for ${json.data.assigned} ${json.data.assigned !== 1 ? "people" : "person"}`);
      }
      router.refresh();
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="w-full max-w-[calc(100vw-2rem)] sm:max-w-[560px] p-0 gap-0 overflow-hidden">
        <DialogHeader className="flex flex-row items-center justify-between gap-3 px-6 py-4 border-b border-[var(--line)]">
          <DialogTitle className="h3 text-[var(--ink)]">Assign Task to Multiple People</DialogTitle>
          <button type="button" onClick={onClose} className="p-1.5 rounded-xl text-[var(--text-muted)] hover:bg-[var(--line-soft)]" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </DialogHeader>

        <div className="p-5 max-h-[70vh] overflow-y-auto flex flex-col gap-4">
          {/* Project */}
          <div className="select-wrap">
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="select-field">
              {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
            <span className="select-label">Project</span>
            <ChevronDown className="select-arrow" />
          </div>

          {/* Task name */}
          <div className="float-label-wrap">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder=" " className="float-label-input" />
            <label className="float-label">Task name <span className="text-[var(--clr-red)]">*</span></label>
          </div>

          {/* Description */}
          <RichTextEditor value={description} onChange={setDescription} placeholder="Description (optional)" />

          {/* Urgency + deadline */}
          <div className="grid grid-cols-2 gap-3">
            <div className="select-wrap">
              <select value={urgency} onChange={(e) => setUrgency(e.target.value as typeof urgency)} className="select-field">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
              <span className="select-label">Urgency</span>
              <ChevronDown className="select-arrow" />
            </div>
            <div className="float-label-wrap">
              <input type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="float-label-input" />
              <label className="float-label">Deadline (optional)</label>
            </div>
          </div>

          <div style={{ borderTop: "1px solid var(--line)" }} />

          {/* Assignment groups */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <p className="text-[13px] font-bold" style={{ color: "var(--ink)" }}>Assign to</p>
              <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
                {allSelectedIds.length} {allSelectedIds.length === 1 ? "person" : "people"} selected
              </p>
            </div>

            {loadingUnits ? (
              <p className="text-[13px] text-center py-4" style={{ color: "var(--text-muted)" }}>Loading departments…</p>
            ) : rootDepartments.length === 0 ? (
              <p className="text-[13px] text-center py-4" style={{ color: "var(--text-fine)" }}>
                No departments set up yet — add them on the Org Chart page first.
              </p>
            ) : (
              groups.map((group, idx) => {
                const subDepts = subDepartmentsOf(group.deptId);
                const candidates = candidatesFor(group);
                return (
                  <div key={group.key} className="rounded-xl p-3 flex flex-col gap-2.5" style={{ background: "var(--panel-bg)", border: "1px solid var(--line-soft)" }}>
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Group {idx + 1}</p>
                      {groups.length > 1 && (
                        <button type="button" onClick={() => setGroups((prev) => prev.filter((g) => g.key !== group.key))} style={{ color: "var(--text-muted)" }}>
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={group.deptId ?? ""}
                        onChange={(e) => updateGroup(group.key, { deptId: e.target.value || null, subDeptId: null, personIds: [] })}
                        className="h-9 px-2.5 rounded-lg text-[13px] outline-none"
                        style={{ background: "var(--surface-bg)", border: "1px solid var(--line)", color: "var(--ink)" }}
                      >
                        <option value="">Department…</option>
                        {rootDepartments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                      <select
                        value={group.subDeptId ?? ""}
                        onChange={(e) => updateGroup(group.key, { subDeptId: e.target.value || null, personIds: [] })}
                        disabled={!group.deptId || subDepts.length === 0}
                        className="h-9 px-2.5 rounded-lg text-[13px] outline-none disabled:opacity-50"
                        style={{ background: "var(--surface-bg)", border: "1px solid var(--line)", color: "var(--ink)" }}
                      >
                        <option value="">
                          {subDepts.length === 0 ? "No sub-departments" : "Sub-department…"}
                        </option>
                        {subDepts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                    </div>

                    {group.deptId && (
                      candidates.length === 0 ? (
                        <p className="text-[12px] text-center py-2" style={{ color: "var(--text-fine)" }}>No one is directly in this department yet.</p>
                      ) : (
                        <div className="flex flex-col gap-1 max-h-40 overflow-y-auto">
                          {candidates.map(({ user_id, profile }) => {
                            const checked = group.personIds.includes(user_id);
                            return (
                              <label key={user_id} className="flex items-center gap-2 py-1 px-1.5 rounded-lg hover:bg-[var(--line-soft)] cursor-pointer">
                                <input type="checkbox" checked={checked} onChange={() => togglePerson(group.key, user_id)} />
                                <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-[9px] font-bold" style={{ background: "var(--navy-l)", color: "var(--navy)" }}>
                                  {initials(profile.full_name, profile.email)}
                                </div>
                                <span className="text-[12.5px]" style={{ color: "var(--ink)" }}>{profile.full_name ?? profile.email}</span>
                              </label>
                            );
                          })}
                        </div>
                      )
                    )}
                  </div>
                );
              })
            )}

            <button
              type="button"
              onClick={() => setGroups((prev) => [...prev, newGroup()])}
              className="flex items-center justify-center gap-1.5 h-9 rounded-lg text-[12px] font-semibold"
              style={{ background: "var(--navy-l)", color: "var(--navy)" }}
            >
              <Plus className="h-3.5 w-3.5" /> Add another group
            </button>
          </div>
        </div>

        <div className="px-5 py-4 flex justify-end gap-2 border-t border-[var(--line)] bg-[var(--panel-bg)]">
          <button type="button" onClick={onClose} className="h-10 px-5 rounded-xl text-[13px] font-semibold border border-[var(--line)] text-[var(--text-secondary)] hover:bg-[var(--line-soft)]">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="h-10 px-6 rounded-xl text-[13px] font-bold text-white flex items-center gap-2 bg-[var(--navy)] hover:bg-[var(--navy-hover)] disabled:opacity-50"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Assign to {allSelectedIds.length || ""} {allSelectedIds.length === 1 ? "person" : "people"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
