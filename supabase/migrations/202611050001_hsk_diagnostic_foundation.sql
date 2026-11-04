-- HSK 3.0-aligned diagnostic foundation for EduAssess.
-- Question content is curated and published separately; this migration does not
-- label EduAssess as an official HSK examination or issue HSK certificates.

begin;

create table if not exists public.hsk_questions (
  question_id text primary key check (question_id ~ '^hsk[123]-[a-z0-9-]+$'),
  level smallint not null check (level between 1 and 3),
  skill text not null check (skill in ('listening','picture_recognition','vocabulary','character_recognition','reading','grammar','writing')),
  item_type text not null check (item_type in ('multiple_choice','matching','ordering','short_answer','character_input')),
  prompt text not null default '',
  stimulus text not null default '',
  options jsonb not null default '[]'::jsonb,
  answer_key jsonb not null default '{}'::jsonb,
  explanation text not null default '',
  audio_text text,
  audio_path text,
  audio_status text not null default 'not_required' check (audio_status in ('not_required','pending','ready','failed')),
  image_path text,
  difficulty smallint not null default 1 check (difficulty between 1 and 5),
  source_reference text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  audio_generated_at timestamptz
);

create index if not exists hsk_questions_level_skill_idx
  on public.hsk_questions(level, skill, difficulty) where is_published = true;

create table if not exists public.hsk_diagnostic_attempts (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  status text not null default 'in_progress' check (status in ('in_progress','completed','abandoned')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  overall_level smallint check (overall_level between 0 and 3),
  report jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists hsk_attempts_student_date_idx
  on public.hsk_diagnostic_attempts(student_id, created_at desc);

create table if not exists public.hsk_skill_results (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.hsk_diagnostic_attempts(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  skill text not null check (skill in ('listening','picture_recognition','vocabulary','character_recognition','reading','grammar','writing')),
  level smallint not null check (level between 1 and 3),
  questions_answered integer not null default 0 check (questions_answered >= 0),
  correct_count integer not null default 0 check (correct_count >= 0 and correct_count <= questions_answered),
  score_percent numeric(5,2) not null default 0 check (score_percent between 0 and 100),
  passed boolean not null default false,
  status text not null default 'not_assessed' check (status in ('not_assessed','in_progress','passed','borderline','not_yet')),
  created_at timestamptz not null default now(),
  unique(attempt_id, skill, level)
);

create index if not exists hsk_skill_results_student_idx
  on public.hsk_skill_results(student_id, skill, level, created_at desc);

create table if not exists public.hsk_skill_progress (
  student_id uuid not null references public.students(id) on delete cascade,
  skill text not null check (skill in ('listening','picture_recognition','vocabulary','character_recognition','reading','grammar','writing')),
  level smallint not null check (level between 1 and 3),
  best_score numeric(5,2) not null default 0 check (best_score between 0 and 100),
  passed boolean not null default false,
  attempts integer not null default 0 check (attempts >= 0),
  last_attempt_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key(student_id, skill, level)
);

-- Media is private. Students receive short-lived signed URLs from trusted server code.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('hsk-media', 'hsk-media', false, 15728640, array['audio/wav','image/png','image/jpeg','image/webp','image/svg+xml'])
on conflict (id) do update set public = false;

alter table public.hsk_questions enable row level security;
alter table public.hsk_diagnostic_attempts enable row level security;
alter table public.hsk_skill_results enable row level security;
alter table public.hsk_skill_progress enable row level security;

-- HSK content and student results are accessed through trusted Edge Functions.
-- No anon/authenticated direct write policies are created.

commit;
