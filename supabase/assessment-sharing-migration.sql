-- Assessment sharing: authenticated teachers can discover only explicitly published, active assessments.
-- Private assessments remain visible only to their creator or teachers authorized through existing assignment policies.
-- Run once in the Supabase SQL Editor.

drop policy if exists "teachers read published shared assessments" on public.assessments;
create policy "teachers read published shared assessments"
on public.assessments
for select
to authenticated
using (is_published = true and is_active = true);

comment on column public.assessments.is_published is
  'When true, an active assessment is discoverable by authenticated teachers in Open Library. Publishing does not grant student access or make answer keys safe for direct student clients.';
