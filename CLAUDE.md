# TaskCo — Claude Code Reference

## Stack
Next.js 15 (App Router) + TypeScript · Supabase (Postgres + Auth) · `@supabase/ssr` · Tailwind CSS v4 + shadcn/ui + next-themes · Zod · Vitest + Playwright

## Folder map
- `app/` — Next.js routes: `(auth)/` auth pages · `(app)/` guarded app pages · `api/` route handlers · `auth/` Supabase callbacks
- `components/` — `ui/` shadcn primitives · `layout/` sidebar/topbar · feature folders (projects, tasks, calendar, attendance, dashboard, notifications, profile, providers)
- `lib/` — `supabase/` clients · `api/` response helpers + withAuth handler · `validations/` Zod schemas · `queries/` server data fns · `hooks/` client hooks · `utils/` IST dates, time format, cn
- `types/` — `database.types.ts` (supabase gen output) · `index.ts`
- `supabase/` — `migrations/` · `functions/` Edge Functions · `seed.sql`
- `tests/` — `unit/` · `integration/` · `e2e/`

## Conventions
- Files/folders: kebab-case. Variables/functions: camelCase. Types/interfaces/components: PascalCase. DB columns: snake_case.
- API responses always: `{ data: ... }` success · `{ error: { message, code? } }` failure — use `ok()` / `ApiError.*` from `lib/api/response.ts`.
- Every route handler goes through `withAuth()` in `lib/api/handler.ts`. Validate body/params/query with Zod before any DB call.
- IDs: `uuid` via `gen_random_uuid()`.
- Design tokens: use `var(--*)` only — navy (#10125A), accent/orange (#CE7E37), status/urgency semantic tokens. Font: Montserrat. Instrument Serif italic accent only.

## Authorization — RLS at the DB
- Team tables (projects, tasks, activity): authenticated can SELECT; writes are owner/creator/assignee only.
- Personal tables (attendance_sessions, calendar_events, notifications): owner-only for all operations.
- `SUPABASE_SERVICE_ROLE_KEY` is server-only. Never prefix with `NEXT_PUBLIC_`.

## Attendance vs. task timers — never conflate
- `attendance_sessions` = working hours clock. One open session per user. Source of truth for hours worked.
- `task_time_entries` = effort per task, overlapping allowed. Never sum these for "hours worked" (double-counts overlaps).

## Never do
- Never expose `SUPABASE_SERVICE_ROLE_KEY` to the client. Never import `lib/supabase/admin` in `"use client"` files.
- Never ship a table without RLS enabled.
- Never commit `.env*` (`.env.example` is the only exception).
- Never build anything in Out of Scope (v1): roles/permissions, manager attendance views, file uploads, recurrence UI, multi-tenant, multi-checklist per task, mobile app, comments/mentions, realtime.
- Never use raw hex in components — only `var(--token-name)`.
- Never sum task timer entries for "hours worked".

## Out of scope (v1)
Roles/permissions · manager/team attendance views · file uploads · recurrence implementation · multi-tenant/orgs · multiple named checklists per task · multi-assignee UI · mobile/Android · comments/mentions · realtime
