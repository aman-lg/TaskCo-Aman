-- Migration 010: Project membership
-- Run in Supabase SQL Editor after 009_handle_new_user_phone.sql

-- ─────────────────────────────────────────────
-- project_members table
-- ─────────────────────────────────────────────
CREATE TABLE public.project_members (
  project_id  uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  added_by    uuid NOT NULL REFERENCES public.profiles(id),
  added_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, user_id)
);
CREATE INDEX idx_project_members_user    ON public.project_members(user_id);
CREATE INDEX idx_project_members_project ON public.project_members(project_id);

-- ─────────────────────────────────────────────
-- Backfill: add every existing owner as member
-- ─────────────────────────────────────────────
INSERT INTO public.project_members (project_id, user_id, added_by)
SELECT id, owner_id, owner_id FROM public.projects
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────
-- Trigger: auto-add owner when a project is created
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.add_project_owner_as_member()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.project_members (project_id, user_id, added_by)
  VALUES (NEW.id, NEW.owner_id, NEW.owner_id)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_project_created_add_owner
  AFTER INSERT ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.add_project_owner_as_member();

-- ─────────────────────────────────────────────
-- RLS for project_members
-- ─────────────────────────────────────────────
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

-- Any member of a project can see who else is in it
CREATE POLICY pm_select ON public.project_members FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.project_members pm2
      WHERE pm2.project_id = project_members.project_id
        AND pm2.user_id = auth.uid()
    )
  );

-- Only project owner or admin can add members
CREATE POLICY pm_insert ON public.project_members FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.id = auth.uid() AND pr.is_admin = true)
  );

-- Owner or admin can remove; owner's own row is protected
CREATE POLICY pm_delete ON public.project_members FOR DELETE TO authenticated
  USING (
    (
      EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.owner_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.id = auth.uid() AND pr.is_admin = true)
    )
    AND user_id != (SELECT owner_id FROM public.projects WHERE id = project_id)
  );

-- ─────────────────────────────────────────────
-- Update projects SELECT: only members (or admin) see a project
-- ─────────────────────────────────────────────
DROP POLICY IF EXISTS projects_select ON public.projects;
CREATE POLICY projects_select ON public.projects FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = id AND pm.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles pr WHERE pr.id = auth.uid() AND pr.is_admin = true
    )
  );
