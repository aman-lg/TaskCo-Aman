# Architecture

## System Overview

TaskCo is a Next.js 16 application using the App Router. The architecture has two main layers:

1. **Next.js frontend + API** — React Server Components handle data fetching and initial render; Client Components handle interactivity; Next.js Route Handlers (in `app/api/`) serve the JSON API consumed by client-side mutations.

2. **Supabase backend** — Provides Postgres (the database), Supabase Auth (JWTs and sessions), and Row Level Security (authorization). The application server never implements authorization logic itself; it defers to RLS policies evaluated at query time.

```
Browser
  │
  ├─ Server Components (page.tsx)
  │     └─ lib/queries/  ──────────────────────── Supabase Postgres (via server client)
  │
  └─ Client Components
        └─ fetch("/api/...")
              └─ app/api/**/route.ts
                    ├─ withAuth()  ── Supabase Auth (getUser)
                    ├─ Zod parse
                    └─ Supabase Postgres (via server client, RLS applied)
```

---

## Authentication Flow

1. **Login/Register** — The user submits credentials on an auth page (`app/(auth)/`). The form calls Supabase Auth client-side (`supabase.auth.signInWithPassword` / `signUp`). On success, `@supabase/ssr` sets HttpOnly session cookies (`sb-access-token`, `sb-refresh-token`) on the response via the server client.

2. **Session propagation** — On every subsequent request, `@supabase/ssr` reads the session cookies and attaches the JWT to outgoing Supabase calls. The server client in `lib/supabase/server.ts` is always created fresh per request and reads cookies via the Next.js `cookies()` API.

3. **Route protection** — The Next.js proxy/middleware (previously `middleware.ts`, now handled by Next.js routing conventions) checks for a valid session before serving any page under `app/(app)/`. Unauthenticated requests are redirected to `/login`.

4. **API route protection** — Every protected Route Handler is wrapped with `withAuth()` from `lib/api/handler.ts`. `withAuth()` calls `supabase.auth.getUser()` on the server client. If there is no valid session it returns `401 Unauthorized` immediately, before the handler function runs.

5. **Logout** — `POST /api/auth/logout` calls `supabase.auth.signOut({ scope: "local" })` on the server and returns expired `Set-Cookie` headers, clearing the HttpOnly cookies. Client-only `signOut()` cannot clear HttpOnly cookies, so the server route is required.

---

## Data Flow

### Server Components (read path)

Server Component pages (`app/(app)/**/page.tsx`) call functions from `lib/queries/` directly. These functions receive a Supabase server client and run queries on the database. The results are passed as props to Client Components that handle interactivity.

Example (`app/(app)/dashboard/page.tsx`):
```
DashboardPage (Server Component)
  ├─ createClient()            ← server Supabase client (cookies attached)
  ├─ getProjects(supabase)     ← lib/queries/projects.ts
  ├─ getTaskStats(supabase)    ← lib/queries/tasks.ts
  ├─ getTodayTasks(supabase)   ← lib/queries/tasks.ts
  └─ render <DashboardClient props={...} />
```

RLS is enforced on every query because the server client carries the user's JWT. There is no separate authorization check in the query layer.

### Client Components (write/mutation path)

Client Components call `fetch("/api/...")` to create, update, or delete resources. The Route Handler validates the request with Zod, then runs the mutation against Supabase using the server client. RLS enforces write authorization at the database layer.

```
Client Component
  └─ fetch("POST /api/tasks", { body })
        └─ withAuth()                  ← verifies JWT, extracts user
              └─ createTaskSchema.safeParse(body)
                    └─ supabase.from("tasks").insert(...)  ← RLS: created_by = auth.uid()
```

---

## Key Architectural Decisions

### App Router (Next.js)

The App Router was chosen to enable server-side data fetching in React Server Components, eliminating client-side loading states for the initial page render. Pages fetch all necessary data in parallel (using `Promise.all`) during the server render and hydrate Client Components with the result.

### Supabase as the backend

Supabase was chosen because it bundles Postgres, Auth, and Row Level Security in a single managed service. This removes the need for a separate auth service or an ORM-level permission layer. The Supabase JS client is used directly — there is no intermediate ORM or query builder.

### Authorization at the database layer (RLS)

All authorization is enforced by Postgres Row Level Security policies. The application layer does not implement permission checks; RLS policies run transparently on every query. If a user attempts a write they are not authorized for, Postgres returns zero affected rows, which the API translates to a `403 Forbidden` response.

This approach has one deliberate trade-off: the API returns `403` rather than `404` when a resource exists but the user cannot write to it, which reveals existence. This is acceptable because the read policy is team-wide (any authenticated user can read all projects and tasks).

### TypeScript `never` inference and `(supabase as any)` casts

Supabase generates TypeScript types from the database schema (`types/database.types.ts`). When a `.select()` call uses a narrow column list, TypeScript's inference sometimes resolves the return type to `never` because the generated types expect the full row shape. Rather than duplicating full select strings, the codebase uses `(supabase as any)` casts in those specific queries. This is a known TypeScript/Supabase limitation and does not affect runtime behaviour. The `eslint-disable-next-line @typescript-eslint/no-explicit-any` comment is used to suppress the lint warning at each cast site.

---

## Attendance vs. Task Timers

These two systems track different things and must never be conflated:

| | `attendance_sessions` | `task_time_entries` |
|---|---|---|
| Purpose | Working hours clock — when the user is at work | Effort per task — time spent on a specific task |
| Constraint | One open session per user at a time (unique index on `user_id` where `check_out_at IS NULL`) | Overlapping entries are allowed |
| Source of truth for | Hours worked per day | Time effort per task |
| Aggregation view | `v_daily_attendance` (worked_seconds, extra_seconds per IST day) | `v_task_total_time` (total_seconds per task) |

**Never sum `task_time_entries` to calculate hours worked.** Because task timers can overlap (a user can have two running timers on two tasks simultaneously), summing them double-counts overlapping intervals. The `attendance_sessions` table is the only authoritative source for "how many hours did this person work today."

---

## Security Headers

`next.config.ts` applies the following headers to all routes:

| Header | Value |
|---|---|
| `X-Frame-Options` | `DENY` (prevents clickjacking) |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` |

Remote image patterns are restricted to `*.supabase.co` and `*.supabase.in` (avatar URLs stored in Supabase Storage).
