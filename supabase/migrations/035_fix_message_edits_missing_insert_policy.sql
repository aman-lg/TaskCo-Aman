-- ─────────────────────────────────────────────
-- message_edits has RLS enabled and a SELECT policy, but no INSERT policy
-- was ever created for it — with RLS enabled and no matching policy, every
-- insert is denied by default. The PATCH /api/chat/messages/[id] route
-- writes the previous content here before applying an edit, but never
-- checked that insert's result, so this has been silently failing since
-- the feature was built: editing a message has always worked, but its
-- "previous version" history has never actually been saved. Found while
-- live-testing the edit flow end to end, not from reading the policy list.
-- ─────────────────────────────────────────────

create policy edit_insert on public.message_edits for insert to authenticated
  with check (
    exists (
      select 1 from public.messages m
      where m.id = message_id and m.sender_id = auth.uid()
    )
  );
