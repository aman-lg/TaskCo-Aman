-- ─────────────────────────────────────────────
-- Two builder enhancements requested after live use:
-- 1. Page breaks — a question can be marked "start a new page here" so a
--    long form paginates (Next/Back) on the fill page instead of one long
--    scroll.
-- 2. A distinct "Paragraph" (multi-line) type, separate from the existing
--    single-line "text" (now labeled "Short answer" in the UI) — the two
--    were previously conflated into one generic type.
-- ─────────────────────────────────────────────
alter table public.form_questions add column if not exists page_break_before boolean not null default false;

alter type public.form_question_type add value if not exists 'long_text';
