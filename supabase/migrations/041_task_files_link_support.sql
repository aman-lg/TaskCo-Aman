-- ─────────────────────────────────────────────
-- Bring task_files up to parity with project_files (026_project_files.sql):
-- support a plain link (kind='link', e.g. a Google Drive file) alongside an
-- uploaded file (kind='file'), instead of only ever an uploaded file.
-- ─────────────────────────────────────────────

alter table public.task_files add column kind text not null default 'file' check (kind in ('file', 'link'));
alter table public.task_files add column url text;
alter table public.task_files alter column storage_path drop not null;

alter table public.task_files add constraint task_files_kind_fields check (
  (kind = 'file' and storage_path is not null and url is null)
  or
  (kind = 'link' and url is not null and storage_path is null)
);
