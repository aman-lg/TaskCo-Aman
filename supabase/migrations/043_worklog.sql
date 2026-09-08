-- ─────────────────────────────────────────────
-- Worklog: daily presence marking (WFH / office / on leave), one row per
-- user per IST calendar day. Deliberately separate from attendance_sessions
-- (the clock-in/out timer) — this is a self-reported status, not a timer.
-- "What was worked on" is NOT stored here: it's computed at read time from
-- activity_log's existing status_changed events, so there's nothing to keep
-- in sync and no second source of truth for task activity.
-- ─────────────────────────────────────────────

create type public.worklog_presence_type as enum ('wfh', 'wfo', 'leave_full', 'leave_half');

create table public.worklog_entries (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles(id) on delete cascade,
  ist_date       date not null,
  presence_type  public.worklog_presence_type not null,
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (user_id, ist_date)
);
alter table public.worklog_entries enable row level security;

-- Owner can read/write their own day. Admins can additionally read everyone's
-- — a deliberate, narrow exception to the usual "personal table = owner-only"
-- rule (see CLAUDE.md), approved specifically for presence/leave status.
-- attendance_sessions' own RLS is untouched by this migration: admins already
-- view clock-in/out times through app/api/admin/users/[id]/route.ts's
-- service-role client + withAdmin() gate at the API layer, not a DB policy.
create policy worklog_entries_select on public.worklog_entries
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

create policy worklog_entries_insert on public.worklog_entries
  for insert to authenticated
  with check (user_id = auth.uid());

create policy worklog_entries_update on public.worklog_entries
  for update to authenticated
  using (user_id = auth.uid());

create trigger trg_worklog_entries_updated_at
  before update on public.worklog_entries
  for each row execute function public.set_updated_at();
