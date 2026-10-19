-- Allow a published writing assignment to appear in the school's Open Tests area
-- without assigning it to a particular class. Students still need a valid school student session.
alter table public.writing_assignments
  add column if not exists is_open_test boolean not null default false;

create index if not exists writing_assignments_open_tests_idx
  on public.writing_assignments (school_id, status, is_open_test, created_at desc);

comment on column public.writing_assignments.is_open_test is
  'When true, this published writing task is available to all active students in the same school, regardless of class assignment.';
