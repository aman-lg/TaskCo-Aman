-- Migration 008: Add phone field to profiles + RLS for admin attendance view

-- Add phone column
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone text;

-- Allow admins to read all attendance sessions
DROP POLICY IF EXISTS attend_all ON public.attendance_sessions;

CREATE POLICY attend_select ON public.attendance_sessions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY attend_insert ON public.attendance_sessions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY attend_update ON public.attendance_sessions
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY attend_delete ON public.attendance_sessions
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());
