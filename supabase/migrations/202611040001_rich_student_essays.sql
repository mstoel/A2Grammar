-- Preserve rich-text formatting for student writing while keeping plain text for word counts and AI marking.
alter table public.writing_submissions
  add column if not exists draft_html text,
  add column if not exists submitted_html text;
