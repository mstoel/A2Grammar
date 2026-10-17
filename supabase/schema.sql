create extension if not exists pgcrypto;

create table public.schools (
 id uuid primary key default gen_random_uuid(),
 name text not null check (char_length(trim(name)) between 2 and 160),
 slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
 created_by uuid not null references auth.users(id) on delete restrict,
 created_at timestamptz not null default now(),
 is_active boolean not null default true
);
create table public.school_memberships (
 school_id uuid not null references public.schools(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 role text not null check (role in ('owner','admin','teacher')),
 created_at timestamptz not null default now(), primary key(school_id,user_id)
);
create table public.classes (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.schools(id) on delete cascade,
 name text not null check (char_length(trim(name)) between 1 and 80),
 created_at timestamptz not null default now(), is_active boolean not null default true,
 unique(school_id,name), unique(school_id,id)
);
create table public.class_teachers (
 class_id uuid not null references public.classes(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(), primary key(class_id,user_id)
);
create table public.students (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.schools(id) on delete cascade,
 class_id uuid not null,
 student_code text not null check (char_length(trim(student_code)) between 1 and 64),
 display_name text,
 access_code_hash text not null,
 created_at timestamptz not null default now(), is_active boolean not null default true,
 foreign key(school_id,class_id) references public.classes(school_id,id) on delete cascade,
 unique(school_id,student_code)
);
create table public.assessments (
 id uuid primary key default gen_random_uuid(),
 title text not null check (char_length(trim(title)) between 2 and 160),
 description text not null default '', version text not null default '1',
 engine_key text not null default 'a2-adaptive-grammar-v1',
 created_by uuid not null references auth.users(id) on delete restrict,
 created_at timestamptz not null default now(), opens_at timestamptz, closes_at timestamptz,
 is_published boolean not null default false, is_active boolean not null default true,
 check(closes_at is null or opens_at is null or closes_at>opens_at)
);
create table public.assessment_assignments (
 assessment_id uuid not null references public.assessments(id) on delete cascade,
 school_id uuid not null references public.schools(id) on delete cascade,
 class_id uuid not null,
 assigned_by uuid not null references auth.users(id) on delete restrict,
 assigned_at timestamptz not null default now(), primary key(assessment_id,class_id),
 foreign key(school_id,class_id) references public.classes(school_id,id) on delete cascade
);
create table public.attempts (
 id uuid primary key default gen_random_uuid(),
 student_id uuid not null references public.students(id) on delete cascade,
 assessment_id uuid not null references public.assessments(id) on delete restrict,
 started_at timestamptz not null default now(), completed_at timestamptz, result jsonb,
 score_percent numeric(5,2) check(score_percent between 0 and 100),
 correct_count integer check(correct_count>=0), questions_answered integer check(questions_answered>=0),
 engine_key text not null default 'a2-adaptive-grammar-v1', created_at timestamptz not null default now()
);
create index idx_memberships_user on public.school_memberships(user_id);
create index idx_classes_school on public.classes(school_id,is_active);
create index idx_students_school_class on public.students(school_id,class_id,is_active);
create index idx_assignments_class on public.assessment_assignments(class_id);
create index idx_attempts_student_completed on public.attempts(student_id,completed_at desc);

alter table public.schools enable row level security;
alter table public.school_memberships enable row level security;
alter table public.classes enable row level security;
alter table public.class_teachers enable row level security;
alter table public.students enable row level security;
alter table public.assessments enable row level security;
alter table public.assessment_assignments enable row level security;
alter table public.attempts enable row level security;

create or replace function public.is_school_member(target_school uuid)
returns boolean language sql stable security definer set search_path=public
as $$ select exists(select 1 from public.school_memberships m where m.school_id=target_school and m.user_id=auth.uid()); $$;
create or replace function public.has_school_role(target_school uuid, allowed_roles text[])
returns boolean language sql stable security definer set search_path=public
as $$ select exists(select 1 from public.school_memberships m where m.school_id=target_school and m.user_id=auth.uid() and m.role=any(allowed_roles)); $$;
revoke all on function public.is_school_member(uuid) from public;
revoke all on function public.has_school_role(uuid,text[]) from public;
grant execute on function public.is_school_member(uuid) to authenticated;
grant execute on function public.has_school_role(uuid,text[]) to authenticated;

create or replace function public.create_school_and_owner(school_name text, school_slug text)
returns uuid language plpgsql security definer set search_path=public
as $$
declare new_id uuid;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if char_length(trim(school_name)) not between 2 and 160 then raise exception 'Invalid school name'; end if;
 if school_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then raise exception 'Invalid school slug'; end if;
 insert into public.schools(name,slug,created_by) values(trim(school_name),school_slug,auth.uid()) returning id into new_id;
 insert into public.school_memberships(school_id,user_id,role) values(new_id,auth.uid(),'owner');
 return new_id;
end; $$;
revoke all on function public.create_school_and_owner(text,text) from public;
grant execute on function public.create_school_and_owner(text,text) to authenticated;

create policy "members read schools" on public.schools for select to authenticated using(public.is_school_member(id));
create policy "admins update schools" on public.schools for update to authenticated using(public.has_school_role(id,array['owner','admin'])) with check(public.has_school_role(id,array['owner','admin']));
create policy "members read memberships" on public.school_memberships for select to authenticated using(public.is_school_member(school_id));
create policy "admins manage memberships" on public.school_memberships for all to authenticated using(public.has_school_role(school_id,array['owner','admin'])) with check(public.has_school_role(school_id,array['owner','admin']));
create policy "admins read all classes; teachers read assigned classes" on public.classes for select to authenticated using(
 public.has_school_role(school_id,array['owner','admin']) or exists(select 1 from public.class_teachers ct where ct.class_id=id and ct.user_id=auth.uid())
);
create policy "admins insert classes" on public.classes for insert to authenticated with check(public.has_school_role(school_id,array['owner','admin']));
create policy "admins update classes" on public.classes for update to authenticated using(public.has_school_role(school_id,array['owner','admin'])) with check(public.has_school_role(school_id,array['owner','admin']));
create policy "admins delete classes" on public.classes for delete to authenticated using(public.has_school_role(school_id,array['owner','admin']));
create policy "members read class teachers" on public.class_teachers for select to authenticated using(exists(select 1 from public.classes c where c.id=class_id and public.is_school_member(c.school_id)));
create policy "admins manage class teachers" on public.class_teachers for all to authenticated using(exists(select 1 from public.classes c where c.id=class_id and public.has_school_role(c.school_id,array['owner','admin']))) with check(exists(select 1 from public.classes c where c.id=class_id and public.has_school_role(c.school_id,array['owner','admin'])));
create policy "admins read all students; teachers read assigned classes only" on public.students for select to authenticated using(
 public.has_school_role(students.school_id,array['owner','admin']) or exists(select 1 from public.class_teachers ct where ct.class_id=students.class_id and ct.user_id=auth.uid())
);
create policy "admins manage students" on public.students for all to authenticated using(public.has_school_role(school_id,array['owner','admin'])) with check(public.has_school_role(school_id,array['owner','admin']));
create policy "members read assigned assessments" on public.assessments for select to authenticated using(created_by=auth.uid() or exists(select 1 from public.assessment_assignments aa where aa.assessment_id=id and public.is_school_member(aa.school_id)));
create policy "creators insert assessments" on public.assessments for insert to authenticated with check(created_by=auth.uid());
create policy "creators update assessments" on public.assessments for update to authenticated using(created_by=auth.uid()) with check(created_by=auth.uid());
create policy "creators delete assessments" on public.assessments for delete to authenticated using(created_by=auth.uid());
create policy "members read assignments" on public.assessment_assignments for select to authenticated using(public.is_school_member(school_id));
create policy "admins manage assignments" on public.assessment_assignments for all to authenticated using(public.has_school_role(school_id,array['owner','admin'])) with check(public.has_school_role(school_id,array['owner','admin']));
create policy "admins read school attempts; teachers read assigned classes only" on public.attempts for select to authenticated using(
 exists(select 1 from public.students s where s.id=student_id and (
  public.has_school_role(s.school_id,array['owner','admin']) or
  exists(select 1 from public.class_teachers ct where ct.class_id=s.class_id and ct.user_id=auth.uid())
 ))
);
-- Intentionally no public student-read policy and no direct insert/update policy on attempts.
-- Use a validated server-side Edge Function for student login and result submission.
