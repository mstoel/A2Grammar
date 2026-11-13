-- EduAssess: inspect grammar diagnostic database schema.
-- READ ONLY: does not modify any database records.
-- Returns one JSON result containing relevant public tables and their columns.
-- Run this before building a student-specific diagnostic export.

SELECT COALESCE(
  jsonb_agg(
    jsonb_build_object(
      'table', c.table_name,
      'column', c.column_name,
      'type', c.data_type,
      'udt', c.udt_name,
      'nullable', c.is_nullable
    )
    ORDER BY c.table_name, c.ordinal_position
  ),
  '[]'::jsonb
) AS diagnostic_schema
FROM information_schema.columns AS c
WHERE c.table_schema = 'public'
  AND (
    c.table_name ILIKE '%grammar%'
    OR c.table_name ILIKE '%diagnostic%'
    OR c.table_name ILIKE '%assessment%'
    OR c.table_name ILIKE '%question%'
    OR c.table_name ILIKE '%answer%'
    OR c.table_name ILIKE '%response%'
    OR c.table_name ILIKE '%attempt%'
    OR c.table_name ILIKE '%result%'
    OR c.table_name ILIKE '%student%'
  );
