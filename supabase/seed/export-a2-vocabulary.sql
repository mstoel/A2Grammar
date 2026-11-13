-- Dictation Academy: export the complete active A2 word list.
-- Read-only. Returns one row containing every word, newline-separated,
-- avoiding Supabase's default 100-row results display limit.

SELECT
  COUNT(*) AS total_words,
  string_agg(word, E'\n' ORDER BY word) AS vocabulary
FROM public.dictation_words
WHERE level_code = 'A2'
  AND is_active = true;
