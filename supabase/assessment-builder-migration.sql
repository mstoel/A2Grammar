-- Assessment builder integration: store the authored assessment payload and privacy preferences.
-- Safe additive migration. Does not alter existing tests or student attempts.
-- Run in Supabase SQL Editor after reviewing the SQL.

alter table public.assessments
  add column if not exists assessment_data jsonb,
  add column if not exists result_storage_mode text not null default 'anonymous',
  add column if not exists question_analytics boolean not null default true;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'assessments_result_storage_mode_check'
      and conrelid = 'public.assessments'::regclass
  ) then
    alter table public.assessments
      add constraint assessments_result_storage_mode_check
      check (result_storage_mode in ('none', 'anonymous', 'identified'));
  end if;
end $$;

comment on column public.assessments.assessment_data is
  'Teacher-authored assessment payload. Keep answer keys accessible only to authorized teachers and validated server-side student workflows.';
comment on column public.assessments.result_storage_mode is
  'Requested result policy: none, anonymous, or identified. Backend workflows must enforce this setting; this column alone does not enforce storage behavior.';
comment on column public.assessments.question_analytics is
  'Whether question-level analytics are enabled for this assessment. Backend workflows must avoid storing direct identifiers in anonymous analytics.';
