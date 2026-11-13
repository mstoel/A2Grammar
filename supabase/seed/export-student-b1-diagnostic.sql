-- EduAssess: export one student's B1 grammar diagnostic.
-- READ ONLY. Does not modify student records or diagnostic results.
-- Finds student by display name containing "Tata".
-- Returns matching B1 diagnostic result(s), including the full JSON report.

SELECT
  s.student_code,
  s.display_name,
  dr.id AS diagnostic_result_id,
  dr.diagnostic_key,
  dr.completed_at,
  dr.overall_percent,
  dr.questions_answered,
  dr.correct_count,
  dr.skills_passed_or_secure,
  dr.skills_extended,
  dr.report
FROM public.students AS s
JOIN public.diagnostic_results AS dr
  ON dr.student_id = s.id
WHERE s.display_name ILIKE '%Tata%'
  AND dr.diagnostic_key ILIKE '%B1%'
ORDER BY dr.completed_at DESC;

-- If the first query returns no rows, run this fallback to see
-- all diagnostic keys/results associated with students named Tata.
SELECT
  s.student_code,
  s.display_name,
  dr.diagnostic_key,
  dr.completed_at,
  dr.overall_percent,
  dr.questions_answered,
  dr.correct_count,
  dr.report
FROM public.students AS s
JOIN public.diagnostic_results AS dr
  ON dr.student_id = s.id
WHERE s.display_name ILIKE '%Tata%'
ORDER BY dr.completed_at DESC;
