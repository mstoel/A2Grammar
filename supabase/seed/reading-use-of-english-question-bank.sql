-- EduAssess Reading & Use of English question bank
-- Initial R01 A2 seed. Safe to re-run: question_code is unique and rows are upserted.
-- Answers remain server-side; no client-facing SELECT policy is created here.
begin;

create table if not exists public.reading_question_bank (
  id uuid primary key default gen_random_uuid(),
  question_code text not null unique,
  category text not null,
  cefr_level text not null check (cefr_level in ('A2','B1','B2','C1','C2')),
  topic text not null,
  skill text not null,
  passage text not null default '',
  prompt text not null,
  options jsonb not null,
  correct_option text not null check (correct_option in ('A','B','C','D')),
  rationale text not null,
  difficulty text not null default 'core'
    check (difficulty in ('lower_boundary','core','upper_boundary')),
  estimated_seconds integer not null default 60 check (estimated_seconds > 0),
  status text not null default 'draft'
    check (status in ('draft','reviewed','approved','retired')),
  source_label text not null default 'Original EduAssess content',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reading_question_bank_options_array check (jsonb_typeof(options) = 'array')
);

create index if not exists reading_question_bank_level_category_idx
  on public.reading_question_bank (cefr_level, category, status);

alter table public.reading_question_bank enable row level security;

insert into public.reading_question_bank
(question_code, category, cefr_level, topic, skill, passage, prompt, options, correct_option, rationale, difficulty, estimated_seconds, status)
values
(
 'A2-002','R01','A2','Health and Nutrition','Identifying specific information',
 'GREEN LEAF CAFÉ
Our lunch menu changes every Monday.
This week, we are offering chicken rice, vegetable soup and fresh fruit.
Customers with food allergies should speak to a member of staff before ordering.
Please order at the counter. Your food will be brought to your table.',
 'What should customers with food allergies do?',
 '[{"label":"A","text":"Choose the vegetable soup."},{"label":"B","text":"Ask a staff member before ordering."},{"label":"C","text":"Order their food at the table."},{"label":"D","text":"Visit the café on Monday."}]'::jsonb,
 'B',
 'The notice tells customers with allergies to speak to a staff member before ordering.',
 'core',45,'draft'
),
(
 'A2-008','R01','A2','Consumer Economics','Understanding conditions and rules',
 'CITY SPORTS – RETURNS
If you are unhappy with an item, you may return it within 14 days.
Items must be unused and have their original labels.
Shoes that have been worn outdoors cannot be returned unless they are faulty.
Please bring your receipt when visiting the shop.',
 'Which customer can return their shoes?',
 '[{"label":"A","text":"A customer who wore the shoes outside once."},{"label":"B","text":"A customer who lost the receipt."},{"label":"C","text":"A customer whose shoes are unused and still have their labels."},{"label":"D","text":"A customer who bought the shoes several months ago."}]'::jsonb,
 'C',
 'The policy requires items to be unused and have their original labels. The customer in option C meets those conditions.',
 'core',60,'draft'
)
on conflict (question_code) do update set
  category = excluded.category,
  cefr_level = excluded.cefr_level,
  topic = excluded.topic,
  skill = excluded.skill,
  passage = excluded.passage,
  prompt = excluded.prompt,
  options = excluded.options,
  correct_option = excluded.correct_option,
  rationale = excluded.rationale,
  difficulty = excluded.difficulty,
  estimated_seconds = excluded.estimated_seconds,
  status = excluded.status,
  updated_at = now();

commit;

-- Verification
select question_code, cefr_level, category, status
from public.reading_question_bank
where question_code in ('A2-002','A2-008')
order by question_code;
