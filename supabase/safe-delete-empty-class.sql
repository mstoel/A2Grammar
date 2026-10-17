-- Safely delete an empty class without cascading into student or assignment data.
-- Only school owners/admins may call this function.
create or replace function public.delete_empty_class(target_class uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_school uuid;
begin
  select c.school_id into target_school
  from public.classes c
  where c.id = target_class;

  if target_school is null then
    raise exception 'Class not found.';
  end if;

  if not public.has_school_role(target_school, array['owner','admin']) then
    raise exception 'Only school owners and admins can delete classes.';
  end if;

  if exists (select 1 from public.students s where s.class_id = target_class) then
    raise exception 'This class still has student records. Deletion is blocked; deactivate the class or move/manage its students first.';
  end if;

  if exists (select 1 from public.assessment_assignments aa where aa.class_id = target_class) then
    raise exception 'This class has assessment assignments. Deletion is blocked to protect assessment history.';
  end if;

  delete from public.classes where id = target_class and school_id = target_school;
end;
$$;

revoke all on function public.delete_empty_class(uuid) from public;
grant execute on function public.delete_empty_class(uuid) to authenticated;

comment on function public.delete_empty_class(uuid) is
'Deletes only an empty class with no assessment assignments, after verifying caller is a school owner/admin.';
