-- HSK 2 shows Pinyin on 24/30 questions (80%).
-- HSK 3 shows Pinyin on 6/30 questions (20%).
-- The remaining questions practise Chinese character recognition without hints.
-- Safe to run more than once.
begin;

update public.hsk_questions
set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'showPinyin',
      case
        when level = 2 and (
          question_id like 'hsk2-vocabulary-%'
          or question_id in (
            'hsk2-character-recognition-01','hsk2-character-recognition-02',
            'hsk2-character-recognition-03','hsk2-character-recognition-04',
            'hsk2-character-recognition-05','hsk2-character-recognition-06',
            'hsk2-character-recognition-07','hsk2-character-recognition-08',
            'hsk2-character-recognition-09'
          )
        ) then true
        when level = 3 and question_id in (
          'hsk3-vocabulary-01','hsk3-vocabulary-02','hsk3-vocabulary-03',
          'hsk3-vocabulary-04','hsk3-vocabulary-05','hsk3-vocabulary-06'
        ) then true
        else false
      end
    ),
    updated_at = now()
where is_published = true
  and level in (2,3)
  and skill = 'vocabulary'
  and question_id like 'hsk%';

-- Verify the expected split: HSK 2 = 24/6, HSK 3 = 6/24.
select level,
       count(*) as published_questions,
       count(*) filter (where coalesce((metadata->>'showPinyin')::boolean, false)) as with_pinyin,
       count(*) filter (where not coalesce((metadata->>'showPinyin')::boolean, false)) as without_pinyin
from public.hsk_questions
where is_published = true
  and level in (2,3)
  and skill = 'vocabulary'
  and question_id like 'hsk%'
group by level
order by level;

commit;
