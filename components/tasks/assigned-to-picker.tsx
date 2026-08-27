"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import type { OrgUnit } from "@/lib/hooks/use-org-units";

export interface AssignedToValue {
  deptIds: string[];
  subDeptIds: string[];
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
 * Department -> Sub-Department -> People, all multi-select, shared by every
 * place that assigns tasks to specific people (the unified Tasks page's
 * filter/creation grid and the project's own New/Edit Task dialog) so the
 * picking behavior — and any future fix to it — only lives once.
 *
 * Sub-Department is never required: picking only a Department is a valid,
 * common case (e.g. one task meant for everyone directly in that
 * department, not any particular sub-team).
 */
export function AssignedToPicker({ units, value, onChange, className, fieldClassName = "" }: Props) {
  const rootDepartments = units.filter((u) => !u.parent_id);
  const subDepts = units.filter((u) => u.parent_id && value.deptIds.includes(u.parent_id));

  // Candidates = union of members across every selected sub-department, or
  // (when none are selected) every selected department's own direct
  // members — same "sub-dept overrides dept" precedence as before, just
  // aggregated across a set instead of one id.
  const unitIds = value.subDeptIds.length > 0 ? value.subDeptIds : value.deptIds;
  const seen = new Set<string>();
  const candidates: OrgUnit["members"] = [];
  for (const unitId of unitIds) {
    const unit = units.find((u) => u.id === unitId);
    for (const m of unit?.members ?? []) {
      if (!seen.has(m.user_id)) { seen.add(m.user_id); candidates.push(m); }
    }
  }

  return (
    <div className={className ?? "grid grid-cols-3 gap-2"}>
      <MultiSelect
        wrapperClassName={fieldClassName}
        placeholder="Department…"
        options={rootDepartments.map((d) => ({ id: d.id, label: d.name }))}
        selectedIds={value.deptIds}
        onChange={(deptIds) => onChange({ deptIds, subDeptIds: [], personIds: [] })}
      />

      <MultiSelect
        wrapperClassName={fieldClassName}
        placeholder={subDepts.length === 0 ? "Whole dept" : "Whole department"}
        options={subDepts.map((d) => ({ id: d.id, label: d.name }))}
        selectedIds={value.subDeptIds}
        onChange={(subDeptIds) => onChange({ ...value, subDeptIds, personIds: [] })}
        disabled={value.deptIds.length === 0 || subDepts.length === 0}
      />

      <MultiSelect
        wrapperClassName={fieldClassName}
        placeholder="Select people…"
        itemNoun="people"
        options={candidates.map((c) => ({ id: c.user_id, label: c.profile.full_name ?? c.profile.email ?? "?" }))}
        selectedIds={value.personIds}
        onChange={(personIds) => onChange({ ...value, personIds })}
        disabled={value.deptIds.length === 0}
      />
    </div>
  );
}

export function MultiSelect({
  options,
  selectedIds,
  onChange,
  disabled,
  placeholder = "Select…",
  itemNoun = "selected",
  wrapperClassName = "",
}: {
  options: { id: string; label: string }[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
  itemNoun?: string;
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

  function toggle(id: string) {
    onChange(selectedIds.includes(id) ? selectedIds.filter((v) => v !== id) : [...selectedIds, id]);
  }

  const selectedLabels = options.filter((o) => selectedIds.includes(o.id)).map((o) => o.label);
  const summary =
    selectedLabels.length === 0 ? placeholder :
    selectedLabels.length <= 2 ? selectedLabels.join(", ") :
    `${selectedLabels.length} ${itemNoun} selected`;

  return (
    <div className={`relative ${wrapperClassName}`} ref={ref}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={`${ASSIGNED_TO_SELECT_CLASS} flex items-center justify-between gap-1`}
        style={ASSIGNED_TO_SELECT_STYLE}
      >
        <span className="truncate" style={{ color: selectedLabels.length ? "var(--ink)" : "var(--text-muted)" }}>{summary}</span>
        <ChevronDown className="h-3.5 w-3.5 flex-shrink-0" style={{ color: "var(--text-muted)" }} />
      </button>
      {open && (
        <div
          className="absolute z-20 mt-1 w-full min-w-[180px] max-h-52 overflow-y-auto rounded-lg p-1.5 flex flex-col gap-0.5"
          style={{ background: "var(--surface-bg)", border: "1px solid var(--line)", boxShadow: "0 4px 16px rgba(0,0,0,0.12)" }}
        >
          {options.length === 0 ? (
            <p className="text-[12px] text-center py-2" style={{ color: "var(--text-fine)" }}>Nothing here yet.</p>
          ) : (
            options.map(({ id, label }) => {
              const checked = selectedIds.includes(id);
              return (
                <label key={id} className="flex items-center gap-2 py-1.5 px-1.5 rounded-md hover:bg-[var(--line-soft)] cursor-pointer">
                  <input type="checkbox" checked={checked} onChange={() => toggle(id)} />
                  <span className="text-[12.5px] truncate" style={{ color: "var(--ink)" }}>{label}</span>
                </label>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
