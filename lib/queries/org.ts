import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types";

type Client = SupabaseClient<Database>;

export interface UserDepartment {
  department: string;
  subDepartment: string | null;
}

// A unit with no parent IS a department; a unit with a parent is a
// sub-department nested under it (see 027_org_chart.sql — org_units is a
// self-referencing tree, parent_id nullable). A user can technically belong
// to more than one unit (org_unit_members has no per-user uniqueness beyond
// (unit_id, user_id)) — mirrors getTitlesByUserId's convention of picking
// the most recently-added membership as "the" one to display.
export async function getDepartmentsByUserId(
  supabase: Client,
  userIds: string[]
): Promise<Map<string, UserDepartment>> {
  if (userIds.length === 0) return new Map();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: memberRows } = await (supabase as any)
    .from("org_unit_members")
    .select("user_id, added_at, unit:org_units!unit_id(id, name, parent_id)")
    .in("user_id", userIds)
    .order("added_at", { ascending: false });

  type Row = { user_id: string; unit: { id: string; name: string; parent_id: string | null } | null };
  const rows = (memberRows ?? []) as Row[];

  const chosenByUser = new Map<string, Row>();
  for (const row of rows) {
    if (!row.unit) continue;
    if (!chosenByUser.has(row.user_id)) chosenByUser.set(row.user_id, row);
  }

  const parentIds = Array.from(
    new Set(Array.from(chosenByUser.values()).map((r) => r.unit!.parent_id).filter((id): id is string => !!id))
  );

  const parentNameById = new Map<string, string>();
  if (parentIds.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: parents } = await (supabase as any).from("org_units").select("id, name").in("id", parentIds);
    for (const p of (parents ?? []) as { id: string; name: string }[]) parentNameById.set(p.id, p.name);
  }

  const result = new Map<string, UserDepartment>();
  for (const [userId, row] of chosenByUser) {
    const unit = row.unit!;
    if (unit.parent_id) {
      result.set(userId, { department: parentNameById.get(unit.parent_id) ?? unit.name, subDepartment: unit.name });
    } else {
      result.set(userId, { department: unit.name, subDepartment: null });
    }
  }
  return result;
}

export interface OrgUnitMatch {
  id: string;
  name: string;
  parentName: string | null;
}

// Used by Ask Tasko's find_department tool to resolve a typed name to a
// real unit before assigning anyone to it.
export async function findOrgUnits(supabase: Client, query: string): Promise<OrgUnitMatch[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from("org_units")
    .select("id, name, parent:org_units!parent_id(name)")
    .ilike("name", `%${query}%`)
    .limit(8);
  return ((data ?? []) as { id: string; name: string; parent: { name: string } | null }[]).map((u) => ({
    id: u.id,
    name: u.name,
    parentName: u.parent?.name ?? null,
  }));
}

// All members of a unit AND every unit nested under it (a "department"
// covers its sub-departments too) — bounded-depth BFS rather than a
// recursive SQL function, since in practice this tree is only ever a
// couple of levels deep.
export async function getUsersInUnitTree(
  supabase: Client,
  rootUnitId: string
): Promise<{ id: string; full_name: string | null }[]> {
  const unitIds = [rootUnitId];
  let frontier = [rootUnitId];
  for (let depth = 0; depth < 5 && frontier.length > 0; depth++) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: children } = await (supabase as any).from("org_units").select("id").in("parent_id", frontier);
    const childIds = ((children ?? []) as { id: string }[]).map((c) => c.id);
    if (childIds.length === 0) break;
    unitIds.push(...childIds);
    frontier = childIds;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: members } = await (supabase as any)
    .from("org_unit_members")
    .select("user_id, profile:profiles!user_id(id, full_name)")
    .in("unit_id", unitIds);

  const byId = new Map<string, { id: string; full_name: string | null }>();
  for (const m of (members ?? []) as { profile: { id: string; full_name: string | null } | null }[]) {
    if (m.profile) byId.set(m.profile.id, m.profile);
  }
  return Array.from(byId.values());
}
