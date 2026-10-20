-- Central test catalogue for Assessly.
-- Apply manually in Supabase SQL Editor after reviewing this migration.
-- This creates a registry of tests; it does NOT move question banks or alter student results.

create extension if not exists pgcrypto;

create table if not exists public.test_catalog (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text,
  subject text,
  cefr_level text,
  assessment_type text not null default 'other',
  engine_key text,
  source_kind text not null,
  source_path text,
  source_table text,
  source_record_id text,
  source_key text not null unique,
  publication_status text not null default 'private'
    check (publication_status in ('private', 'shared', 'archived')),
  is_active boolean not null default true,
  version integer not null default 1 check (version >= 1),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint test_catalog_cefr_level_check
    check (cefr_level is null or cefr_level in ('Pre-A1','A1','A2','B1','B2','C1','C2'))
);

create index if not exists test_catalog_subject_idx on public.test_catalog (subject);
create index if not exists test_catalog_cefr_idx on public.test_catalog (cefr_level);
create index if not exists test_catalog_status_idx on public.test_catalog (publication_status, is_active);
create index if not exists test_catalog_type_idx on public.test_catalog (assessment_type);

create or replace function public.set_test_catalog_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists test_catalog_updated_at on public.test_catalog;
create trigger test_catalog_updated_at
before update on public.test_catalog
for each row execute function public.set_test_catalog_updated_at();

alter table public.test_catalog enable row level security;

-- Published catalogue entries may be discovered without exposing private entries.
drop policy if exists "Published tests are discoverable" on public.test_catalog;
create policy "Published tests are discoverable"
on public.test_catalog
for select
to anon, authenticated
using (publication_status = 'shared' and is_active = true);

-- Deliberately no client-side INSERT/UPDATE/DELETE policies are created here.
-- Catalogue writes should be done by an authorised server/admin workflow, not by students.

-- Register the GitHub-hosted diagnostics. Their question banks remain in their HTML files.
insert into public.test_catalog
  (slug, title, description, subject, cefr_level, assessment_type, engine_key,
   source_kind, source_path, source_key, publication_status, is_active, version, metadata)
values
  ('a2-adaptive-grammar-diagnostic', 'A2 English Grammar Diagnostic',
   'Adaptive diagnostic across grammar skills.', 'English Grammar', 'A2',
   'adaptive-diagnostic', 'a2-adaptive-grammar-v1', 'github-html',
   'grammar-diagnostic.html', 'github:grammar-diagnostic.html',
   'private', true, 1, '{"registration":"initial-migration"}'::jsonb),
  ('b1-adaptive-grammar-diagnostic', 'B1 Adaptive Grammar Diagnostic',
   'Adaptive diagnostic across grammar skills.', 'English Grammar', 'B1',
   'adaptive-diagnostic', 'b1-adaptive-grammar-v1', 'github-html',
   'b1-diagnostic.html', 'github:b1-diagnostic.html',
   'private', true, 1, '{"registration":"initial-migration"}'::jsonb)
on conflict (source_key) do update set
  title = excluded.title,
  description = excluded.description,
  subject = excluded.subject,
  cefr_level = excluded.cefr_level,
  assessment_type = excluded.assessment_type,
  engine_key = excluded.engine_key,
  source_kind = excluded.source_kind,
  source_path = excluded.source_path,
  updated_at = now();

-- Register existing Assessment Builder records without copying their question data.
-- Existing assessment IDs are preserved as source_record_id.
-- Importantly, all new catalogue records start private, regardless of the legacy is_published flag.
insert into public.test_catalog
  (slug, title, description, subject, cefr_level, assessment_type, engine_key,
   source_kind, source_table, source_record_id, source_key, publication_status, is_active, metadata)
select
  'assessment-' || a.id::text,
  a.title,
  a.description,
  nullif(a.assessment_data->>'subject', ''),
  case
    when upper(coalesce(a.assessment_data->>'cefrLevel', a.assessment_data->>'cefr_level', '')) in
      ('PRE-A1','A1','A2','B1','B2','C1','C2')
    then case upper(coalesce(a.assessment_data->>'cefrLevel', a.assessment_data->>'cefr_level', ''))
      when 'PRE-A1' then 'Pre-A1'
      else upper(coalesce(a.assessment_data->>'cefrLevel', a.assessment_data->>'cefr_level', ''))
    end
    else null
  end,
  'quiz',
  a.engine_key,
  'supabase-row',
  'assessments',
  a.id::text,
  'assessment:' || a.id::text,
  'private',
  coalesce(a.is_active, true),
  jsonb_build_object('registration','initial-migration','legacy_assessment_data',jsonb_build_object('level',a.assessment_data->>'level'))
from public.assessments a
on conflict (source_key) do update set
  title = excluded.title,
  description = excluded.description,
  subject = coalesce(excluded.subject, public.test_catalog.subject),
  cefr_level = coalesce(excluded.cefr_level, public.test_catalog.cefr_level),
  engine_key = excluded.engine_key,
  is_active = excluded.is_active,
  updated_at = now();

-- Writing assignments are registered as catalogue entries grouped by their task content.
-- Class-specific assignment rows stay in writing_assignments and are not modified.
insert into public.test_catalog
  (slug, title, description, subject, cefr_level, assessment_type, engine_key,
   source_kind, source_table, source_record_id, source_key, publication_status, is_active, metadata)
select
  'writing-' || md5(coalesce(w.title,'') || '|' || coalesce(w.prompt,'') || '|' ||
                    coalesce(w.instructions,'') || '|' || coalesce(w.rubric_key,'')),
  w.title,
  left(coalesce(w.prompt,''), 500),
  'Writing',
  case
    when coalesce(w.instructions,'') ~* '(^|[^A-Z0-9])B2([^A-Z0-9]|$)' then 'B2'
    when coalesce(w.instructions,'') ~* '(^|[^A-Z0-9])B1([^A-Z0-9]|$)' then 'B1'
    when coalesce(w.instructions,'') ~* '(^|[^A-Z0-9])A2([^A-Z0-9]|$)' then 'A2'
    else null
  end,
  'writing',
  'writing-assignment-v1',
  'supabase-row',
  'writing_assignments',
  min(w.id::text),
  'writing:' || md5(coalesce(w.title,'') || '|' || coalesce(w.prompt,'') || '|' ||
                    coalesce(w.instructions,'') || '|' || coalesce(w.rubric_key,'')),
  'private',
  true,
  jsonb_build_object('registration','initial-migration','rubric_key',min(w.rubric_key))
from public.writing_assignments w
group by w.title, w.prompt, w.instructions, w.rubric_key
on conflict (source_key) do update set
  title = excluded.title,
  description = excluded.description,
  subject = coalesce(excluded.subject, public.test_catalog.subject),
  cefr_level = coalesce(excluded.cefr_level, public.test_catalog.cefr_level),
  updated_at = now();

-- Verification after applying:
-- select source_kind, assessment_type, count(*) from public.test_catalog group by 1,2 order by 1,2;
-- select slug, title, subject, cefr_level, source_kind, source_path, source_table, publication_status
-- from public.test_catalog order by title;
