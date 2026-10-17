-- Student delivery foundation (additive).
-- Run in Supabase SQL Editor before deploying the student-assessment Edge Function.
-- Student access tokens are opaque, short-lived, and stored only as SHA-256 hashes.

create table if not exists public.student_sessions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  last_seen_at timestamptz,
  check (expires_at > created_at)
);

create index if not exists idx_student_sessions_student_expiry
  on public.student_sessions(student_id, expires_at desc);

alter table public.student_sessions enable row level security;
-- Deliberately no authenticated/anon policies. Only the Edge Function's service-role client may access sessions.

create index if not exists idx_assignments_class_assigned
  on public.assessment_assignments(class_id, assigned_at desc);

create index if not exists idx_attempts_assessment_student
  on public.attempts(assessment_id, student_id, created_at desc);

comment on table public.student_sessions is
  'Server-managed student sessions. Never expose token_hash or grant browser clients direct table access.';
comment on column public.attempts.result is
  'Server-validated response and score summary. Do not accept scores or correctness values from a browser client.';
