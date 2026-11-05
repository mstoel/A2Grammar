-- Store a bounded writing-integrity activity summary with each submitted essay.
alter table public.writing_submissions
  add column if not exists integrity_report jsonb;
