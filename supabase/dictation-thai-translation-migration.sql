-- Add Thai translations for Dictation Academy vocabulary.
-- Safe to run more than once in the existing Supabase project.
alter table public.dictation_words
  add column if not exists thai_translation text not null default '';
