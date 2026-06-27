-- Migration 002: Tables + Indexes
-- Run order: after 001_enums.sql

-- ─────────────────────────────────────────────
-- profiles (1:1 with auth.users)
-- ─────────────────────────────────────────────
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  avatar_url  text,
  email       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz
);

-- ─────────────────────────────────────────────
-- projects
-- ─────────────────────────────────────────────
create table public.projects (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text,
  start_date  date,
  end_date    date,
  deadline    timestamptz,
  urgency     public.urgency_level  not null default 'medium',
  status      public.project_status not null default 'active',
  color       text,
  owner_id    uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz
);
create index idx_projects_owner on public.projects(owner_id);

-- ─────────────────────────────────────────────
-- tasks
-- ─────────────────────────────────────────────
create table public.tasks (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  name        text not null,
  description text,
  start_date  timestamptz,
  end_date    timestamptz,
  deadline    timestamptz,
  urgency     public.urgency_level not null default 'medium',
  status      public.task_status   not null default 'todo',
  color       text,
  created_by  uuid not null references public.profiles(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz
);
create index idx_tasks_project on public.tasks(project_id);
create index idx_tasks_creator on public.tasks(created_by);
create index idx_tasks_status  on public.tasks(status);

-- ─────────────────────────────────────────────
-- task_assignees (multi-assignee; UI defaults to single in v1)
-- ─────────────────────────────────────────────
create table public.task_assignees (
  task_id     uuid not null references public.tasks(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  assigned_by uuid not null references public.profiles(id),
  assigned_at timestamptz not null default now(),
  primary key (task_id, user_id)
);
create index idx_assignees_user on public.task_assignees(user_id);

-- ─────────────────────────────────────────────
-- task_checklist_items
-- ─────────────────────────────────────────────
create table public.task_checklist_items (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references public.tasks(id) on delete cascade,
  content    text not null,
  is_done    boolean not null default false,
  position   int not null default 0,
  created_at timestamptz not null default now()
);
create index idx_checklist_task on public.task_checklist_items(task_id);

-- ─────────────────────────────────────────────
-- task_links (doc URLs only — no file uploads)
-- ─────────────────────────────────────────────
create table public.task_links (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references public.tasks(id) on delete cascade,
  label      text,
  url        text not null,
  created_at timestamptz not null default now()
);
create index idx_links_task on public.task_links(task_id);

-- ─────────────────────────────────────────────
-- task_time_entries (effort clock; overlapping allowed)
-- ─────────────────────────────────────────────
create table public.task_time_entries (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references public.tasks(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  started_at timestamptz not null,
  ended_at   timestamptz,
  note       text,
  created_at timestamptz not null default now()
);
create index idx_time_task on public.task_time_entries(task_id);
create index idx_time_user on public.task_time_entries(user_id);

-- ─────────────────────────────────────────────
-- attendance_sessions (hours clock; one open per user)
-- ─────────────────────────────────────────────
create table public.attendance_sessions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  check_in_at  timestamptz not null,
  check_out_at timestamptz,
  ist_date     date not null,
  created_at   timestamptz not null default now()
);
create index idx_attend_user_date on public.attendance_sessions(user_id, ist_date);
create unique index one_open_session_per_user
  on public.attendance_sessions(user_id) where check_out_at is null;

-- ─────────────────────────────────────────────
-- calendar_events (full timeslot; recurrence-ready, single-event v1)
-- ─────────────────────────────────────────────
create table public.calendar_events (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references public.profiles(id) on delete cascade,
  title                text not null,
  description          text,
  start_at             timestamptz not null,
  end_at               timestamptz not null,
  all_day              boolean not null default false,
  color                text,
  location             text,
  task_id              uuid references public.tasks(id) on delete set null,
  rrule                text,
  recurrence_parent_id uuid references public.calendar_events(id) on delete cascade,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz
);
create index idx_events_user_start on public.calendar_events(user_id, start_at);

-- ─────────────────────────────────────────────
-- notifications
-- ─────────────────────────────────────────────
create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  type        public.notification_type not null,
  title       text not null,
  body        text,
  entity_type text,
  entity_id   uuid,
  is_read     boolean not null default false,
  email_sent  boolean not null default false,
  created_at  timestamptz not null default now()
);
create index idx_notif_user_read    on public.notifications(user_id, is_read);
create index idx_notif_email_pending on public.notifications(email_sent) where email_sent = false;

-- ─────────────────────────────────────────────
-- activity_log (trigger-written; no client writes)
-- ─────────────────────────────────────────────
create table public.activity_log (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid not null references public.profiles(id),
  action      text not null,
  entity_type text not null,
  entity_id   uuid not null,
  project_id  uuid references public.projects(id) on delete cascade,
  metadata    jsonb,
  created_at  timestamptz not null default now()
);
create index idx_activity_project on public.activity_log(project_id, created_at desc);
create index idx_activity_time    on public.activity_log(created_at desc);
