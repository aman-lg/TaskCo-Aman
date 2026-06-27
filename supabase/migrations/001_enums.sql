-- Migration 001: Enums
-- Run order: first (no dependencies)

create type public.urgency_level as enum ('low', 'medium', 'high', 'urgent');
create type public.project_status as enum ('active', 'on_hold', 'completed', 'archived');
create type public.task_status as enum ('todo', 'in_progress', 'done');
create type public.notification_type as enum (
  'task_assigned',
  'task_due_soon',
  'task_status_changed',
  'project_due_soon',
  'mention'
);
