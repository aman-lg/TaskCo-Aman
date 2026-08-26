-- ─────────────────────────────────────────────
-- The application-level fix in the DELETE route now correctly restricts the
-- owner/admin "delete for everyone" override to group conversations only —
-- but msg_update's RLS policy still allowed a DM's owner (every conversation
-- gets one, direct or not) to update ANY message in that conversation at the
-- database level. That's the only thing stopping someone from bypassing the
-- Next.js route entirely (browser devtools + the public anon key) and
-- deleting the other participant's DM messages directly. Tighten the DB
-- policy to match, for real defense in depth rather than relying solely on
-- the application layer.
-- ─────────────────────────────────────────────

create or replace function public.is_group_moderator(check_conversation_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.conversations c
    join public.conversation_members cm on cm.conversation_id = c.id
    where c.id = check_conversation_id
      and c.type = 'group'
      and cm.user_id = auth.uid()
      and cm.role in ('owner', 'admin')
  );
$$;

drop policy if exists msg_update on public.messages;
create policy msg_update on public.messages for update to authenticated
  using (
    sender_id = auth.uid()
    or public.is_group_moderator(conversation_id)
  );
