-- Persist one resumable adaptive diagnostic attempt per student and diagnostic version.
create table if not exists public.diagnostic_drafts (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  diagnostic_key text not null,
  draft_payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint diagnostic_drafts_student_key_unique unique (student_id, diagnostic_key)
);

create index if not exists diagnostic_drafts_school_updated_idx
  on public.diagnostic_drafts (school_id, updated_at desc);

alter table public.diagnostic_drafts enable row level security;
-- Access is mediated by the student-assessment Edge Function using the service role key.
-- Do not add public or anon policies for this table.
