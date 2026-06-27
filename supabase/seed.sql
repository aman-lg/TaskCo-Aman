-- Seed data for development
-- Run AFTER migrations 001–005 and AFTER creating auth users via Supabase Auth
-- Replace the UUIDs below with real user IDs from auth.users

-- Example: insert seed data once you have at least one registered user.
-- The trigger handle_new_user() automatically creates profiles on signup,
-- so you only need to seed projects/tasks for testing.

-- Sample project (replace owner_id with a real user UUID after signup)
/*
insert into public.projects (title, description, urgency, status, owner_id)
values
  ('Website Redesign', 'Full redesign of the company website', 'high', 'active', '<your-user-uuid>'),
  ('Mobile App MVP',   'Internal productivity app MVP',        'urgent', 'active', '<your-user-uuid>'),
  ('Q3 Marketing',     'Marketing campaign for Q3 2026',       'medium', 'on_hold', '<your-user-uuid>');
*/

-- After seeding projects, add tasks referencing the inserted project IDs:
/*
insert into public.tasks (project_id, name, urgency, status, created_by)
values
  ('<project-uuid>', 'Design homepage mockup',   'high',   'todo',        '<your-user-uuid>'),
  ('<project-uuid>', 'Set up CI/CD pipeline',    'urgent', 'in_progress', '<your-user-uuid>'),
  ('<project-uuid>', 'Write API documentation',  'medium', 'done',        '<your-user-uuid>');
*/
