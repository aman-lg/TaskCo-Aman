-- ─────────────────────────────────────────────
-- Organizational chart: one company-wide org name, a self-referencing tree of
-- departments/sub-departments, and team members placed inside those units.
-- Viewable by everyone (it's the company's own structure, not private data);
-- editable by admins only, reusing the existing is_admin() flag rather than
-- building a new permissions system (out of scope per project conventions).
-- ─────────────────────────────────────────────

-- Singleton row — the classic "boolean primary key" trick guarantees exactly
-- one row can ever exist, so there's no ambiguity about "which organization".
create table public.org_settings (
  id         boolean primary key default true,
  name       text not null default 'My Organization',
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  constraint org_settings_singleton check (id)
);
insert into public.org_settings (id, name) values (true, 'My Organization');

create table public.org_units (
  id         uuid primary key default gen_random_uuid(),
  parent_id  uuid references public.org_units(id) on delete cascade,
  name       text not null,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);
create index idx_org_units_parent on public.org_units(parent_id);

create table public.org_unit_members (
  id        uuid primary key default gen_random_uuid(),
  unit_id   uuid not null references public.org_units(id) on delete cascade,
  user_id   uuid not null references public.profiles(id) on delete cascade,
  title     text,
  added_by  uuid not null references public.profiles(id),
  added_at  timestamptz not null default now(),
  unique (unit_id, user_id)
);
create index idx_org_unit_members_unit on public.org_unit_members(unit_id);
create index idx_org_unit_members_user on public.org_unit_members(user_id);

alter table public.org_settings enable row level security;
alter table public.org_units enable row level security;
alter table public.org_unit_members enable row level security;

create policy org_settings_select on public.org_settings for select to authenticated using (true);
create policy org_settings_update on public.org_settings for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy org_units_select on public.org_units for select to authenticated using (true);
create policy org_units_insert on public.org_units for insert to authenticated
  with check (public.is_admin() and created_by = auth.uid());
create policy org_units_update on public.org_units for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy org_units_delete on public.org_units for delete to authenticated
  using (public.is_admin());

create policy org_unit_members_select on public.org_unit_members for select to authenticated using (true);
create policy org_unit_members_insert on public.org_unit_members for insert to authenticated
  with check (public.is_admin() and added_by = auth.uid());
create policy org_unit_members_delete on public.org_unit_members for delete to authenticated
  using (public.is_admin());
