-- Allow teachers to delete only writing assignments they created.
-- Existing assignments and submissions are not changed by this migration.
revoke delete on public.writing_assignments from anon, authenticated;
grant delete on public.writing_assignments to authenticated;

drop policy if exists "Teachers manage their school's writing assignments" on public.writing_assignments;
drop policy if exists "Teachers read their school's writing assignments" on public.writing_assignments;
drop policy if exists "Teachers create their school's writing assignments" on public.writing_assignments;
drop policy if exists "Teachers update their school's writing assignments" on public.writing_assignments;
drop policy if exists "Teachers delete their own writing assignments" on public.writing_assignments;

create policy "Teachers read their school's writing assignments"
on public.writing_assignments for select to authenticated
using (exists (
  select 1 from public.school_memberships sm
  where sm.school_id = writing_assignments.school_id and sm.user_id = auth.uid()
));

create policy "Teachers create their school's writing assignments"
on public.writing_assignments for insert to authenticated
with check (
  created_by = auth.uid()
  and exists (
    select 1 from public.school_memberships sm
    where sm.school_id = writing_assignments.school_id and sm.user_id = auth.uid()
  )
);

create policy "Teachers update their school's writing assignments"
on public.writing_assignments for update to authenticated
using (exists (
  select 1 from public.school_memberships sm
  where sm.school_id = writing_assignments.school_id and sm.user_id = auth.uid()
))
with check (exists (
  select 1 from public.school_memberships sm
  where sm.school_id = writing_assignments.school_id and sm.user_id = auth.uid()
));

create policy "Teachers delete their own writing assignments"
on public.writing_assignments for delete to authenticated
using (
  created_by = auth.uid()
  and exists (
    select 1 from public.school_memberships sm
    where sm.school_id = writing_assignments.school_id and sm.user_id = auth.uid()
  )
);
