"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { toast } from "sonner";
import {
  Pencil, Plus, Trash2, X, Loader2, Users, ChevronDown, ChevronUp, Building2,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  email: string | null;
}

type UnitRole = "lead" | "facilitator" | "member";

const UNIT_ROLE_LABEL: Record<UnitRole, string> = {
  lead: "Team Lead",
  facilitator: "Team Facilitator",
  member: "Member",
};

interface Member {
  user_id: string;
  title: string | null;
  unit_role: UnitRole;
  added_at: string;
  profile: Profile;
}

interface Unit {
  id: string;
  parent_id: string | null;
  name: string;
  created_at: string;
  members: Member[];
}

interface Props {
  initialName: string;
  initialUnits: Unit[];
  allProfiles: Profile[];
  isAdmin: boolean;
}

function initials(name?: string | null, email?: string | null) {
  if (name) return name.split(" ").map((p) => p[0]).join("").toUpperCase().slice(0, 2);
  return (email?.[0] ?? "?").toUpperCase();
}

// ── Add / edit department dialog ─────────────────────────────────────────────

function UnitDialog({
  open, onClose, onSubmit, initialValue, title,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (name: string) => Promise<void>;
  initialValue?: string;
  title: string;
}) {
  const [name, setName] = useState(initialValue ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) setName(initialValue ?? ""); }, [open, initialValue]);

  async function handleSubmit() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSubmit(name.trim());
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="w-full max-w-[calc(100vw-2rem)] sm:max-w-[380px] p-5 gap-4">
        <DialogHeader>
          <DialogTitle className="h3" style={{ color: "var(--ink)" }}>{title}</DialogTitle>
        </DialogHeader>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          placeholder="Department name"
          className="h-10 px-3 rounded-lg text-[13px] outline-none"
          style={{ background: "var(--panel-bg)", border: "1px solid var(--line)", color: "var(--ink)" }}
        />
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="h-9 px-4 rounded-lg text-[13px] font-semibold" style={{ color: "var(--text-secondary)" }}>
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || !name.trim()}
            className="h-9 px-5 rounded-lg text-[13px] font-bold text-white disabled:opacity-40"
            style={{ background: "var(--navy)" }}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Add member dialog ────────────────────────────────────────────────────────

function AddMemberDialog({
  open, onClose, onSubmit, candidates,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (userId: string, title: string, unitRole: UnitRole) => Promise<void>;
  candidates: Profile[];
}) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Profile | null>(null);
  const [title, setTitle] = useState("");
  const [unitRole, setUnitRole] = useState<UnitRole>("member");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) { setSearch(""); setSelected(null); setTitle(""); setUnitRole("member"); }
  }, [open]);

  const filtered = candidates.filter((p) =>
    (p.full_name ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (p.email ?? "").toLowerCase().includes(search.toLowerCase())
  );

  async function handleSubmit() {
    if (!selected) return;
    setSaving(true);
    try {
      await onSubmit(selected.id, title.trim(), unitRole);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="w-full max-w-[calc(100vw-2rem)] sm:max-w-[380px] p-5 gap-4">
        <DialogHeader>
          <DialogTitle className="h3" style={{ color: "var(--ink)" }}>Add team member</DialogTitle>
        </DialogHeader>

        {!selected ? (
          <>
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or email…"
              className="h-9 px-3 rounded-lg text-[13px] outline-none"
              style={{ background: "var(--panel-bg)", border: "1px solid var(--line)", color: "var(--ink)" }}
            />
            <div className="flex flex-col gap-1 max-h-52 overflow-y-auto">
              {filtered.length === 0 ? (
                <p className="text-[12px] text-center py-3" style={{ color: "var(--text-muted)" }}>No matches</p>
              ) : filtered.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelected(p)}
                  className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-[var(--line-soft)] text-left"
                >
                  <Avatar className="h-6 w-6 flex-shrink-0">
                    <AvatarImage src={p.avatar_url ?? undefined} />
                    <AvatarFallback className="text-[10px]" style={{ background: "var(--navy-l)", color: "var(--navy)" }}>
                      {initials(p.full_name, p.email)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-medium truncate" style={{ color: "var(--ink)" }}>{p.full_name ?? "Unnamed"}</p>
                    <p className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>{p.email}</p>
                  </div>
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 p-2 rounded-lg" style={{ background: "var(--panel-bg)" }}>
              <Avatar className="h-7 w-7 flex-shrink-0">
                <AvatarImage src={selected.avatar_url ?? undefined} />
                <AvatarFallback className="text-[10px]" style={{ background: "var(--navy-l)", color: "var(--navy)" }}>
                  {initials(selected.full_name, selected.email)}
                </AvatarFallback>
              </Avatar>
              <p className="flex-1 text-[13px] font-medium truncate" style={{ color: "var(--ink)" }}>{selected.full_name ?? selected.email}</p>
              <button onClick={() => setSelected(null)} style={{ color: "var(--text-muted)" }}><X className="h-3.5 w-3.5" /></button>
            </div>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              placeholder="Title (optional, e.g. Senior Engineer)"
              className="h-9 px-3 rounded-lg text-[13px] outline-none"
              style={{ background: "var(--panel-bg)", border: "1px solid var(--line)", color: "var(--ink)" }}
            />
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold" style={{ color: "var(--text-muted)" }}>Department role</label>
              <select
                value={unitRole}
                onChange={(e) => setUnitRole(e.target.value as UnitRole)}
                className="h-9 px-3 rounded-lg text-[13px] outline-none"
                style={{ background: "var(--panel-bg)", border: "1px solid var(--line)", color: "var(--ink)" }}
              >
                <option value="member">Member</option>
                <option value="lead">Team Lead</option>
                <option value="facilitator">Team Facilitator</option>
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={onClose} className="h-9 px-4 rounded-lg text-[13px] font-semibold" style={{ color: "var(--text-secondary)" }}>
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={saving}
                className="h-9 px-5 rounded-lg text-[13px] font-bold text-white disabled:opacity-40"
                style={{ background: "var(--navy)" }}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
              </button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── One department box + its sub-departments ─────────────────────────────────

function OrgNode({
  unit, childrenMap, isAdmin, allProfiles, onAddChild, onAddMember, onRemoveMember, onChangeRole, onRename, onDelete,
}: {
  unit: Unit;
  childrenMap: Record<string, Unit[]>;
  isAdmin: boolean;
  allProfiles: Profile[];
  onAddChild: (parentId: string, name: string) => Promise<void>;
  onAddMember: (unitId: string, userId: string, title: string, unitRole: UnitRole) => Promise<void>;
  onRemoveMember: (unitId: string, userId: string) => Promise<void>;
  onChangeRole: (unitId: string, userId: string, unitRole: UnitRole) => Promise<void>;
  onRename: (unitId: string, name: string) => Promise<void>;
  onDelete: (unitId: string) => Promise<void>;
}) {
  const kids = childrenMap[unit.id] ?? [];
  const [expanded, setExpanded] = useState(false);
  const [showRename, setShowRename] = useState(false);
  const [showAddChild, setShowAddChild] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [changingRoleId, setChangingRoleId] = useState<string | null>(null);

  const existingMemberIds = new Set(unit.members.map((m) => m.user_id));
  const candidates = allProfiles.filter((p) => !existingMemberIds.has(p.id));

  return (
    <li>
      <div
        className="org-node-box rounded-xl p-3 flex flex-col gap-2 text-left"
        style={{ background: "var(--surface-bg)", border: "1px solid var(--line-soft)", boxShadow: "0 1px 8px rgba(0,0,0,0.06)", minWidth: 200 }}
      >
        <div className="flex items-start justify-between gap-2">
          <p className="text-[13px] font-bold" style={{ color: "var(--ink)" }}>{unit.name}</p>
          {isAdmin && (
            <div className="flex items-center gap-0.5 flex-shrink-0">
              <button onClick={() => setShowRename(true)} className="p-1 rounded hover:bg-[var(--line-soft)]" style={{ color: "var(--text-muted)" }} title="Rename">
                <Pencil className="h-3 w-3" />
              </button>
              <button onClick={() => setConfirmDelete(true)} className="p-1 rounded hover:bg-[var(--clr-red-bg)]" style={{ color: "var(--clr-red)" }} title="Delete">
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>

        {unit.members.length > 0 && (
          <button onClick={() => setExpanded((v) => !v)} className="flex items-center gap-1.5">
            <div className="flex -space-x-1.5">
              {unit.members.slice(0, 5).map((m) => (
                <Avatar key={m.user_id} className="h-6 w-6 border-2" style={{ borderColor: "var(--surface-bg)" }} title={m.profile.full_name ?? m.profile.email ?? ""}>
                  <AvatarImage src={m.profile.avatar_url ?? undefined} />
                  <AvatarFallback className="text-[9px]" style={{ background: "var(--navy-l)", color: "var(--navy)" }}>
                    {initials(m.profile.full_name, m.profile.email)}
                  </AvatarFallback>
                </Avatar>
              ))}
            </div>
            {unit.members.length > 5 && (
              <span className="text-[11px] font-semibold" style={{ color: "var(--text-muted)" }}>+{unit.members.length - 5}</span>
            )}
            {expanded ? <ChevronUp className="h-3 w-3 flex-shrink-0" style={{ color: "var(--text-muted)" }} /> : <ChevronDown className="h-3 w-3 flex-shrink-0" style={{ color: "var(--text-muted)" }} />}
          </button>
        )}

        {expanded && unit.members.length > 0 && (
          <div className="flex flex-col gap-1.5 pt-1" style={{ borderTop: "1px solid var(--line-soft)" }}>
            {unit.members.map((m) => (
              <div key={m.user_id} className="flex items-center gap-2">
                <Avatar className="h-5 w-5 flex-shrink-0">
                  <AvatarImage src={m.profile.avatar_url ?? undefined} />
                  <AvatarFallback className="text-[9px]" style={{ background: "var(--navy-l)", color: "var(--navy)" }}>
                    {initials(m.profile.full_name, m.profile.email)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-medium truncate" style={{ color: "var(--ink)" }}>{m.profile.full_name ?? m.profile.email}</p>
                  {m.title && <p className="text-[10px] truncate" style={{ color: "var(--text-muted)" }}>{m.title}</p>}
                </div>
                {isAdmin ? (
                  <select
                    value={m.unit_role}
                    onChange={async (e) => {
                      setChangingRoleId(m.user_id);
                      await onChangeRole(unit.id, m.user_id, e.target.value as UnitRole);
                      setChangingRoleId(null);
                    }}
                    disabled={changingRoleId === m.user_id}
                    className="h-6 px-1.5 rounded text-[10px] font-semibold outline-none flex-shrink-0 disabled:opacity-50"
                    style={{ border: "1px solid var(--line)", background: "var(--surface-bg)", color: "var(--text-secondary)" }}
                  >
                    <option value="member">Member</option>
                    <option value="lead">Team Lead</option>
                    <option value="facilitator">Facilitator</option>
                  </select>
                ) : m.unit_role !== "member" ? (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0" style={{ background: "var(--navy-l)", color: "var(--navy)" }}>
                    {UNIT_ROLE_LABEL[m.unit_role]}
                  </span>
                ) : null}
                {isAdmin && (
                  <button
                    onClick={async () => { setRemovingId(m.user_id); await onRemoveMember(unit.id, m.user_id); setRemovingId(null); }}
                    disabled={removingId === m.user_id}
                    className="p-0.5 rounded flex-shrink-0 hover:bg-[var(--clr-red-bg)]"
                    style={{ color: "var(--clr-red)" }}
                  >
                    {removingId === m.user_id ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {isAdmin && (
          <div className="flex items-center gap-1 pt-1" style={{ borderTop: "1px solid var(--line-soft)" }}>
            <button
              onClick={() => setShowAddMember(true)}
              className="flex items-center gap-1 h-6 px-2 rounded text-[10px] font-semibold"
              style={{ background: "var(--navy-l)", color: "var(--navy)" }}
            >
              <Users className="h-3 w-3" /> Member
            </button>
            <button
              onClick={() => setShowAddChild(true)}
              className="flex items-center gap-1 h-6 px-2 rounded text-[10px] font-semibold"
              style={{ background: "var(--navy-l)", color: "var(--navy)" }}
            >
              <Plus className="h-3 w-3" /> Sub-department
            </button>
          </div>
        )}
      </div>

      {kids.length > 0 && (
        <ul>
          {kids.map((k) => (
            <OrgNode
              key={k.id} unit={k} childrenMap={childrenMap} isAdmin={isAdmin} allProfiles={allProfiles}
              onAddChild={onAddChild} onAddMember={onAddMember} onRemoveMember={onRemoveMember} onChangeRole={onChangeRole}
              onRename={onRename} onDelete={onDelete}
            />
          ))}
        </ul>
      )}

      <UnitDialog open={showRename} onClose={() => setShowRename(false)} title="Rename department" initialValue={unit.name} onSubmit={(name) => onRename(unit.id, name)} />
      <UnitDialog open={showAddChild} onClose={() => setShowAddChild(false)} title="Add sub-department" onSubmit={(name) => onAddChild(unit.id, name)} />
      <AddMemberDialog open={showAddMember} onClose={() => setShowAddMember(false)} candidates={candidates} onSubmit={(userId, title, unitRole) => onAddMember(unit.id, userId, title, unitRole)} />
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete "${unit.name}"?`}
        description={kids.length > 0 ? "This also deletes every sub-department inside it. This cannot be undone." : "This cannot be undone."}
        confirmLabel="Delete"
        destructive
        loading={deleting}
        onConfirm={async () => { setDeleting(true); await onDelete(unit.id); setDeleting(false); setConfirmDelete(false); }}
      />
    </li>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function OrgChartClient({ initialName, initialUnits, allProfiles, isAdmin }: Props) {
  const [orgName, setOrgName] = useState(initialName);
  const [units, setUnits] = useState<Unit[]>(initialUnits);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(initialName);
  const [savingName, setSavingName] = useState(false);
  const [showAddRoot, setShowAddRoot] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editingName) nameInputRef.current?.focus(); }, [editingName]);

  const childrenMap = useMemo(() => {
    const map: Record<string, Unit[]> = {};
    for (const u of units) {
      const key = u.parent_id ?? "root";
      if (!map[key]) map[key] = [];
      map[key].push(u);
    }
    return map;
  }, [units]);
  const rootUnits = childrenMap["root"] ?? [];

  async function saveName() {
    if (!nameDraft.trim() || nameDraft === orgName) { setEditingName(false); setNameDraft(orgName); return; }
    setSavingName(true);
    try {
      const res = await fetch("/api/org/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ name: nameDraft.trim() }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(body?.error?.message ?? "Failed to rename organization");
        return;
      }
      setOrgName(body.data.name);
      setEditingName(false);
    } finally {
      setSavingName(false);
    }
  }

  async function addUnit(name: string, parentId: string | null) {
    const res = await fetch("/api/org/units", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ name, parent_id: parentId }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) { toast.error(body?.error?.message ?? "Failed to add department"); return; }
    setUnits((prev) => [...prev, body.data]);
    toast.success("Department added");
  }

  async function renameUnit(unitId: string, name: string) {
    const res = await fetch(`/api/org/units/${unitId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ name }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) { toast.error(body?.error?.message ?? "Failed to rename"); return; }
    setUnits((prev) => prev.map((u) => (u.id === unitId ? { ...u, name: body.data.name } : u)));
  }

  async function deleteUnit(unitId: string) {
    // Every descendant cascades server-side; drop them from local state too so the tree stays in sync.
    const idsToRemove = new Set([unitId]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const u of units) {
        if (u.parent_id && idsToRemove.has(u.parent_id) && !idsToRemove.has(u.id)) {
          idsToRemove.add(u.id);
          changed = true;
        }
      }
    }
    const res = await fetch(`/api/org/units/${unitId}`, { method: "DELETE", credentials: "same-origin" });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) { toast.error(body?.error?.message ?? "Failed to delete"); return; }
    setUnits((prev) => prev.filter((u) => !idsToRemove.has(u.id)));
    toast.success("Deleted");
  }

  async function addMember(unitId: string, userId: string, title: string, unitRole: UnitRole) {
    const res = await fetch(`/api/org/units/${unitId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ user_id: userId, title: title || null, unit_role: unitRole }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) { toast.error(body?.error?.message ?? "Failed to add member"); return; }
    setUnits((prev) => prev.map((u) => (u.id === unitId ? { ...u, members: [...u.members, body.data] } : u)));
    toast.success("Member added");
  }

  async function removeMember(unitId: string, userId: string) {
    const res = await fetch(`/api/org/units/${unitId}/members?user_id=${userId}`, { method: "DELETE", credentials: "same-origin" });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) { toast.error(body?.error?.message ?? "Failed to remove member"); return; }
    setUnits((prev) => prev.map((u) => (u.id === unitId ? { ...u, members: u.members.filter((m) => m.user_id !== userId) } : u)));
  }

  async function changeMemberRole(unitId: string, userId: string, unitRole: UnitRole) {
    const res = await fetch(`/api/org/units/${unitId}/members`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ user_id: userId, unit_role: unitRole }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) { toast.error(body?.error?.message ?? "Failed to update role"); return; }
    setUnits((prev) => prev.map((u) => (u.id === unitId
      ? { ...u, members: u.members.map((m) => (m.user_id === userId ? { ...m, unit_role: unitRole } : m)) }
      : u)));
    toast.success(`Role updated to ${UNIT_ROLE_LABEL[unitRole]}`);
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Org name header */}
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "var(--navy-l)" }}>
          <Building2 className="h-5 w-5" style={{ color: "var(--navy)" }} />
        </div>
        {editingName ? (
          <div className="flex items-center gap-2">
            <input
              ref={nameInputRef}
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveName()}
              className="h1 px-2 py-1 rounded-lg outline-none"
              style={{ background: "var(--panel-bg)", border: "1px solid var(--line)", color: "var(--ink)" }}
            />
            <button onClick={saveName} disabled={savingName} className="h-9 px-4 rounded-lg text-[13px] font-bold text-white" style={{ background: "var(--navy)" }}>
              {savingName ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
            </button>
            <button onClick={() => { setEditingName(false); setNameDraft(orgName); }} className="h-9 px-3 rounded-lg text-[13px] font-semibold" style={{ color: "var(--text-secondary)" }}>
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <h1 className="h1" style={{ color: "var(--ink)" }}>{orgName}</h1>
            {isAdmin && (
              <button onClick={() => setEditingName(true)} className="p-1.5 rounded-lg hover:bg-[var(--line-soft)]" style={{ color: "var(--text-muted)" }} title="Rename organization">
                <Pencil className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Chart */}
      <div className="rounded-xl p-6 overflow-x-auto" style={{ background: "var(--surface-bg)" }}>
        {rootUnits.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <p className="text-[14px] font-semibold" style={{ color: "var(--ink)" }}>No departments yet</p>
            <p className="text-[12px] max-w-xs" style={{ color: "var(--text-muted)" }}>
              {isAdmin ? "Add your first department to start building the org chart." : "The org chart hasn't been set up yet."}
            </p>
            {isAdmin && (
              <button
                onClick={() => setShowAddRoot(true)}
                className="flex items-center gap-1.5 h-9 px-4 rounded-lg text-[13px] font-bold text-white"
                style={{ background: "var(--navy)" }}
              >
                <Plus className="h-4 w-4" /> Add Department
              </button>
            )}
          </div>
        ) : (
          <>
            <ul className="org-chart-tree">
              {rootUnits.map((u) => (
                <OrgNode
                  key={u.id} unit={u} childrenMap={childrenMap} isAdmin={isAdmin} allProfiles={allProfiles}
                  onAddChild={(parentId, name) => addUnit(name, parentId)}
                  onAddMember={addMember}
                  onRemoveMember={removeMember}
                  onChangeRole={changeMemberRole}
                  onRename={renameUnit}
                  onDelete={deleteUnit}
                />
              ))}
            </ul>
            {isAdmin && (
              <div className="flex justify-center mt-6">
                <button
                  onClick={() => setShowAddRoot(true)}
                  className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12px] font-semibold"
                  style={{ background: "var(--navy-l)", color: "var(--navy)" }}
                >
                  <Plus className="h-3.5 w-3.5" /> Add Department
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <UnitDialog open={showAddRoot} onClose={() => setShowAddRoot(false)} title="Add department" onSubmit={(name) => addUnit(name, null)} />
    </div>
  );
}
