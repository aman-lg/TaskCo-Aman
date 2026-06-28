# API Reference

## Authentication

All API routes require an authenticated Supabase session. The session is carried via HttpOnly cookies (`sb-access-token`, `sb-refresh-token`) set by `@supabase/ssr`. Requests from the browser automatically include these cookies.

Every protected route handler is wrapped with `withAuth()` (`lib/api/handler.ts`). `withAuth()` calls `supabase.auth.getUser()` on the server. If the session is missing or expired it returns `401` before the handler runs. The authenticated `user` object is then passed into the handler.

**Exception**: `POST /api/auth/logout` is public and does not use `withAuth()`.

---

## Standard Response Format

**Success**
```json
{ "data": <T> }
```

**Error**
```json
{ "error": { "message": "Human-readable description", "code": "SCREAMING_SNAKE_CASE" } }
```

### Standard error codes

| HTTP | Code | Meaning |
|---|---|---|
| 400 | `BAD_REQUEST` | Missing field, invalid format, or constraint violation |
| 401 | `UNAUTHORIZED` | No valid session |
| 403 | `FORBIDDEN` | Session valid but RLS blocked the operation |
| 404 | `NOT_FOUND` | Resource does not exist |
| 500 | `INTERNAL_ERROR` | Unexpected server error |

---

## Auth Routes

### `GET /api/auth/me`

Returns the currently authenticated user's identity and profile.

**Protected**: Yes

**Response**
```json
{
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "full_name": "Jane Smith",
    "avatar_url": "https://..."
  }
}
```

---

### `POST /api/auth/logout`

Signs out the current browser session. Clears HttpOnly session cookies by returning expired `Set-Cookie` headers. Always returns `200` even if no session exists (idempotent).

**Protected**: No

**Response**
```json
{ "data": { "success": true } }
```

---

## Projects

### `GET /api/projects`

Returns all projects visible to the authenticated user (team-read RLS — every authenticated user sees all projects). Ordered by `created_at` descending. The project owner's profile is embedded.

**Protected**: Yes

**Response**
```json
{
  "data": [
    {
      "id": "uuid",
      "title": "string",
      "description": "string | null",
      "start_date": "YYYY-MM-DD | null",
      "end_date": "YYYY-MM-DD | null",
      "deadline": "ISO 8601 | null",
      "urgency": "low | medium | high | urgent",
      "status": "active | on_hold | completed | archived",
      "color": "#rrggbb | null",
      "owner_id": "uuid",
      "created_at": "ISO 8601",
      "updated_at": "ISO 8601 | null",
      "owner": { "id": "uuid", "full_name": "string | null", "avatar_url": "string | null" }
    }
  ]
}
```

---

### `POST /api/projects`

Creates a new project. `owner_id` is set server-side from the authenticated user's ID and cannot be overridden by the request body.

**Protected**: Yes

**Request body**
```json
{
  "title": "string (required, max 100)",
  "description": "string (optional, max 500)",
  "start_date": "YYYY-MM-DD (optional)",
  "end_date": "YYYY-MM-DD (optional)",
  "deadline": "YYYY-MM-DDTHH:mm (optional, datetime-local or ISO string)",
  "urgency": "low | medium | high | urgent (default: medium)",
  "status": "active | on_hold | completed | archived (default: active)",
  "color": "#rrggbb (optional)"
}
```

**Response**: `201` with the created project object (same shape as GET, including embedded owner).

---

### `GET /api/projects/:id`

Returns a single project by ID.

**Protected**: Yes

**Response**: `200` with the project object, or `404` if not found.

---

### `PATCH /api/projects/:id`

Updates one or more fields of an existing project. All fields are optional; sending an empty body returns `400`. `owner_id` cannot be changed. RLS enforces owner-only writes — a non-owner receives `403`.

**Protected**: Yes

**Request body**: same fields as `POST`, all optional.

**Response**: `200` with the updated project object, `400` for validation errors, `403` if not the owner.

---

### `DELETE /api/projects/:id`

Deletes a project and cascades to all tasks, checklist items, activity log entries, etc. RLS enforces owner-only deletes.

**Protected**: Yes

**Response**
```json
{ "data": { "deleted": true } }
```

Returns `403` if the user is not the project owner.

---

### `GET /api/projects/:id/activity`

Returns the activity log for a project, newest first, limited to the last 50 entries. Entries are written by database triggers — there is no client write endpoint for activity.

**Protected**: Yes

**Response**
```json
{
  "data": [
    {
      "id": "uuid",
      "actor_id": "uuid",
      "action": "created | updated | deleted | status_changed | assigned | unassigned | checked | unchecked",
      "entity_type": "project | task | task_assignee | checklist_item",
      "entity_id": "uuid",
      "project_id": "uuid | null",
      "metadata": { },
      "created_at": "ISO 8601",
      "actor": { "full_name": "string | null", "avatar_url": "string | null" }
    }
  ]
}
```

---

## Tasks

### `GET /api/tasks?project_id=<uuid>`

Returns all tasks for a project. `project_id` is required. Ordered by `created_at` descending. Includes creator profile, assignees, and a checklist summary (id + is_done per item).

**Protected**: Yes

**Query params**: `project_id` (uuid, required)

**Response**
```json
{
  "data": [
    {
      "id": "uuid",
      "project_id": "uuid",
      "name": "string",
      "description": "string | null",
      "start_date": "ISO 8601 | null",
      "end_date": "ISO 8601 | null",
      "deadline": "ISO 8601 | null",
      "urgency": "low | medium | high | urgent",
      "status": "todo | in_progress | done",
      "color": "#rrggbb | null",
      "created_by": "uuid",
      "created_at": "ISO 8601",
      "updated_at": "ISO 8601 | null",
      "creator": { "id": "uuid", "full_name": "string | null", "avatar_url": "string | null" },
      "task_assignees": [
        { "user_id": "uuid", "assignee": { "id": "uuid", "full_name": "string | null", "avatar_url": "string | null" } }
      ],
      "task_checklist_items": [
        { "id": "uuid", "is_done": false }
      ]
    }
  ]
}
```

---

### `POST /api/tasks`

Creates a new task. `created_by` is set server-side.

**Protected**: Yes

**Request body**
```json
{
  "project_id": "uuid (required)",
  "name": "string (required, max 200)",
  "description": "string (optional, max 2000)",
  "start_date": "YYYY-MM-DDTHH:mm (optional)",
  "end_date": "YYYY-MM-DDTHH:mm (optional)",
  "deadline": "YYYY-MM-DDTHH:mm (optional)",
  "urgency": "low | medium | high | urgent (default: medium)",
  "status": "todo | in_progress | done (default: todo)",
  "color": "#rrggbb (optional)"
}
```

**Response**: `201` with the created task object (same shape as GET, including creator, assignees, and checklist).

---

### `GET /api/tasks/:id`

Returns a single task with full details: creator profile, all assignees, and all checklist items (including content, position, and created_at).

**Protected**: Yes

**Response**: `200` with the task object, or `404` if not found.

---

### `PATCH /api/tasks/:id`

Updates task fields. `project_id` cannot be changed. RLS allows creator or any assignee to update. Returns `403` if neither.

**Protected**: Yes

**Request body**: any subset of the create fields except `project_id`.

**Response**: `200` with the updated task, `400` for validation errors, `403` if not authorized.

---

### `DELETE /api/tasks/:id`

Deletes a task. RLS restricts deletion to the task creator only.

**Protected**: Yes

**Response**: `200` with `{ "data": { "deleted": true } }`, or `403` if not the creator.

---

## Task Assignees

### `GET /api/tasks/:id/assignees`

Lists all assignees for a task.

**Protected**: Yes

**Response**
```json
{
  "data": [
    {
      "user_id": "uuid",
      "assigned_at": "ISO 8601",
      "assignee": { "id": "uuid", "full_name": "string | null", "avatar_url": "string | null" }
    }
  ]
}
```

---

### `POST /api/tasks/:id/assignees`

Assigns a user to a task. `assigned_by` is set server-side. Returns `400` if the user is already assigned.

**Protected**: Yes

**Request body**
```json
{ "user_id": "uuid (required)" }
```

**Response**: `201` with the assignee record (including embedded profile).

---

### `DELETE /api/tasks/:id/assignees?user_id=<uuid>`

Removes an assignee. The assigner or the assignee themselves may remove the assignment (RLS policy: `assigned_by = auth.uid() OR user_id = auth.uid()`).

**Protected**: Yes

**Query params**: `user_id` (uuid, required)

**Response**: `200` with `{ "data": { "removed": true } }`, or `404` if the assignee record was not found.

---

## Task Checklist

### `GET /api/tasks/:id/checklist`

Lists all checklist items for a task, ordered by `position` ascending then `created_at` ascending.

**Protected**: Yes

**Response**
```json
{
  "data": [
    {
      "id": "uuid",
      "content": "string",
      "is_done": false,
      "position": 0,
      "created_at": "ISO 8601"
    }
  ]
}
```

---

### `POST /api/tasks/:id/checklist`

Adds a checklist item. RLS requires the caller to be the task creator or an assignee (`is_task_collaborator()`).

**Protected**: Yes

**Request body**
```json
{
  "content": "string (required, max 500)",
  "position": "integer >= 0 (optional)"
}
```

**Response**: `201` with the created checklist item.

---

### `PATCH /api/tasks/:id/checklist/:itemId`

Updates a checklist item. All fields are optional; empty body returns `400`.

**Protected**: Yes

**Request body**
```json
{
  "content": "string (optional, max 500)",
  "is_done": "boolean (optional)",
  "position": "integer >= 0 (optional)"
}
```

**Response**: `200` with the updated item, or `403`/`404` if blocked or not found.

---

### `DELETE /api/tasks/:id/checklist/:itemId`

Deletes a checklist item. RLS requires task collaborator status.

**Protected**: Yes

**Response**: `200` with `{ "data": { "deleted": true } }`, or `404` if not found.

---

## Attendance

### `POST /api/attendance/clock-in`

Starts a new work session for the authenticated user. Returns `400` if a session is already open (enforced by both application logic and a unique partial index in Postgres).

`ist_date` is computed server-side using `Asia/Kolkata` timezone so attendance is always bucketed by the Indian Standard Time calendar date, regardless of the server's system timezone.

**Protected**: Yes

**Response**: `201`
```json
{
  "data": {
    "id": "uuid",
    "check_in_at": "ISO 8601",
    "check_out_at": null,
    "ist_date": "YYYY-MM-DD"
  }
}
```

---

### `POST /api/attendance/clock-out`

Closes the currently open session. Returns `400` if no session is open.

**Protected**: Yes

**Response**: `200` with the updated session (check_out_at populated).

---

### `GET /api/attendance/today`

Returns all attendance sessions for the current IST calendar day, plus a computed summary.

**Protected**: Yes

**Response**
```json
{
  "data": {
    "sessions": [ { "id": "uuid", "check_in_at": "ISO 8601", "check_out_at": "ISO 8601 | null", "ist_date": "YYYY-MM-DD" } ],
    "openSession": { "id": "uuid", "check_in_at": "ISO 8601", "check_out_at": null, "ist_date": "YYYY-MM-DD" },
    "closedSeconds": 14400,
    "today": "YYYY-MM-DD"
  }
}
```

`closedSeconds` is the total seconds across all closed sessions for today. It does **not** include the currently open session's elapsed time (compute that client-side using `Date.now() - new Date(openSession.check_in_at)`).

---

## Profile

### `GET /api/profile`

Returns the authenticated user's full profile row.

**Protected**: Yes

**Response**
```json
{
  "data": {
    "id": "uuid",
    "full_name": "string | null",
    "avatar_url": "string | null",
    "email": "string | null",
    "created_at": "ISO 8601"
  }
}
```

---

### `PATCH /api/profile`

Updates the authenticated user's profile. Only `full_name` and `avatar_url` are patchable. `updated_at` is set server-side automatically.

**Protected**: Yes

**Request body**
```json
{
  "full_name": "string (optional, max 100)",
  "avatar_url": "string (optional, valid URL or null)"
}
```

**Response**: `200` with `{ "data": { "success": true } }`.
