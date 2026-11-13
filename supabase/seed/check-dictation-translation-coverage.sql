-- Dictation Academy: translation coverage audit for every vocabulary level.
-- Read-only. Does not modify vocabulary, attempts, scores, or student progress.
-- Run in Supabase SQL Editor.

SELECT
  level_code,
  COUNT(*) AS total_active_words,
  COUNT(*) FILTER (
    WHERE NULLIF(TRIM(thai_translation), '') IS NOT NULL
  ) AS translated,
  COUNT(*) FILTER (
    WHERE NULLIF(TRIM(thai_translation), '') IS NULL
  ) AS missing,
  ROUND(
    100.0 * COUNT(*) FILTER (
      WHERE NULLIF(TRIM(thai_translation), '') IS NOT NULL
    ) / NULLIF(COUNT(*), 0),
    1
  ) AS coverage_percent
FROM public.dictation_words
WHERE is_active = true
GROUP BY level_code
ORDER BY
  CASE
    WHEN level_code ILIKE 'pre-a1' THEN 0
    WHEN level_code ILIKE 'a1' THEN 1
    WHEN level_code ILIKE 'a1+' THEN 2
    WHEN level_code ILIKE 'a2' THEN 3
    WHEN level_code ILIKE 'a2+' THEN 4
    WHEN level_code ILIKE 'b1' THEN 5
    WHEN level_code ILIKE 'b1+' THEN 6
    WHEN level_code ILIKE 'b2' THEN 7
    WHEN level_code ILIKE 'b2+' THEN 8
    WHEN level_code ILIKE 'c1' THEN 9
    WHEN level_code ILIKE 'c1+' THEN 10
    WHEN level_code ILIKE 'c2' THEN 11
    ELSE 99
  END,
  level_code;

-- Optional: after reviewing the summary, run this second query to list
-- the exact words still missing Thai translations in any level.
SELECT
  level_code,
  word
FROM public.dictation_words
WHERE is_active = true
  AND NULLIF(TRIM(thai_translation), '') IS NULL
ORDER BY level_code, word;
