-- HSK 2 and HSK 3 must not display Pinyin during questions.
-- Pinyin remains available in the explanation/review content after submission.
-- Safe to run more than once.
begin;

update public.hsk_questions
set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('showPinyin', false),
    updated_at = now()
where is_published = true
  and level in (2,3)
  and skill = 'vocabulary'
  and question_id like 'hsk%';

-- Confirm that no published HSK 2/3 vocabulary item is flagged to show Pinyin.
select level,
       count(*) as published_questions,
       count(*) filter (where coalesce((metadata->>'showPinyin')::boolean, false)) as still_flagged_with_pinyin
from public.hsk_questions
where is_published = true
  and level in (2,3)
  and skill = 'vocabulary'
  and question_id like 'hsk%'
group by level
order by level;

commit;
