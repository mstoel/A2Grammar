-- Writing assessment v1: assignments, autosaved drafts, submissions, and teacher-approved AI feedback.
create table if not exists public.writing_assignments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  title text not null,
  prompt text not null,
  instructions text not null default '',
  rubric_key text not null default 'informative-100',
  rubric jsonb not null default '[]'::jsonb,
  min_words integer not null default 200 check (min_words between 0 and 20000),
  max_words integer not null default 0 check (max_words between 0 and 50000),
  status text not null default 'draft' check (status in ('draft','published','closed')),
  due_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists writing_assignments_school_class_idx on public.writing_assignments(school_id,class_id,status);
create table if not exists public.writing_submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.writing_assignments(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  draft_text text not null default '',
  submitted_text text,
  word_count integer not null default 0,
  status text not null default 'draft' check (status in ('draft','submitted','reviewed')),
  submitted_at timestamptz,
  ai_review jsonb,
  teacher_scores jsonb not null default '{}'::jsonb,
  teacher_feedback text not null default '',
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(assignment_id,student_id)
);
create index if not exists writing_submissions_school_assignment_idx on public.writing_submissions(school_id,assignment_id,status);
alter table public.writing_assignments enable row level security;
alter table public.writing_submissions enable row level security;
revoke all on public.writing_assignments from anon, authenticated;
revoke all on public.writing_submissions from anon, authenticated;\ngrant select, insert, update on public.writing_assignments to authenticated;\ngrant select, update on public.writing_submissions to authenticated;
drop policy if exists "Teachers manage their school's writing assignments" on public.writing_assignments;
create policy "Teachers manage their school's writing assignments" on public.writing_assignments
for all to authenticated using (
  exists (select 1 from public.school_memberships sm where sm.school_id=writing_assignments.school_id and sm.user_id=auth.uid())
) with check (
  created_by=auth.uid() and exists (select 1 from public.school_memberships sm where sm.school_id=writing_assignments.school_id and sm.user_id=auth.uid())
);
drop policy if exists "Teachers read school's writing submissions" on public.writing_submissions;
create policy "Teachers read school's writing submissions" on public.writing_submissions
for select to authenticated using (
  exists (select 1 from public.school_memberships sm where sm.school_id=writing_submissions.school_id and sm.user_id=auth.uid())
);
drop policy if exists "Teachers update school's writing submissions" on public.writing_submissions;
create policy "Teachers update school's writing submissions" on public.writing_submissions
for update to authenticated using (
  exists (select 1 from public.school_memberships sm where sm.school_id=writing_submissions.school_id and sm.user_id=auth.uid())
) with check (
  exists (select 1 from public.school_memberships sm where sm.school_id=writing_submissions.school_id and sm.user_id=auth.uid())
);
