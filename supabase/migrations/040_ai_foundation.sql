-- ─────────────────────────────────────────────
-- AI foundation: Gemini-backed "Ask Tasko" assistant, semantic search over
-- tasks/projects, and cached AI insights. See lib/ai/gemini.ts for the
-- model client and lib/ai/tools.ts for how these pieces fit together.
-- ─────────────────────────────────────────────

create extension if not exists vector;

-- ─────────────────────────────────────────────
-- ai_embeddings — one row per searchable chunk of team-visible content
-- (task/project name+description today). Populated best-effort on write by
-- lib/ai/embed.ts via the admin client; never written by the client directly.
-- Readable by any authenticated user, same as the tasks/projects it mirrors.
-- ─────────────────────────────────────────────
create table public.ai_embeddings (
  id            uuid        primary key default gen_random_uuid(),
  entity_type   text        not null check (entity_type in ('task', 'project')),
  entity_id     uuid        not null,
  project_id    uuid        references public.projects(id) on delete cascade,
  content       text        not null,
  embedding     vector(768) not null,
  updated_at    timestamptz not null default now(),
  unique (entity_type, entity_id)
);

create index idx_ai_embeddings_entity on public.ai_embeddings(entity_type, entity_id);
create index idx_ai_embeddings_vector on public.ai_embeddings using ivfflat (embedding vector_cosine_ops) with (lists = 100);

alter table public.ai_embeddings enable row level security;

create policy ai_embeddings_select on public.ai_embeddings
  for select to authenticated
  using (true);

-- Cosine-similarity search, called from lib/ai/tools.ts's semantic_search tool
-- via supabase.rpc("match_ai_embeddings", ...). security invoker so it still
-- runs under the caller's RLS (moot today since ai_embeddings is select-true
-- for all authenticated users, but keeps this correct if that ever narrows).
create function public.match_ai_embeddings(
  query_embedding vector(768),
  match_count int default 5,
  filter_project_id uuid default null
)
returns table (
  entity_type text,
  entity_id uuid,
  project_id uuid,
  content text,
  similarity float
)
language sql stable security invoker
as $$
  select entity_type, entity_id, project_id, content,
         1 - (embedding <=> query_embedding) as similarity
  from public.ai_embeddings
  where filter_project_id is null or project_id = filter_project_id
  order by embedding <=> query_embedding
  limit match_count;
$$;

-- ─────────────────────────────────────────────
-- ai_actions — a proposed write (create/update task, assign, etc.) that Ask
-- Tasko wants to perform, awaiting the user's explicit confirmation. Never
-- inserted by the client — only by the server (ai-reply route) via the
-- admin client; only the owning user may read/resolve their own proposals.
-- ─────────────────────────────────────────────
create table public.ai_actions (
  id               uuid        primary key default gen_random_uuid(),
  message_id       uuid        references public.messages(id) on delete cascade,
  conversation_id  uuid        not null references public.conversations(id) on delete cascade,
  user_id          uuid        not null references public.profiles(id) on delete cascade,
  action_type      text        not null,
  payload          jsonb       not null,
  status           text        not null default 'pending'
                               check (status in ('pending', 'confirmed', 'cancelled', 'executed', 'failed')),
  result           jsonb,
  created_at       timestamptz not null default now(),
  resolved_at      timestamptz
);

create index idx_ai_actions_user on public.ai_actions(user_id);
create index idx_ai_actions_message on public.ai_actions(message_id);

alter table public.ai_actions enable row level security;

create policy ai_actions_select on public.ai_actions
  for select to authenticated
  using (user_id = auth.uid());

create policy ai_actions_update on public.ai_actions
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ─────────────────────────────────────────────
-- ai_insights — cached Gemini-generated summaries for the Smart Tasks page
-- and Dashboard, regenerated on demand with a TTL enforced in the API route
-- (not here) so opening a page never itself triggers a Gemini call. Written
-- only by the server; team-readable like the data it summarizes.
-- ─────────────────────────────────────────────
create table public.ai_insights (
  id            uuid        primary key default gen_random_uuid(),
  scope         text        not null check (scope in ('dashboard', 'tasks')),
  project_id    uuid        references public.projects(id) on delete cascade,
  content       text        not null,
  generated_at  timestamptz not null default now()
);

create unique index idx_ai_insights_scope on public.ai_insights(scope, coalesce(project_id, '00000000-0000-0000-0000-000000000000'::uuid));

alter table public.ai_insights enable row level security;

create policy ai_insights_select on public.ai_insights
  for select to authenticated
  using (true);

-- ─────────────────────────────────────────────
-- Ask Tasko rides the existing chat pipeline: a new conversations.type
-- ('ai', sibling to the existing 'self' "My Notes" singleton) and a new
-- messages.type ('ai_action', the confirm/cancel card).
-- ─────────────────────────────────────────────
alter table public.conversations drop constraint if exists conversations_type_check;
alter table public.conversations add constraint conversations_type_check
  check (type in ('direct', 'group', 'self', 'ai'));

create unique index idx_conv_ai_per_user on public.conversations(created_by) where type = 'ai';

alter table public.messages drop constraint if exists messages_type_check;
alter table public.messages add constraint messages_type_check
  check (type in ('text','image','video','audio','voice_note','document','sticker','gif','poll','system','contact','call','ai_action'));
