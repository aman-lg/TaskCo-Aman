-- Migration 012: Fix conversation_members SELECT policy + self-conv unique index
-- Run this in Supabase SQL Editor if you already ran 011_chat.sql
-- (If you haven't run 011 yet, this is already included — skip this file)

-- Fix: cm_select was too restrictive — users couldn't see their OWN member rows
-- on first load before is_conversation_member resolved (RLS bootstrap issue).
DROP POLICY IF EXISTS cm_select ON public.conversation_members;
CREATE POLICY cm_select ON public.conversation_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_conversation_member(conversation_id));

-- Add unique constraint: one self-conversation per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_conv_self_per_user
  ON public.conversations(created_by) WHERE type = 'self';
