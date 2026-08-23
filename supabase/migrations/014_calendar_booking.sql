-- ─────────────────────────────────────────────
-- Google Calendar booking: public slot booking → host confirms → Meet link
-- ─────────────────────────────────────────────

alter type public.notification_type add value if not exists 'booking_request';

-- Public booking link slug, e.g. taskco.app/book/jane-d — auto-generated on
-- first visit to /meetings, shown to the host to share.
alter table public.profiles add column if not exists booking_slug text unique;

-- ─────────────────────────────────────────────
-- google_calendar_connections
-- Server/service-role access only — no RLS policies means the anon/authenticated
-- key can never read or write this table; only lib/supabase/admin.ts (server-side
-- API routes) touches it. Holds the OAuth refresh token used to call the
-- Calendar API on the host's behalf.
-- ─────────────────────────────────────────────
create table public.google_calendar_connections (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null unique references public.profiles(id) on delete cascade,
  refresh_token text not null,
  access_token  text,
  token_expiry  timestamptz,
  calendar_id   text not null default 'primary',
  google_email  text,
  connected_at  timestamptz not null default now(),
  updated_at    timestamptz
);
alter table public.google_calendar_connections enable row level security;

-- ─────────────────────────────────────────────
-- bookings
-- A visitor requests a slot on a host's public booking page (unauthenticated —
-- inserted via the service-role key from app/api/booking/[slug]/route.ts after
-- server-side validation, never directly by a client). The host then confirms
-- or declines from their own authenticated session.
-- ─────────────────────────────────────────────
create table public.bookings (
  id              uuid primary key default gen_random_uuid(),
  host_id         uuid not null references public.profiles(id) on delete cascade,
  requester_name  text not null,
  requester_email text not null,
  note            text,
  start_at        timestamptz not null,
  end_at          timestamptz not null,
  status          text not null default 'pending'
                    check (status in ('pending', 'confirmed', 'declined', 'cancelled')),
  google_event_id text,
  meet_link       text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz
);
create index idx_bookings_host        on public.bookings(host_id, start_at);
create index idx_bookings_host_status on public.bookings(host_id, status);

alter table public.bookings enable row level security;

-- Host reads/updates only their own bookings. No insert policy for
-- anon/authenticated — all inserts go through the service-role key.
create policy bookings_select_own on public.bookings
  for select using (host_id = auth.uid());

create policy bookings_update_own on public.bookings
  for update using (host_id = auth.uid());
