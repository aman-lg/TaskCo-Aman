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

## Deployment
- **Platform**: Vercel. Auto-deploys on every push to `main`.
- Required env vars on Vercel: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `NEXT_PUBLIC_APP_URL`.

## Security patterns
- **UUID validation**: call `isValidUUID()` from `lib/utils/validate.ts` on every `[id]` path param before querying the DB. Return `ApiError.badRequest()` if invalid.
- **Error handling**: `ApiError.internal()` never takes `error.message` as an argument — log server-side with `console.error("[route]", error)` and return a generic message to the client.
- **Open redirects**: any redirect using a user-supplied URL must verify the path starts with `/` and does not start with `//`. Only relative paths are safe.
- **Avatar URL**: must be HTTPS and hosted on `*.supabase.co`. Validated at the API layer.

## Client component patterns
- **`useSearchParams()`** must always be inside a `"use client"` component, and that component must be wrapped in `<Suspense>` in its parent page. Use the `page.tsx` + `content.tsx` split: `page.tsx` is the Server Component that renders `<Suspense><Content /></Suspense>`, and `content.tsx` holds the client logic.
- **Optimistic updates**: use local `useState` for immediate UI feedback on mutations. Sync back from the server-authoritative value via `useEffect([serverProp])` so the UI reverts if the API call fails.
- **CSS variables**: HTML elements use `var(--token)` directly in Tailwind/inline styles — no JS resolution needed. Only recharts SVG fills require `getCSSVar()` to resolve to a hex string at render time.

## Never do
- Never expose `SUPABASE_SERVICE_ROLE_KEY` to the client. Never import `lib/supabase/admin` in `"use client"` files.
- Never ship a table without RLS enabled.
- Never commit `.env*` (`.env.example` is the only exception).
- Never build anything in Out of Scope (v1): roles/permissions, manager attendance views, file uploads, recurrence UI, multi-tenant, multi-checklist per task, mobile app, comments/mentions, realtime.
- Never use raw hex in components — only `var(--token-name)`.
- Never sum task timer entries for "hours worked".

## Out of scope (v1)
Roles/permissions · manager/team attendance views · file uploads · recurrence implementation · multi-tenant/orgs · multiple named checklists per task · multi-assignee UI · mobile/Android · comments/mentions · realtime
