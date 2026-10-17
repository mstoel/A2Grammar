-- Anonymous score storage is separated from identified attempts so anonymous mode
-- never requires storing a student_id. Only the Edge Function service role may access it.
create table if not exists public.anonymous_assessment_results (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments(id) on delete cascade,
  submitted_at timestamptz not null default now(),
  score_percent numeric(5,2) not null check (score_percent between 0 and 100),
  correct_count integer not null check (correct_count >= 0),
  questions_answered integer not null check (questions_answered >= 0),
  result jsonb not null default '{}'::jsonb
);
create index if not exists idx_anonymous_results_assessment_date
  on public.anonymous_assessment_results(assessment_id, submitted_at desc);
alter table public.anonymous_assessment_results enable row level security;
-- Deliberately no browser-facing policies: all inserts happen after server-side validation.
comment on table public.anonymous_assessment_results is
  'Anonymous assessment outcomes. This table intentionally stores no student or session identifier.';
