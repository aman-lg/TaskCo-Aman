-- ─────────────────────────────────────────────
-- Form Builder: generic Google-Forms-style forms, with an optional per-
-- question cadence tag (one_time/weekly/monthly/quarterly) and a built-in
-- "who is being rated" subject picker — the machinery behind periodic
-- employee performance reviews (captains rate their team, ratings roll up
-- weekly -> monthly -> quarterly), without forcing every form into that
-- mold. A plain form just never sets has_rating_subject or any question's
-- cadence and behaves like an ordinary one-off form.
--
-- Zero client RLS policies on all four tables — same "server/admin-mediated
-- only" pattern as youtube_connections/bookings, since visibility here
-- (published vs draft, admin vs filler vs anonymous) isn't a clean row
-- predicate. Every read/write goes through an API route.
-- ─────────────────────────────────────────────

create type public.form_question_type as enum
  ('text', 'numeric', 'single_select', 'multi_select', 'rating', 'upload');
create type public.form_cadence as enum ('one_time', 'weekly', 'monthly', 'quarterly');

create table public.forms (
  id                 uuid primary key default gen_random_uuid(),
  title              text not null,
  slug               text not null unique,
  description        text,
  requires_login     boolean not null default true,
  has_rating_subject boolean not null default false,
  is_published       boolean not null default false,
  created_by         uuid references public.profiles(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
alter table public.forms enable row level security;

create trigger trg_forms_updated_at
  before update on public.forms
  for each row execute function public.set_updated_at();

create table public.form_questions (
  id            uuid primary key default gen_random_uuid(),
  form_id       uuid not null references public.forms(id) on delete cascade,
  position      int not null default 0,
  label         text not null,
  question_type public.form_question_type not null,
  -- {options:string[]} for select types | {min?,max?} for numeric |
  -- {max_size_mb, allowed_mime?} for upload | {max:5} for rating
  config        jsonb not null default '{}',
  is_required   boolean not null default true,
  cadence       public.form_cadence,
  created_at    timestamptz not null default now()
);
alter table public.form_questions enable row level security;
create index idx_form_questions_form on public.form_questions(form_id);

create table public.form_responses (
  id              uuid primary key default gen_random_uuid(),
  form_id         uuid not null references public.forms(id) on delete cascade,
  subject_user_id uuid references public.profiles(id) on delete cascade,
  cadence         public.form_cadence,
  period_key      text,
  filler_user_id  uuid references public.profiles(id) on delete set null,
  filler_name     text not null,
  filler_email    text not null,
  filler_phone    text,
  submitted_at    timestamptz not null default now()
);
alter table public.form_responses enable row level security;
create index idx_form_responses_form on public.form_responses(form_id);

-- Resubmitting the same subject+cadence+period is an update-in-place
-- (upsert), same "correct this week's entry" UX as worklog_entries. Only
-- enforced when both a subject and a cadence apply — a plain form has no
-- natural dedup key and can legitimately be submitted many times.
create unique index form_responses_dedup on public.form_responses(form_id, subject_user_id, cadence, period_key)
  where subject_user_id is not null and cadence is not null;

create table public.form_answers (
  id                uuid primary key default gen_random_uuid(),
  response_id       uuid not null references public.form_responses(id) on delete cascade,
  question_id       uuid not null references public.form_questions(id) on delete cascade,
  value_text        text,
  value_number      numeric,
  value_options     text[],
  file_storage_path text,
  file_name         text,
  file_size         int,
  file_mime         text,
  unique (response_id, question_id)
);
alter table public.form_answers enable row level security;
create index idx_form_answers_response on public.form_answers(response_id);

insert into storage.buckets (id, name, public, file_size_limit)
values ('form-response-files', 'form-response-files', false, 26214400)
on conflict (id) do nothing;
