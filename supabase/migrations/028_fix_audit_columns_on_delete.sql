-- ─────────────────────────────────────────────
-- project_files.added_by, org_units.created_by, and org_unit_members.added_by
-- were all declared "references profiles(id)" with no ON DELETE action, which
-- defaults to NO ACTION/RESTRICT. Live testing just proved this actually
-- blocks deleting a user: reproduced directly — "update or delete on table
-- profiles violates foreign key constraint project_files_added_by_fkey" —
-- deleting ANY user who ever uploaded a project file (even to a project they
-- don't own) fails the whole admin delete-user flow.
--
-- These are audit/attribution columns, not ownership columns — the
-- department, membership placement, or uploaded document should survive its
-- creator being removed from the org; only the "who did this" attribution
-- should go away. Fix: make them nullable and ON DELETE SET NULL.
-- ─────────────────────────────────────────────

alter table public.project_files alter column added_by drop not null;
alter table public.project_files drop constraint project_files_added_by_fkey;
alter table public.project_files add constraint project_files_added_by_fkey
  foreign key (added_by) references public.profiles(id) on delete set null;

alter table public.org_units alter column created_by drop not null;
alter table public.org_units drop constraint org_units_created_by_fkey;
alter table public.org_units add constraint org_units_created_by_fkey
  foreign key (created_by) references public.profiles(id) on delete set null;

alter table public.org_unit_members alter column added_by drop not null;
alter table public.org_unit_members drop constraint org_unit_members_added_by_fkey;
alter table public.org_unit_members add constraint org_unit_members_added_by_fkey
  foreign key (added_by) references public.profiles(id) on delete set null;
