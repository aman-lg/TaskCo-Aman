-- ─────────────────────────────────────────────
-- 028 fixed this pattern for the three tables added this session
-- (project_files, org_units, org_unit_members), but a live test just proved
-- the SAME pre-existing defect blocks deleting any REAL team member who has
-- ever done normal work in the app: activity_log.actor_id has no ON DELETE
-- action, and every authenticated project/task create/update/delete writes
-- one via log_activity() — so admin delete-user has always 500'd for any
-- account with real activity history, not just synthetic test accounts
-- (earlier verification missed this because it inserted via the service-role
-- client, which has no auth.uid() and — thanks to 025 — is exactly the case
-- log_activity() now skips logging for, so no activity_log row was ever
-- created in those tests).
--
-- Same audit-column pattern, same fix, applied to every remaining place it
-- exists: the record survives, only the "who did this" attribution nulls out.
-- (project_members.user_id, task_assignees.user_id, and everything's *_id
-- ownership/subject columns already cascade correctly — this is only the
-- "who performed the action" columns.)
-- ─────────────────────────────────────────────

alter table public.activity_log alter column actor_id drop not null;
alter table public.activity_log drop constraint activity_log_actor_id_fkey;
alter table public.activity_log add constraint activity_log_actor_id_fkey
  foreign key (actor_id) references public.profiles(id) on delete set null;

alter table public.tasks alter column created_by drop not null;
alter table public.tasks drop constraint tasks_created_by_fkey;
alter table public.tasks add constraint tasks_created_by_fkey
  foreign key (created_by) references public.profiles(id) on delete set null;

alter table public.task_assignees alter column assigned_by drop not null;
alter table public.task_assignees drop constraint task_assignees_assigned_by_fkey;
alter table public.task_assignees add constraint task_assignees_assigned_by_fkey
  foreign key (assigned_by) references public.profiles(id) on delete set null;

alter table public.project_members alter column added_by drop not null;
alter table public.project_members drop constraint project_members_added_by_fkey;
alter table public.project_members add constraint project_members_added_by_fkey
  foreign key (added_by) references public.profiles(id) on delete set null;

alter table public.org_settings drop constraint org_settings_updated_by_fkey;
alter table public.org_settings add constraint org_settings_updated_by_fkey
  foreign key (updated_by) references public.profiles(id) on delete set null;
