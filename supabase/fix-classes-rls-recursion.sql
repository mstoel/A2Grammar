-- Fix infinite RLS recursion between classes and class_teachers.
-- The helper functions run with the privileges of their owner and only return
-- whether the signed-in user is assigned to a class or manages its school.
create or replace function public.is_class_teacher(target_class uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.class_teachers ct
    where ct.class_id = target_class
      and ct.user_id = auth.uid()
  );
$$;

create or replace function public.can_manage_class_school(target_class uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.classes c
    join public.school_memberships m on m.school_id = c.school_id
    where c.id = target_class
      and m.user_id = auth.uid()
      and m.role in ('owner', 'admin')
  );
$$;

revoke all on function public.is_class_teacher(uuid) from public;
revoke all on function public.can_manage_class_school(uuid) from public;
grant execute on function public.is_class_teacher(uuid) to authenticated;
grant execute on function public.can_manage_class_school(uuid) to authenticated;

drop policy if exists "admins read all classes; teachers read assigned classes" on public.classes;
create policy "admins read all classes; teachers read assigned classes"
on public.classes for select to authenticated
using (
  public.has_school_role(school_id, array['owner','admin'])
  or public.is_class_teacher(id)
);

drop policy if exists "members read class teachers" on public.class_teachers;
create policy "members read class teachers"
on public.class_teachers for select to authenticated
using (
  public.has_school_role(
    (select c.school_id from public.classes c where c.id = class_id),
    array['owner','admin']
  )
  or user_id = auth.uid()
);

drop policy if exists "admins manage class teachers" on public.class_teachers;
create policy "admins manage class teachers"
on public.class_teachers for all to authenticated
using (public.can_manage_class_school(class_id))
with check (public.can_manage_class_school(class_id));
