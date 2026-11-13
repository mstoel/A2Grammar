-- Individual and small-group assessment assignments. Run before deploying the updated Edge Function.
create table if not exists public.student_assessment_assignments (
 id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id) on delete cascade,
 class_id uuid not null, student_id uuid not null references public.students(id) on delete cascade,
 assessment_id uuid not null references public.assessments(id) on delete cascade,
 assigned_by uuid not null references auth.users(id) on delete restrict,
 assigned_at timestamptz not null default now(), created_at timestamptz not null default now(),
 foreign key (school_id,class_id) references public.classes(school_id,id) on delete cascade,
 unique (assessment_id,student_id)
);
create index if not exists idx_student_assessment_assignments_student on public.student_assessment_assignments(school_id,student_id,assigned_at desc);
create index if not exists idx_student_assessment_assignments_class on public.student_assessment_assignments(school_id,class_id,assigned_at desc);
alter table public.student_assessment_assignments enable row level security;
drop policy if exists "school admins read individual assessment assignments" on public.student_assessment_assignments;
create policy "school admins read individual assessment assignments" on public.student_assessment_assignments for select to authenticated using (public.has_school_role(school_id,array['owner','admin']));
drop policy if exists "school admins create individual assessment assignments" on public.student_assessment_assignments;
create policy "school admins create individual assessment assignments" on public.student_assessment_assignments for insert to authenticated with check (
 public.has_school_role(school_id,array['owner','admin'])
 and exists(select 1 from public.students s where s.id=student_id and s.school_id=school_id and s.class_id=class_id and s.is_active=true)
 and exists(select 1 from public.assessments a where a.id=assessment_id and a.is_active=true)
);
drop policy if exists "school admins remove individual assessment assignments" on public.student_assessment_assignments;
create policy "school admins remove individual assessment assignments" on public.student_assessment_assignments for delete to authenticated using (public.has_school_role(school_id,array['owner','admin']));
comment on table public.student_assessment_assignments is 'Private one-student assessment assignments. Multiple rows support selected groups within a class; student delivery is mediated by the student-assessment Edge Function.';
