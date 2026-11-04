-- Standalone HSK test environment bootstrap.
-- Creates only the minimum school/student/session tables needed by the existing
-- student-assessment Edge Function. Run ONLY in the new HSK-Diagnostic-Test project.
begin;
create extension if not exists pgcrypto;

create table if not exists public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (school_id, id),
  unique (school_id, name)
);
create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  class_id uuid not null,
  student_code text not null,
  display_name text,
  access_code_hash text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  foreign key (school_id, class_id) references public.classes(school_id, id) on delete cascade,
  unique (school_id, student_code)
);
create table if not exists public.student_sessions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  last_seen_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists student_sessions_token_hash_idx on public.student_sessions(token_hash);
create index if not exists student_sessions_student_idx on public.student_sessions(student_id, expires_at desc);

alter table public.schools enable row level security;
alter table public.classes enable row level security;
alter table public.students enable row level security;
alter table public.student_sessions enable row level security;

insert into public.schools (name, slug)
values ('HSK Test School', 'hsk-test')
on conflict (slug) do update set name = excluded.name, is_active = true;

insert into public.classes (school_id, name)
select id, 'M2' from public.schools where slug = 'hsk-test'
on conflict (school_id, name) do nothing;

-- Disposable HSK copy of the existing M2 test-student identity.
-- This does NOT copy or change the production EduAssess account.
-- Test access code: HSKTEST2026! (case-insensitive).
insert into public.students (school_id, class_id, student_code, display_name, access_code_hash, is_active)
select s.id, c.id, 'TEST-M2-001', 'Test Student',
       encode(digest(upper('HSKTEST2026!'), 'sha256'), 'hex'), true
from public.schools s
join public.classes c on c.school_id = s.id and c.name = 'M2'
where s.slug = 'hsk-test'
on conflict (school_id, student_code) do update
set display_name = excluded.display_name,
    access_code_hash = excluded.access_code_hash,
    is_active = true;

commit;
