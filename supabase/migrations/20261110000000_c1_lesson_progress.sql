-- C1 Grammar & Sentence Craft: per-student lesson progress and written work
create table if not exists public.c1_lesson_progress (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  lesson_id text not null,
  score_percent numeric(5,2) not null default 0 check (score_percent between 0 and 100),
  correct_count integer not null default 0,
  total_questions integer not null default 0,
  answers jsonb not null default '[]'::jsonb,
  written_responses jsonb not null default '{}'::jsonb,
  completed boolean not null default false,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique(student_id, lesson_id)
);
create index if not exists c1_lesson_progress_school_student_idx on public.c1_lesson_progress(school_id, student_id);
alter table public.c1_lesson_progress enable row level security;
