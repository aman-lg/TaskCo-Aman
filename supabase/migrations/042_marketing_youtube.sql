-- ─────────────────────────────────────────────
-- Marketing / Social Media: YouTube channel connection + per-video stats.
-- Deliberately a SEPARATE connection from google_calendar_connections — that
-- one is strictly one-row-per-employee (their own calendar); a YouTube
-- channel is one company asset an admin connects once, org-wide.
-- ─────────────────────────────────────────────

-- Server/service-role access only — same "RLS enabled, zero policies" pattern
-- as google_calendar_connections: only lib/supabase/admin.ts (server-side API
-- routes) can ever read or write this table.
create table public.youtube_connections (
  id                    uuid primary key default gen_random_uuid(),
  channel_id            text not null,
  channel_title         text,
  channel_thumbnail_url text,
  access_token          text,
  refresh_token         text not null,
  token_expiry          timestamptz,
  connected_by          uuid references public.profiles(id) on delete set null,
  connected_at          timestamptz not null default now(),
  updated_at            timestamptz
);
alter table public.youtube_connections enable row level security;

-- Cached video metadata + latest-snapshot stats, upserted on every manual
-- sync (app/api/marketing/youtube/sync). No historical time-series — the
-- "best day/time to post" analysis correlates published_at against lifetime
-- totals, not day-by-day deltas. impressions/impressions_ctr are nullable:
-- YouTube Analytics doesn't have this data for every video (older videos,
-- Shorts, or anything that never appeared in suggested/home-feed placements)
-- — the UI renders "—" rather than treating null as zero.
create table public.youtube_videos (
  video_id          text primary key,
  title             text not null,
  description       text,
  published_at      timestamptz not null,
  thumbnail_url     text,
  duration_seconds  integer,
  tags              text[],
  category_name     text,
  views             bigint,
  likes             bigint,
  comments          bigint,
  shares            bigint,
  impressions       bigint,
  impressions_ctr   numeric,
  synced_at         timestamptz not null default now()
);
alter table public.youtube_videos enable row level security;

-- Admin-only visibility, enforced at the DB layer too (not just the page
-- gate and withAdmin() on the API routes) — matches this feature's
-- admin-only decision end to end.
create policy youtube_videos_select on public.youtube_videos
  for select to authenticated
  using (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

-- ─────────────────────────────────────────────
-- ai_insights gains a third scope for the Social Media AI analysis card —
-- same cache/TTL table and route, no project_id involved for this scope.
-- ─────────────────────────────────────────────
alter table public.ai_insights drop constraint if exists ai_insights_scope_check;
alter table public.ai_insights add constraint ai_insights_scope_check
  check (scope in ('dashboard', 'tasks', 'marketing_youtube'));
