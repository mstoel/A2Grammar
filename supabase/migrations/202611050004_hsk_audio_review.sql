-- Separate generated audio from teacher-approved audio.
begin;
alter table public.hsk_questions
  add column if not exists audio_reviewed boolean not null default false;
alter table public.hsk_questions
  add column if not exists audio_reviewed_at timestamptz;
commit;
