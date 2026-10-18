-- Teachers who belong to the same school may read that school's diagnostic results.
drop policy if exists "Teachers can read school diagnostic results" on public.diagnostic_results;
create policy "Teachers can read school diagnostic results"
on public.diagnostic_results for select to authenticated
using (
  exists (
    select 1 from public.school_memberships sm
    where sm.school_id = diagnostic_results.school_id
      and sm.user_id = auth.uid()
  )
);
