# Database Reference

TaskCo uses Supabase Postgres. All tables have Row Level Security enabled. Schema is managed by migrations in `supabase/migrations/`.

---

## Enums (`001_enums.sql`)

| Enum | Values |
|---|---|
| `urgency_level` | `low`, `medium`, `high`, `urgent` |
| `project_status` | `active`, `on_hold`, `completed`, `archived` |
| `task_status` | `todo`, `in_progress`, `done` |
| `notification_type` | `task_assigned`, `task_due_soon`, `task_status_changed`, `project_due_soon`, `mention` |

---

## Tables (`002_tables.sql`)

### `profiles`

One row per Supabase Auth user. Populated automatically on signup via the `on_auth_user_created` trigger.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | References `auth.users(id)`, cascades on delete |
| `full_name` | `text` | Nullable |
| `avatar_url` | `text` | Nullable; must be a Supabase Storage URL |
| `email` | `text` | Mirrored from `auth.users` on creation |
| `created_at` | `timestamptz` | Default `now()` |
| `updated_at` | `timestamptz` | Maintained by `trg_profiles_updated` trigger |

---

### `projects`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | `gen_random_uuid()` |
| `title` | `text NOT NULL` | |
| `description` | `text` | Nullable |
| `start_date` | `date` | Nullable |
| `end_date` | `date` | Nullable |
| `deadline` | `timestamptz` | Nullable |
| `urgency` | `urgency_level NOT NULL` | Default `medium` |
| `status` | `project_status NOT NULL` | Default `active` |
| `color` | `text` | Nullable; hex color string |
| `owner_id` | `uuid NOT NULL` | FK → `profiles(id)`, cascade delete |
| `created_at` | `timestamptz NOT NULL` | Default `now()` |
| `updated_at` | `timestamptz` | Maintained by `trg_projects_updated` |

Indexes: `idx_projects_owner` on `(owner_id)`.

---

### `tasks`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | `gen_random_uuid()` |
| `project_id` | `uuid NOT NULL` | FK → `projects(id)`, cascade delete |
| `name` | `text NOT NULL` | |
| `description` | `text` | Nullable |
| `start_date` | `timestamptz` | Nullable |
| `end_date` | `timestamptz` | Nullable |
| `deadline` | `timestamptz` | Nullable |
| `urgency` | `urgency_level NOT NULL` | Default `medium` |
| `status` | `task_status NOT NULL` | Default `todo` |
| `color` | `text` | Nullable; hex color string |
| `created_by` | `uuid NOT NULL` | FK → `profiles(id)` |
| `created_at` | `timestamptz NOT NULL` | Default `now()` |
| `updated_at` | `timestamptz` | Maintained by `trg_tasks_updated` |

Indexes: `idx_tasks_project` on `(project_id)`, `idx_tasks_creator` on `(created_by)`, `idx_tasks_status` on `(status)`.

---

### `task_assignees`

Junction table for task-to-user assignments. The schema supports multiple assignees; v1 UI defaults to single assignee.

| Column | Type | Notes |
|---|---|---|
| `task_id` | `uuid NOT NULL` | FK → `tasks(id)`, cascade delete; part of composite PK |
| `user_id` | `uuid NOT NULL` | FK → `profiles(id)`, cascade delete; part of composite PK |
| `assigned_by` | `uuid NOT NULL` | FK → `profiles(id)` |
| `assigned_at` | `timestamptz NOT NULL` | Default `now()` |

Primary key: `(task_id, user_id)`. Index: `idx_assignees_user` on `(user_id)`.

---

### `task_checklist_items`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | `gen_random_uuid()` |
| `task_id` | `uuid NOT NULL` | FK → `tasks(id)`, cascade delete |
| `content` | `text NOT NULL` | |
| `is_done` | `boolean NOT NULL` | Default `false` |
| `position` | `int NOT NULL` | Default `0`; used for ordering |
| `created_at` | `timestamptz NOT NULL` | Default `now()` |

Index: `idx_checklist_task` on `(task_id)`.

---

### `task_links`

Document URL links attached to tasks. File uploads are out of scope for v1; only URLs are stored.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | `gen_random_uuid()` |
| `task_id` | `uuid NOT NULL` | FK → `tasks(id)`, cascade delete |
| `label` | `text` | Nullable |
| `url` | `text NOT NULL` | |
| `created_at` | `timestamptz NOT NULL` | Default `now()` |

Index: `idx_links_task` on `(task_id)`.

---

### `task_time_entries`

Effort clock per task. Overlapping entries are allowed. **Do not sum these for "hours worked"** — use `attendance_sessions` instead.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | `gen_random_uuid()` |
| `task_id` | `uuid NOT NULL` | FK → `tasks(id)`, cascade delete |
| `user_id` | `uuid NOT NULL` | FK → `profiles(id)`, cascade delete |
| `started_at` | `timestamptz NOT NULL` | |
| `ended_at` | `timestamptz` | Nullable; null means the timer is running |
| `note` | `text` | Nullable |
| `created_at` | `timestamptz NOT NULL` | Default `now()` |

Indexes: `idx_time_task` on `(task_id)`, `idx_time_user` on `(user_id)`.

---

### `attendance_sessions`

Working hours clock. Only one open session (where `check_out_at IS NULL`) is permitted per user at a time, enforced by a unique partial index.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | `gen_random_uuid()` |
| `user_id` | `uuid NOT NULL` | FK → `profiles(id)`, cascade delete |
| `check_in_at` | `timestamptz NOT NULL` | |
| `check_out_at` | `timestamptz` | Nullable; null means session is open |
| `ist_date` | `date NOT NULL` | Calendar date in IST (Asia/Kolkata) at clock-in time |
| `created_at` | `timestamptz NOT NULL` | Default `now()` |

Indexes: `idx_attend_user_date` on `(user_id, ist_date)`.

Unique partial index: `one_open_session_per_user` on `(user_id) WHERE check_out_at IS NULL` — prevents duplicate open sessions.

**`ist_date` convention**: computed server-side at clock-in using `Asia/Kolkata` timezone so that sessions are always grouped by the correct Indian calendar date regardless of the Postgres server's system timezone.

---

### `calendar_events`

Personal calendar events. The schema is recurrence-ready (`rrule`, `recurrence_parent_id`) but recurrence UI is out of scope for v1.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | `gen_random_uuid()` |
| `user_id` | `uuid NOT NULL` | FK → `profiles(id)`, cascade delete |
| `title` | `text NOT NULL` | |
| `description` | `text` | Nullable |
| `start_at` | `timestamptz NOT NULL` | |
| `end_at` | `timestamptz NOT NULL` | |
| `all_day` | `boolean NOT NULL` | Default `false` |
| `color` | `text` | Nullable |
| `location` | `text` | Nullable |
| `task_id` | `uuid` | Nullable FK → `tasks(id)`, set null on delete |
| `rrule` | `text` | Nullable; recurrence rule string (v1 unused) |
| `recurrence_parent_id` | `uuid` | Nullable self-FK → `calendar_events(id)`, cascade delete |
| `created_at` | `timestamptz NOT NULL` | Default `now()` |
| `updated_at` | `timestamptz` | Maintained by `trg_events_updated` |

Index: `idx_events_user_start` on `(user_id, start_at)`.

---

### `notifications`

System notifications generated by database triggers (e.g., task assignment). No client INSERT path — notifications are created by trigger functions with `SECURITY DEFINER`.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | `gen_random_uuid()` |
| `user_id` | `uuid NOT NULL` | FK → `profiles(id)`, cascade delete |
| `type` | `notification_type NOT NULL` | |
| `title` | `text NOT NULL` | |
| `body` | `text` | Nullable |
| `entity_type` | `text` | Nullable; e.g., `"task"`, `"project"` |
| `entity_id` | `uuid` | Nullable; ID of the related entity |
| `is_read` | `boolean NOT NULL` | Default `false` |
| `email_sent` | `boolean NOT NULL` | Default `false` |
| `created_at` | `timestamptz NOT NULL` | Default `now()` |

Indexes: `idx_notif_user_read` on `(user_id, is_read)`, `idx_notif_email_pending` on `(email_sent) WHERE email_sent = false`.

---

### `activity_log`

Append-only audit log. Written exclusively by database triggers — there is no client or API write path. All authenticated users can read it (team-read RLS).

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | `gen_random_uuid()` |
| `actor_id` | `uuid NOT NULL` | FK → `profiles(id)` |
| `action` | `text NOT NULL` | See trigger section for possible values |
| `entity_type` | `text NOT NULL` | `project`, `task`, `task_assignee`, `checklist_item` |
| `entity_id` | `uuid NOT NULL` | |
| `project_id` | `uuid` | Nullable FK → `projects(id)`, cascade delete |
| `metadata` | `jsonb` | Contextual data (e.g., old/new status) |
| `created_at` | `timestamptz NOT NULL` | Default `now()` |

Indexes: `idx_activity_project` on `(project_id, created_at DESC)`, `idx_activity_time` on `(created_at DESC)`.

---

## Key Relationships

```
auth.users
    └── profiles (1:1, cascade delete)
            ├── projects (many; owner_id)
            │       └── tasks (many; project_id)
            │               ├── task_assignees (many-to-many: tasks × profiles)
            │               ├── task_checklist_items (many)
            │               ├── task_links (many)
            │               └── task_time_entries (many)
            ├── attendance_sessions (many)
            ├── calendar_events (many)
            │       └── (optional) task_id → tasks
            ├── notifications (many)
            └── activity_log (many; as actor_id)
```

---

## RLS Policies (`004_rls.sql`)

| Table | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `profiles` | Any authenticated user | — | Owner only (`id = auth.uid()`) | — |
| `projects` | Any authenticated user | Owner only (`owner_id = auth.uid()`) | Owner only | Owner only |
| `tasks` | Any authenticated user | Creator only (`created_by = auth.uid()`) | Creator or assignee (`is_task_collaborator()`) | Creator only |
| `task_assignees` | Any authenticated user | Caller sets `assigned_by` | — | Assigner or assignee |
| `task_checklist_items` | Any authenticated user | Task collaborator | Task collaborator | Task collaborator |
| `task_links` | Any authenticated user | Task collaborator | Task collaborator | Task collaborator |
| `task_time_entries` | Any authenticated user | Owner only (`user_id = auth.uid()`) | Owner only | Owner only |
| `attendance_sessions` | Owner only | Owner only | Owner only | Owner only |
| `calendar_events` | Owner only | Owner only | Owner only | Owner only |
| `notifications` | Owner only | — (trigger only) | Owner only | Owner only |
| `activity_log` | Any authenticated user | — (trigger only) | — | — |

The helper function `public.is_task_collaborator(p_task_id uuid)` returns `true` if the calling user is the task's `created_by` or appears in `task_assignees` for that task.

---

## Functions and Triggers (`003_functions_triggers.sql`, `006_checklist_activity.sql`)

### `handle_new_user()` / `on_auth_user_created`

Fires AFTER INSERT on `auth.users`. Inserts a corresponding row in `public.profiles`, copying `id`, `email`, and `raw_user_meta_data->>'full_name'`.

### `set_updated_at()` / `trg_*_updated`

Fires BEFORE UPDATE on `profiles`, `projects`, `tasks`, and `calendar_events`. Sets `new.updated_at = now()`.

### `is_task_collaborator(p_task_id uuid) → boolean`

`SECURITY DEFINER`, `STABLE`. Returns true if `auth.uid()` is the task creator or an assignee. Used in RLS policies for tasks, checklist items, and links.

### `notify_task_assigned()` / `trg_notify_task_assigned`

Fires AFTER INSERT on `task_assignees`. Inserts a `task_assigned` notification row for the newly assigned user.

### `log_activity()` / `trg_log_projects`, `trg_log_tasks`, `trg_log_task_assignees`, `trg_log_checklist_items`

`SECURITY DEFINER`. Fires AFTER INSERT/UPDATE/DELETE on `projects`, `tasks`, `task_assignees`, and `task_checklist_items`. Writes a row to `activity_log` with the actor (`auth.uid()`), action, entity type/ID, project ID, and relevant metadata (e.g., old and new status for `status_changed` events).

Possible `action` values:

| Action | Trigger condition |
|---|---|
| `created` | INSERT on projects, tasks, checklist items |
| `updated` | UPDATE (non-status field) on projects or tasks |
| `deleted` | DELETE on projects, tasks, checklist items |
| `status_changed` | UPDATE where `status` changed on projects or tasks |
| `assigned` | INSERT on task_assignees |
| `unassigned` | DELETE on task_assignees |
| `checked` | UPDATE where `is_done` changed to `true` on checklist items |
| `unchecked` | UPDATE where `is_done` changed to `false` on checklist items |

---

## Views (`005_views_rpc.sql`)

Both views use `security_invoker = on` so the calling user's RLS context is applied.

### `v_task_total_time`

Aggregates total effort seconds per task, including running timers (`ended_at` defaults to `now()` if null).

```sql
SELECT task_id, total_seconds FROM public.v_task_total_time;
```

### `v_daily_attendance`

Per-user, per-IST-day worked seconds and overtime (seconds beyond 8 hours).

```sql
SELECT user_id, ist_date, worked_seconds, extra_seconds FROM public.v_daily_attendance;
```

### `get_my_dashboard()` RPC

Returns team-wide counts visible to the calling user's RLS context.

```json
{
  "total_tasks": 42,
  "urgent_tasks": 5,
  "pending_tasks": 30,
  "project_count": 8
}
```
