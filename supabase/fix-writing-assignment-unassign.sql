-- Allow a writing assignment to be unassigned without deleting the task or submissions.
-- The dashboard removes it from the class by setting class_id to NULL.
-- Existing submissions remain linked to the writing assignment and are not deleted.
alter table public.writing_assignments
  alter column class_id drop not null;

grant select, update on public.writing_assignments to authenticated;

drop policy if exists "Teachers update their school's writing assignments" on public.writing_assignments;
drop policy if exists "Teachers update their school's writing assignments" on public.writing_assignments;

create policy "Teachers update their school's writing assignments"
on public.writing_assignments
for update to authenticated
using (
  exists (
    select 1 from public.school_memberships sm
    where sm.school_id = writing_assignments.school_id
      and sm.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.school_memberships sm
    where sm.school_id = writing_assignments.school_id
      and sm.user_id = auth.uid()
  )
);
