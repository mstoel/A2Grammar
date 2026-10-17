-- Assessment scoring and essay rubric support.
-- Non-destructive migration: adds scoring tables and nullable columns only.
-- Student result submission and score writes must go through a validated server-side function.

create table public.rubrics (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  title text not null check (char_length(trim(title)) between 2 and 160),
  description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_active boolean not null default true
);

create table public.rubric_versions (
  id uuid primary key default gen_random_uuid(),
  rubric_id uuid not null references public.rubrics(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  status text not null default 'draft' check (status in ('draft','published','archived')),
  total_weight numeric(5,2) not null default 100 check (total_weight = 100),
  created_at timestamptz not null default now(),
  published_at timestamptz,
  unique (rubric_id, version_number),
  unique (rubric_id, id)
);

create table public.rubric_criteria (
  id uuid primary key default gen_random_uuid(),
  rubric_version_id uuid not null references public.rubric_versions(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 160),
  description text not null default '',
  weight_percent numeric(5,2) not null check (weight_percent > 0 and weight_percent <= 100),
  max_score numeric(6,2) not null default 4 check (max_score > 0),
  display_order integer not null default 1 check (display_order > 0),
  created_at timestamptz not null default now(),
  unique (rubric_version_id, display_order),
  unique (rubric_version_id, id)
);

alter table public.assessments
  add column if not exists rubric_version_id uuid references public.rubric_versions(id) on delete restrict;

alter table public.attempts
  add column if not exists rubric_version_id uuid references public.rubric_versions(id) on delete restrict,
  add column if not exists draft_text text,
  add column if not exists draft_submitted_at timestamptz,
  add column if not exists final_essay_text text,
  add column if not exists grading_status text not null default 'not_required'
    check (grading_status in ('not_required','draft_submitted','awaiting_review','graded','returned')),
  add column if not exists teacher_feedback text,
  add column if not exists graded_at timestamptz,
  add column if not exists graded_by uuid references auth.users(id) on delete set null,
  add column if not exists score_max numeric(7,2) check (score_max is null or score_max > 0),
  add column if not exists score_points numeric(7,2) check (score_points is null or score_points >= 0);

create table public.attempt_criterion_scores (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.attempts(id) on delete cascade,
  rubric_criterion_id uuid not null references public.rubric_criteria(id) on delete restrict,
  raw_score numeric(7,2) not null check (raw_score >= 0),
  max_score numeric(7,2) not null check (max_score > 0 and raw_score <= max_score),
  weight_percent numeric(5,2) not null check (weight_percent > 0 and weight_percent <= 100),
  weighted_points numeric(7,2) not null check (weighted_points >= 0 and weighted_points <= 100),
  feedback text not null default '',
  grading_source text not null default 'teacher' check (grading_source in ('teacher','automated','assisted')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (attempt_id, rubric_criterion_id)
);

create index if not exists idx_rubric_versions_rubric on public.rubric_versions(rubric_id, version_number desc);
create index if not exists idx_rubric_criteria_version on public.rubric_criteria(rubric_version_id, display_order);
create index if not exists idx_attempts_rubric_version on public.attempts(rubric_version_id);
create index if not exists idx_attempt_criterion_scores_attempt on public.attempt_criterion_scores(attempt_id);

alter table public.rubrics enable row level security;
alter table public.rubric_versions enable row level security;
alter table public.rubric_criteria enable row level security;
alter table public.attempt_criterion_scores enable row level security;

create policy "owners manage own rubrics"
on public.rubrics for all to authenticated
using (owner_user_id = auth.uid())
with check (owner_user_id = auth.uid());

create policy "owners manage own rubric versions"
on public.rubric_versions for all to authenticated
using (exists (
  select 1 from public.rubrics r
  where r.id = rubric_id and r.owner_user_id = auth.uid()
))
with check (exists (
  select 1 from public.rubrics r
  where r.id = rubric_id and r.owner_user_id = auth.uid()
));

create policy "owners manage own rubric criteria"
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

-- Teachers may read scores only when existing attempt policies allow access to that attempt.
-- No client-side insert/update/delete policy is created for criterion scores.
create policy "teachers read accessible criterion scores"
on public.attempt_criterion_scores for select to authenticated
using (exists (
  select 1 from public.attempts a
  where a.id = attempt_id
));

