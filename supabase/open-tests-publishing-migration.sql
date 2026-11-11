-- School-wide Open Tests publishing for cloud assessments and writing assignments.
alter table public.assessments
  add column if not exists is_open_test boolean not null default false,
  add column if not exists open_test_school_id uuid references public.schools(id) on delete cascade;

create index if not exists assessments_open_tests_idx
  on public.assessments (open_test_school_id, is_open_test, is_active, created_at desc);

-- Teachers may publish only assessments they created, and only to a school they belong to.
drop policy if exists "creators update assessments" on public.assessments;
create policy "creators update assessments"
on public.assessments for update to authenticated
using (created_by = auth.uid())
with check (
  created_by = auth.uid()
  and (
    (is_open_test = false and open_test_school_id is null)
    or (is_open_test = true and open_test_school_id is not null
        and public.is_school_member(open_test_school_id))
  )
);

-- Owners/admins/teachers may toggle the open-test flag on writing tasks in their school.
drop policy if exists "school members update writing open tests" on public.writing_assignments;
create policy "school members update writing open tests"
on public.writing_assignments for update to authenticated
using (public.is_school_member(school_id))
with check (public.is_school_member(school_id));

comment on column public.assessments.is_open_test is 'When true, this assessment is listed in the Open Tests area for students in open_test_school_id.';
comment on column public.assessments.open_test_school_id is 'School whose active students may access this published Open Test.';
