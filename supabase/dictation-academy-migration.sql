-- EduAssess Dictation Academy: additive schema for the existing Supabase project.
-- Run this once in Supabase SQL Editor before deploying the dictation-academy Edge Function.

create table if not exists public.dictation_words (
  id uuid primary key default gen_random_uuid(),
  level_code text not null check (level_code in ('Pre-A1','A1','A1+','A2','A2+','B1','B1+','B2','B2+','C1','C1+','C2','C2+')),
  word text not null,
  sentence text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(level_code, word)
);

create index if not exists idx_dictation_words_level_active
  on public.dictation_words(level_code, is_active);

create table if not exists public.dictation_attempts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  level_code text not null check (level_code in ('Pre-A1','A1','A1+','A2','A2+','B1','B1+','B2','B2+','C1','C1+','C2','C2+')),
  attempt_type text not null default 'assessment' check (attempt_type in ('practice','assessment')),
  question_word_ids uuid[] not null,
  correct_count integer,
  total_questions integer not null default 25 check (total_questions = 25),
  score_percent numeric(5,2),
  status text not null default 'in_progress' check (status in ('in_progress','completed')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  check ((status = 'in_progress' and completed_at is null) or (status = 'completed' and completed_at is not null))
);

create index if not exists idx_dictation_attempts_student_level
  on public.dictation_attempts(student_id, level_code, completed_at desc);
create index if not exists idx_dictation_attempts_level_completed
  on public.dictation_attempts(level_code, completed_at desc);

create table if not exists public.dictation_responses (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.dictation_attempts(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  level_code text not null,
  word_id uuid not null references public.dictation_words(id) on delete restrict,
  typed_answer text not null default '',
  is_correct boolean not null,
  created_at timestamptz not null default now(),
  unique(attempt_id, word_id)
);

create index if not exists idx_dictation_responses_student_level
  on public.dictation_responses(student_id, level_code, is_correct);
create index if not exists idx_dictation_responses_word
  on public.dictation_responses(word_id, is_correct);

alter table public.dictation_words enable row level security;
alter table public.dictation_attempts enable row level security;
alter table public.dictation_responses enable row level security;
-- No browser-facing policies: the dictation-academy Edge Function uses the service role
-- after validating the existing short-lived student_sessions token.
