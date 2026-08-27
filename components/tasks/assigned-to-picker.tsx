"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import type { OrgUnit } from "@/lib/hooks/use-org-units";

export interface AssignedToValue {
  deptId: string | null;
  subDeptId: string | null;
  personIds: string[];
}

export const ASSIGNED_TO_SELECT_CLASS = "h-9 w-full px-2.5 rounded-lg text-[12.5px] outline-none disabled:opacity-50";
export const ASSIGNED_TO_SELECT_STYLE = { background: "var(--surface-bg)", border: "1px solid var(--line)", color: "var(--ink)" };

interface Props {
  units: OrgUnit[];
  value: AssignedToValue;
  onChange: (value: AssignedToValue) => void;
  className?: string;
  /** Applied to each of the 3 fields individually — lets a "contents"-wrapped
   * group size its fields consistently within a parent flex/grid layout. */
  fieldClassName?: string;
}

/**
 * Department -> Sub-Department -> People (multi-select) picker, shared by
 * every place that assigns tasks to specific people (the unified Tasks
 * page's filter/creation grid and the project's own New/Edit Task dialog)
 * so the picking behavior — and any future fix to it — only lives once.
 */
export function AssignedToPicker({ units, value, onChange, className, fieldClassName = "" }: Props) {
  const rootDepartments = units.filter((u) => !u.parent_id);
  const subDepartmentsOf = (deptId: string | null) => units.filter((u) => u.parent_id === deptId);
  const unitById = (id: string | null) => units.find((u) => u.id === id) ?? null;
  const candidates = unitById(value.subDeptId ?? value.deptId)?.members ?? [];
  const subDepts = subDepartmentsOf(value.deptId);

  return (
    <div className={className ?? "grid grid-cols-3 gap-2"}>
      <select
        value={value.deptId ?? ""}
        onChange={(e) => onChange({ deptId: e.target.value || null, subDeptId: null, personIds: [] })}
        className={`${ASSIGNED_TO_SELECT_CLASS} ${fieldClassName}`}
        style={ASSIGNED_TO_SELECT_STYLE}
      >
        <option value="">Department…</option>
        {rootDepartments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
      </select>

      <select
        value={value.subDeptId ?? ""}
        onChange={(e) => onChange({ ...value, subDeptId: e.target.value || null, personIds: [] })}
        disabled={!value.deptId || subDepts.length === 0}
        className={`${ASSIGNED_TO_SELECT_CLASS} ${fieldClassName}`}
        style={ASSIGNED_TO_SELECT_STYLE}
      >
        <option value="">{subDepts.length === 0 ? "Whole dept" : "Whole department"}</option>
        {subDepts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
      </select>

      <PeopleMultiSelect
        wrapperClassName={fieldClassName}
        candidates={candidates}
        selectedIds={value.personIds}
        onChange={(personIds) => onChange({ ...value, personIds })}
        disabled={!value.deptId}
      />
    </div>
  );
}

function PeopleMultiSelect({
  candidates,
  selectedIds,
  onChange,
  disabled,
  wrapperClassName = "",
}: {
  candidates: OrgUnit["members"];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
  wrapperClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function toggle(userId: string) {
    onChange(selectedIds.includes(userId) ? selectedIds.filter((id) => id !== userId) : [...selectedIds, userId]);
  }

  const selectedNames = candidates
    .filter((c) => selectedIds.includes(c.user_id))
    .map((c) => c.profile.full_name ?? c.profile.email ?? "?");
  const summary =
    selectedNames.length === 0 ? "Select people…" :
    selectedNames.length <= 2 ? selectedNames.join(", ") :
    `${selectedNames.length} people selected`;

  return (
    <div className={`relative ${wrapperClassName}`} ref={ref}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={`${ASSIGNED_TO_SELECT_CLASS} flex items-center justify-between gap-1`}
        style={ASSIGNED_TO_SELECT_STYLE}
      >
        <span className="truncate" style={{ color: selectedNames.length ? "var(--ink)" : "var(--text-muted)" }}>{summary}</span>
        <ChevronDown className="h-3.5 w-3.5 flex-shrink-0" style={{ color: "var(--text-muted)" }} />
      </button>
      {open && (
        <div
          className="absolute z-20 mt-1 w-full min-w-[180px] max-h-52 overflow-y-auto rounded-lg p-1.5 flex flex-col gap-0.5"
          style={{ background: "var(--surface-bg)", border: "1px solid var(--line)", boxShadow: "0 4px 16px rgba(0,0,0,0.12)" }}
        >
          {candidates.length === 0 ? (
            <p className="text-[12px] text-center py-2" style={{ color: "var(--text-fine)" }}>No one here yet.</p>
          ) : (
            candidates.map(({ user_id, profile }) => {
              const checked = selectedIds.includes(user_id);
              return (
                <label key={user_id} className="flex items-center gap-2 py-1.5 px-1.5 rounded-md hover:bg-[var(--line-soft)] cursor-pointer">
                  <input type="checkbox" checked={checked} onChange={() => toggle(user_id)} />
                  <span className="text-[12.5px] truncate" style={{ color: "var(--ink)" }}>{profile.full_name ?? profile.email}</span>
                </label>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
