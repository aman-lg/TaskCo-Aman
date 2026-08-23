-- ─────────────────────────────────────────────
-- Fix: creating any conversation (including the auto-created "My Notes"
-- self-conversation) always failed with a row-level security error.
--
-- Diagnosed with a disposable throwaway test account: an authenticated user
-- inserting their own row into public.conversations (created_by = auth.uid())
-- was denied by RLS, while the exact same pattern on conversation_members
-- worked correctly — proving auth/JWT/role resolution is fine in general and
-- isolating the problem to conversations' own INSERT policy specifically,
-- which had drifted from its intended definition in the live database.
--
-- Fix: re-assert all four conversations policies to their correct definition.
-- Safe to run regardless of the exact original cause.
-- ─────────────────────────────────────────────

drop policy if exists conv_select on public.conversations;
drop policy if exists conv_insert on public.conversations;
drop policy if exists conv_update on public.conversations;
drop policy if exists conv_delete on public.conversations;

create policy conv_select on public.conversations for select to authenticated
  using (public.is_conversation_member(id));

create policy conv_insert on public.conversations for insert to authenticated
  with check (created_by = auth.uid());

create policy conv_update on public.conversations for update to authenticated
  using (
    exists (select 1 from public.conversation_members
            where conversation_id = id and user_id = auth.uid() and role in ('owner','admin'))
  );

create policy conv_delete on public.conversations for delete to authenticated
  using (created_by = auth.uid());
