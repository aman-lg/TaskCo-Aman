-- ─────────────────────────────────────────────
-- 045's form_responses_dedup was a PARTIAL unique index (`where subject_user_id
-- is not null and cadence is not null`), meant to only dedup rating-subject +
-- cadence responses while leaving plain-form responses unconstrained. That
-- doesn't work with PostgREST's .upsert({onConflict: "col1,col2,..."}) — it
-- generates a plain `ON CONFLICT (columns)`, which Postgres can only match to
-- a full (non-partial) unique index/constraint, not a partial one (error
-- 42P10: "no unique or exclusion constraint matching the ON CONFLICT
-- specification").
--
-- The good news: a plain (non-partial) unique constraint already gives the
-- exact behavior we wanted, for free — Postgres treats NULL as never equal
-- to NULL for uniqueness purposes, so rows where subject_user_id or cadence
-- is NULL (the plain-form case) never conflict with each other regardless of
-- how many exist. Only rows where all four columns are non-null (the actual
-- rating-subject + cadence case) get deduped, which is exactly the intent.
-- ─────────────────────────────────────────────
drop index if exists public.form_responses_dedup;

alter table public.form_responses
  add constraint form_responses_dedup unique (form_id, subject_user_id, cadence, period_key);
