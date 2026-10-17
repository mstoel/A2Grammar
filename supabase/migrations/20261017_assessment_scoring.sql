-- Assessment scoring foundation migration
-- Safe to run after supabase/schema.sql on the existing project.
-- This migration adds rubric versioning and per-criterion score storage.
-- It does not add public student access or direct client write access to attempts.

begin;

create table if not exists public.rubrics (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  name text not null check (char_length(trim(name)) between 2 and 160),
  description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_archived boolean not null default false
);

create table if not exists public.rubric_versions (
  id uuid primary key default gen_random_uuid(),
  rubric_id uuid not null references public.rubrics(id) on delete restrict,
  version_number integer not null check (version_number > 0),
  title text not null check (char_length(trim(title)) between 2 and 160),
  grading_scale text not null default '0-6',
  status text not null default 'draft' check (status in ('draft','published','retired')),
  created_at timestamptz not null default now(),
  published_at timestamptz,
  unique (rubric_id, version_number),
  unique (rubric_id, id)
);

create table if not exists public.rubric_criteria (
  id uuid primary key default gen_random_uuid(),
  rubric_version_id uuid not null references public.rubric_versions(id) on delete restrict,
  name text not null check (char_length(trim(name)) between 1 and 160),
  description text not null default '',
  weight_percent numeric(5,2) not null check (weight_percent >= 0 and weight_percent <= 100),
  max_score numeric(6,2) not null default 6 check (max_score > 0),
  sort_order integer not null default 0,
  scoring_guide jsonb not null default '{}'::jsonb,
  grading_mode text not null default 'teacher_review' check (grading_mode in ('automatic','teacher_review','automatic_with_review')),
  created_at timestamptz not null default now(),
  unique (rubric_version_id, sort_order),
  unique (rubric_version_id, id)
);

-- Attach an exact rubric version to an assessment. Existing assessments remain valid.
alter table public.assessments
  add column if not exists rubric_version_id uuid references public.rubric_versions(id) on delete restrict;

-- Keep the historical total and result JSON, and add explicit essay/grade workflow fields.
alter table public.attempts
  add column if not exists rubric_version_id uuid references public.rubric_versions(id) on delete restrict,
  add column if not exists draft_text text,
  add column if not exists draft_submitted_at timestamptz,
  add column if not exists final_essay_text text,
  add column if not exists grading_status text not null default 'not_applicable'
    check (grading_status in ('not_applicable','in_progress','submitted','auto_graded','needs_review','finalized')),
  add column if not exists teacher_feedback text,
  add column if not exists graded_at timestamptz,
  add column if not exists graded_by uuid references auth.users(id) on delete set null,
  add column if not exists score_max numeric(7,2) not null default 100 check (score_max > 0),
  add column if not exists score_points numeric(7,2) check (score_points >= 0 and score_points <= score_max);

-- One row per criterion per attempt. This preserves individual scores even when
-- later attempts use a different rubric version.
create table if not exists public.attempt_criterion_scores (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.attempts(id) on delete cascade,
  rubric_criterion_id uuid not null references public.rubric_criteria(id) on delete restrict,
  raw_score numeric(7,2) not null check (raw_score >= 0),
  max_score numeric(7,2) not null check (max_score > 0 and raw_score <= max_score),
  weight_percent numeric(5,2) not null check (weight_percent >= 0 and weight_percent <= 100),
  weighted_points numeric(7,2) not null check (weighted_points >= 0 and weighted_points <= 100),
  feedback text not null default '',
  grading_source text not null default 'teacher' check (grading_source in ('automatic','teacher','teacher_override')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (attempt_id, rubric_criterion_id)
);

create index if not exists idx_rubric_owner on public.rubrics(owner_user_id, created_at desc);
create index if not exists idx_rubric_versions_rubric on public.rubric_versions(rubric_id, version_number desc);
create index if not exists idx_rubric_criteria_version on public.rubric_criteria(rubric_version_id, sort_order);
create index if not exists idx_attempts_rubric_version on public.attempts(rubric_version_id);
create index if not exists idx_attempt_scores_attempt on public.attempt_criterion_scores(attempt_id);
create index if not exists idx_attempt_scores_criterion on public.attempt_criterion_scores(rubric_criterion_id);

alter table public.rubrics enable row level security;
alter table public.rubric_versions enable row level security;
alter table public.rubric_criteria enable row level security;
alter table public.attempt_criterion_scores enable row level security;

-- Rubrics are private to their creator during the initial private-development phase.
drop policy if exists "owners manage their rubrics" on public.rubrics;
create policy "owners manage their rubrics"
on public.rubrics for all to authenticated
using (owner_user_id = auth.uid())
with check (owner_user_id = auth.uid());

drop policy if exists "owners manage their rubric versions" on public.rubric_versions;
create policy "owners manage their rubric versions"
on public.rubric_versions for all to authenticated
using (exists (
  select 1 from public.rubrics r
  where r.id = rubric_id and r.owner_user_id = auth.uid()
))
with check (exists (
  select 1 from public.rubrics r
  where r.id = rubric_id and r.owner_user_id = auth.uid()
));

drop policy if exists "owners manage their rubric criteria" on public.rubric_criteria;
create policy "owners manage their rubric criteria"
on public.rubric_criteria for all to authenticated
using (exists (
  select 1
  from public.rubric_versions rv
  join public.rubrics r on r.id = rv.rubric_id
  where rv.id = rubric_version_id and r.owner_user_id = auth.uid()
))
with check (exists (
  select 1
  from public.rubric_versions rv
  join public.rubrics r on r.id = rv.rubric_id
  where rv.id = rubric_version_id and r.owner_user_id = auth.uid()
));

-- Teachers can read criterion scores only for attempts in classes they teach;
-- school owners/admins can read attempts from their school. No direct client
-- insert/update/delete policies are added; trusted server-side functions will write scores.
drop policy if exists "teachers read authorized attempt criterion scores" on public.attempt_criterion_scores;
create policy "teachers read authorized attempt criterion scores"
on public.attempt_criterion_scores for select to authenticated
using (
  exists (
    select 1
    from public.attempts a
    join public.students s on s.id = a.student_id
    where a.id = attempt_id
      and (
        public.has_school_role(s.school_id, array['owner','admin'])
        or exists (
          select 1 from public.class_teachers ct
          where ct.class_id = s.class_id and ct.user_id = auth.uid()
        )
      )
  )
);

commit;
