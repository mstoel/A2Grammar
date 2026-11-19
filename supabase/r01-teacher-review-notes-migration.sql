-- R01 teacher-only question review notes and read access
-- Run once in Supabase SQL Editor.
begin;

drop policy if exists "R01 bank read by authenticated teachers" on public.reading_question_bank;
create policy "R01 bank read by authenticated teachers"
on public.reading_question_bank
for select
to authenticated
using (
  exists (
    select 1
    from public.school_memberships sm
    where sm.user_id = auth.uid()
      and sm.role in ('owner','admin','teacher')
  )
);

create table if not exists public.reading_question_review_notes (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.reading_question_bank(id) on delete cascade,
  teacher_id uuid not null references auth.users(id) on delete cascade,
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(question_id, teacher_id)
);

alter table public.reading_question_review_notes enable row level security;

drop policy if exists "Teachers read their own R01 review notes" on public.reading_question_review_notes;
create policy "Teachers read their own R01 review notes"
on public.reading_question_review_notes
for select to authenticated
using (teacher_id = auth.uid());

drop policy if exists "Teachers insert their own R01 review notes" on public.reading_question_review_notes;
create policy "Teachers insert their own R01 review notes"
on public.reading_question_review_notes
for insert to authenticated
with check (
  teacher_id = auth.uid()
  and exists (
    select 1 from public.school_memberships sm
    where sm.user_id = auth.uid()
      and sm.role in ('owner','admin','teacher')
  )
);

drop policy if exists "Teachers update their own R01 review notes" on public.reading_question_review_notes;
create policy "Teachers update their own R01 review notes"
on public.reading_question_review_notes
for update to authenticated
using (teacher_id = auth.uid())
with check (teacher_id = auth.uid());

commit;
