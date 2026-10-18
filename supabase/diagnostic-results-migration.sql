-- Store full A2 adaptive grammar diagnostic reports for authenticated student sessions.
create table if not exists public.diagnostic_results (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  diagnostic_key text not null default 'a2-adaptive-grammar-v1',
  completed_at timestamptz not null default now(),
  overall_percent numeric(5,2) not null check (overall_percent >= 0 and overall_percent <= 100),
  questions_answered integer not null check (questions_answered >= 0),
  correct_count integer not null check (correct_count >= 0),
  skills_passed_or_secure integer not null check (skills_passed_or_secure >= 0),
  skills_extended integer not null check (skills_extended >= 0),
  report jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists diagnostic_results_school_student_completed_idx
  on public.diagnostic_results (school_id, student_id, completed_at desc);
alter table public.diagnostic_results enable row level security;
-- No direct browser access. The student-assessment Edge Function uses the service role
-- after validating the opaque student session; teacher read access will be added separately.
revoke all on public.diagnostic_results from anon, authenticated;
