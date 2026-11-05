-- HSK 2 and HSK 3 vocabulary + character recognition question bank.
-- Supplemental seed: run once in the PRODUCTION SchoolAssessmentPlatform SQL Editor.
-- HSK 1 is not modified. Each level/skill has 15 items so EduAssess can unlock it.
-- The vocabulary sets deliberately mix Chinese -> English and English -> Chinese.
begin;

insert into public.hsk_questions
(question_id, level, skill, item_type, prompt, stimulus, options, answer_key, explanation, source_reference, is_published)
values
-- HSK 2 vocabulary: Chinese -> English and English -> Chinese
('hsk2-vocabulary-01',2,'vocabulary','multiple_choice','What does 因为 mean?','','["Because","Although","Together","Already"]'::jsonb,'{"correctIndex":0}'::jsonb,'因为 (yīnwèi) means because.','HSK 3.0 Level 2 vocabulary · original EduAssess item',true),
('hsk2-vocabulary-02',2,'vocabulary','multiple_choice','Choose the Chinese word for ''together''.','','["已经","一起","开始","结束"]'::jsonb,'{"correctIndex":1}'::jsonb,'一起 (yìqǐ) means together.','HSK 3.0 Level 2 vocabulary · original EduAssess item',true),
('hsk2-vocabulary-03',2,'vocabulary','multiple_choice','What does 已经 mean?','已经','["At the moment","Together","Already","Perhaps"]'::jsonb,'{"correctIndex":2}'::jsonb,'已经 (yǐjīng) means already.','HSK 3.0 Level 2 vocabulary · original EduAssess item',true),
('hsk2-vocabulary-04',2,'vocabulary','multiple_choice','Choose the Chinese word for ''to begin''.','','["结束","帮助","觉得","开始"]'::jsonb,'{"correctIndex":3}'::jsonb,'开始 (kāishǐ) means to begin or start.','HSK 3.0 Level 2 vocabulary · original EduAssess item',true),
('hsk2-vocabulary-05',2,'vocabulary','multiple_choice','What does 但是 mean?','但是','["But","Because","Together","Already"]'::jsonb,'{"correctIndex":0}'::jsonb,'但是 (dànshì) means but.','HSK 3.0 Level 2 vocabulary · original EduAssess item',true),
('hsk2-vocabulary-06',2,'vocabulary','multiple_choice','Choose the Chinese word for ''to help''.','','["希望","帮助","考试","时间"]'::jsonb,'{"correctIndex":1}'::jsonb,'帮助 (bāngzhù) means to help.','HSK 3.0 Level 2 vocabulary · original EduAssess item',true),
('hsk2-vocabulary-07',2,'vocabulary','multiple_choice','What does 正在 mean?','正在','["Already","Together","In the middle of doing something","At the end"]'::jsonb,'{"correctIndex":2}'::jsonb,'正在 (zhèngzài) indicates an action in progress.','HSK 3.0 Level 2 vocabulary · original EduAssess item',true),
('hsk2-vocabulary-08',2,'vocabulary','multiple_choice','Choose the Chinese word for ''problem / question''.','','["问题","地方","公司","旅行"]'::jsonb,'{"correctIndex":0}'::jsonb,'问题 (wèntí) means problem or question.','HSK 3.0 Level 2 vocabulary · original EduAssess item',true),
('hsk2-vocabulary-09',2,'vocabulary','multiple_choice','What does 觉得 mean?','觉得','["To prepare","To feel / think","To finish","To choose"]'::jsonb,'{"correctIndex":1}'::jsonb,'觉得 (juéde) means to feel or think.','HSK 3.0 Level 2 vocabulary · original EduAssess item',true),
('hsk2-vocabulary-10',2,'vocabulary','multiple_choice','Choose the Chinese word for ''exam''.','','["时间","地方","考试","问题"]'::jsonb,'{"correctIndex":2}'::jsonb,'考试 (kǎoshì) means exam or test.','HSK 3.0 Level 2 vocabulary · original EduAssess item',true),
('hsk2-vocabulary-11',2,'vocabulary','multiple_choice','What does 希望 mean?','希望','["To hope","To begin","To help","To end"]'::jsonb,'{"correctIndex":0}'::jsonb,'希望 (xīwàng) means to hope or wish.','HSK 3.0 Level 2 vocabulary · original EduAssess item',true),
('hsk2-vocabulary-12',2,'vocabulary','multiple_choice','Choose the Chinese word for ''to prepare''.','','["结束","准备","已经","但是"]'::jsonb,'{"correctIndex":1}'::jsonb,'准备 (zhǔnbèi) means to prepare.','HSK 3.0 Level 2 vocabulary · original EduAssess item',true),
('hsk2-vocabulary-13',2,'vocabulary','multiple_choice','What does 结束 mean?','结束','["To start","To help","To finish / end","To hope"]'::jsonb,'{"correctIndex":2}'::jsonb,'结束 (jiéshù) means to finish or end.','HSK 3.0 Level 2 vocabulary · original EduAssess item',true),
('hsk2-vocabulary-14',2,'vocabulary','multiple_choice','Choose the Chinese word for ''time''.','','["地方","公司","时间","旅行"]'::jsonb,'{"correctIndex":2}'::jsonb,'时间 (shíjiān) means time.','HSK 3.0 Level 2 vocabulary · original EduAssess item',true),
('hsk2-vocabulary-15',2,'vocabulary','multiple_choice','What does 一起 mean?','一起','["Already","Together","But","Because"]'::jsonb,'{"correctIndex":1}'::jsonb,'一起 (yìqǐ) means together.','HSK 3.0 Level 2 vocabulary · original EduAssess item',true),

-- HSK 2 character recognition: select the meaning of the Chinese word
('hsk2-character-recognition-01',2,'character_recognition','multiple_choice','What does 所以 mean?','所以','["Because","So / therefore","But","Although"]'::jsonb,'{"correctIndex":1}'::jsonb,'所以 (suǒyǐ) means so or therefore.','HSK 3.0 Level 2 vocabulary · original EduAssess item',true),
('hsk2-character-recognition-02',2,'character_recognition','multiple_choice','What does 地方 mean?','地方','["Time","Company","Place","Airport"]'::jsonb,'{"correctIndex":2}'::jsonb,'地方 (dìfang) means place.','HSK 3.0 Level 2 vocabulary · original EduAssess item',true),
('hsk2-character-recognition-03',2,'character_recognition','multiple_choice','What does 公司 mean?','公司','["Company","School","Hospital","Shop"]'::jsonb,'{"correctIndex":0}'::jsonb,'公司 (gōngsī) means company.','HSK 3.0 Level 2 vocabulary · original EduAssess item',true),
('hsk2-character-recognition-04',2,'character_recognition','multiple_choice','What does 旅行 mean?','旅行','["To study","To travel","To work","To wait"]'::jsonb,'{"correctIndex":1}'::jsonb,'旅行 (lǚxíng) means to travel.','HSK 3.0 Level 2 vocabulary · original EduAssess item',true),
('hsk2-character-recognition-05',2,'character_recognition','multiple_choice','What does 机场 mean?','机场','["Train station","Bus stop","Airport","Hotel"]'::jsonb,'{"correctIndex":2}'::jsonb,'机场 (jīchǎng) means airport.','HSK 3.0 Level 2 vocabulary · original EduAssess item',true),
('hsk2-character-recognition-06',2,'character_recognition','multiple_choice','What does 便宜 mean?','便宜','["Expensive","Cheap","Convenient","Difficult"]'::jsonb,'{"correctIndex":1}'::jsonb,'便宜 (piányi) means cheap or inexpensive.','HSK 3.0 Level 2 vocabulary · original EduAssess item',true),
('hsk2-character-recognition-07',2,'character_recognition','multiple_choice','What does 应该 mean?','应该','["Should / ought to","Already","Together","To finish"]'::jsonb,'{"correctIndex":0}'::jsonb,'应该 (yīnggāi) means should or ought to.','HSK 3.0 Level 2 vocabulary · original EduAssess item',true),
('hsk2-character-recognition-08',2,'character_recognition','multiple_choice','What does 需要 mean?','需要','["To hope","To need","To remember","To begin"]'::jsonb,'{"correctIndex":1}'::jsonb,'需要 (xūyào) means to need.','HSK 3.0 Level 2 vocabulary · original EduAssess item',true),
('hsk2-character-recognition-09',2,'character_recognition','multiple_choice','What does 特别 mean?','特别','["Ordinary","Special / especially","Together","Quickly"]'::jsonb,'{"correctIndex":1}'::jsonb,'特别 (tèbié) means special or especially.','HSK 3.0 Level 2 vocabulary · original EduAssess item',true),
('hsk2-character-recognition-10',2,'character_recognition','multiple_choice','What does 选择 mean?','选择','["To choose","To explain","To forget","To travel"]'::jsonb,'{"correctIndex":0}'::jsonb,'选择 (xuǎnzé) means to choose.','HSK 3.0 Level 2 vocabulary · original EduAssess item',true),
('hsk2-character-recognition-11',2,'character_recognition','multiple_choice','What does 决定 mean?','决定','["To prepare","To decide","To help","To finish"]'::jsonb,'{"correctIndex":1}'::jsonb,'决定 (juédìng) means to decide.','HSK 3.0 Level 2 vocabulary · original EduAssess item',true),
('hsk2-character-recognition-12',2,'character_recognition','multiple_choice','What does 参加 mean?','参加','["To join / participate","To improve","To influence","To change"]'::jsonb,'{"correctIndex":0}'::jsonb,'参加 (cānjiā) means to join or participate.','HSK 3.0 Level 2 vocabulary · original EduAssess item',true),
('hsk2-character-recognition-13',2,'character_recognition','multiple_choice','What does 注意 mean?','注意','["To develop","To pay attention","To succeed","To solve"]'::jsonb,'{"correctIndex":1}'::jsonb,'注意 (zhùyì) means to pay attention.','HSK 3.0 Level 2 vocabulary · original EduAssess item',true),
('hsk2-character-recognition-14',2,'character_recognition','multiple_choice','What does 习惯 mean?','习惯','["Experience","Habit / to be used to","Environment","History"]'::jsonb,'{"correctIndex":1}'::jsonb,'习惯 (xíguàn) means habit or to be used to.','HSK 3.0 Level 2 vocabulary · original EduAssess item',true),
('hsk2-character-recognition-15',2,'character_recognition','multiple_choice','What does 解决 mean?','解决','["To solve","To decide","To change","To understand"]'::jsonb,'{"correctIndex":0}'::jsonb,'解决 (jiějué) means to solve.','HSK 3.0 Level 2 vocabulary · original EduAssess item',true),

-- HSK 3 vocabulary: more independent character reading
('hsk3-vocabulary-01',3,'vocabulary','multiple_choice','What does 影响 mean?','影响','["Influence / effect","Experience","Environment","Opportunity"]'::jsonb,'{"correctIndex":0}'::jsonb,'影响 (yǐngxiǎng) means influence or effect.','HSK 3.0 Level 3 vocabulary · original EduAssess item',true),
('hsk3-vocabulary-02',3,'vocabulary','multiple_choice','Choose the Chinese word for ''experience''.','','["经验","环境","文化","历史"]'::jsonb,'{"correctIndex":0}'::jsonb,'经验 (jīngyàn) means experience.','HSK 3.0 Level 3 vocabulary · original EduAssess item',true),
('hsk3-vocabulary-03',3,'vocabulary','multiple_choice','What does 提高 mean?','提高','["To reduce","To improve / raise","To explain","To remember"]'::jsonb,'{"correctIndex":1}'::jsonb,'提高 (tígāo) means to improve or raise.','HSK 3.0 Level 3 vocabulary · original EduAssess item',true),
('hsk3-vocabulary-04',3,'vocabulary','multiple_choice','Choose the Chinese word for ''opportunity''.','','["变化","发展","机会","成功"]'::jsonb,'{"correctIndex":2}'::jsonb,'机会 (jīhuì) means opportunity.','HSK 3.0 Level 3 vocabulary · original EduAssess item',true),
('hsk3-vocabulary-05',3,'vocabulary','multiple_choice','What does 发展 mean?','发展','["Development / to develop","Decision","Habit","Attention"]'::jsonb,'{"correctIndex":0}'::jsonb,'发展 (fāzhǎn) means development or to develop.','HSK 3.0 Level 3 vocabulary · original EduAssess item',true),
('hsk3-vocabulary-06',3,'vocabulary','multiple_choice','Choose the Chinese word for ''to succeed / success''.','','["失败","成功","决定","经验"]'::jsonb,'{"correctIndex":1}'::jsonb,'成功 (chénggōng) means to succeed or success.','HSK 3.0 Level 3 vocabulary · original EduAssess item',true),
('hsk3-vocabulary-07',3,'vocabulary','multiple_choice','What does 环境 mean?','环境','["Culture","History","Environment","News"]'::jsonb,'{"correctIndex":2}'::jsonb,'环境 (huánjìng) means environment.','HSK 3.0 Level 3 vocabulary · original EduAssess item',true),
('hsk3-vocabulary-08',3,'vocabulary','multiple_choice','Choose the Chinese word for ''to solve''.','','["解决","选择","影响","参加"]'::jsonb,'{"correctIndex":0}'::jsonb,'解决 (jiějué) means to solve.','HSK 3.0 Level 3 vocabulary · original EduAssess item',true),
('hsk3-vocabulary-09',3,'vocabulary','multiple_choice','What does 文化 mean?','文化','["History","Culture","World","News"]'::jsonb,'{"correctIndex":1}'::jsonb,'文化 (wénhuà) means culture.','HSK 3.0 Level 3 vocabulary · original EduAssess item',true),
('hsk3-vocabulary-10',3,'vocabulary','multiple_choice','Choose the Chinese word for ''important''.','','["认真","清楚","复杂","重要"]'::jsonb,'{"correctIndex":3}'::jsonb,'重要 (zhòngyào) means important.','HSK 3.0 Level 3 vocabulary · original EduAssess item',true),
('hsk3-vocabulary-11',3,'vocabulary','multiple_choice','What does 变化 mean?','变化','["Change","Success","Experience","Decision"]'::jsonb,'{"correctIndex":0}'::jsonb,'变化 (biànhuà) means change.','HSK 3.0 Level 3 vocabulary · original EduAssess item',true),
('hsk3-vocabulary-12',3,'vocabulary','multiple_choice','Choose the Chinese word for ''to participate''.','','["注意","关心","参加","提高"]'::jsonb,'{"correctIndex":2}'::jsonb,'参加 (cānjiā) means to participate.','HSK 3.0 Level 3 vocabulary · original EduAssess item',true),
('hsk3-vocabulary-13',3,'vocabulary','multiple_choice','What does 机会 mean?','机会','["Development","Opportunity","Environment","Culture"]'::jsonb,'{"correctIndex":1}'::jsonb,'机会 (jīhuì) means opportunity.','HSK 3.0 Level 3 vocabulary · original EduAssess item',true),
('hsk3-vocabulary-14',3,'vocabulary','multiple_choice','Choose the Chinese word for ''to pay attention''.','','["关心","注意","解决","发展"]'::jsonb,'{"correctIndex":1}'::jsonb,'注意 (zhùyì) means to pay attention.','HSK 3.0 Level 3 vocabulary · original EduAssess item',true),
('hsk3-vocabulary-15',3,'vocabulary','multiple_choice','What does 重要 mean?','重要','["Difficult","Special","Important","Successful"]'::jsonb,'{"correctIndex":2}'::jsonb,'重要 (zhòngyào) means important.','HSK 3.0 Level 3 vocabulary · original EduAssess item',true),

-- HSK 3 character recognition: Chinese -> meaning
('hsk3-character-recognition-01',3,'character_recognition','multiple_choice','What does 复杂 mean?','复杂','["Simple","Complicated","Successful","Convenient"]'::jsonb,'{"correctIndex":1}'::jsonb,'复杂 (fùzá) means complicated.','HSK 3.0 Level 3 vocabulary · original EduAssess item',true),
('hsk3-character-recognition-02',3,'character_recognition','multiple_choice','What does 认真 mean?','认真','["Careful / serious","Special","Cheap","Together"]'::jsonb,'{"correctIndex":0}'::jsonb,'认真 (rènzhēn) means careful or serious.','HSK 3.0 Level 3 vocabulary · original EduAssess item',true),
('hsk3-character-recognition-03',3,'character_recognition','multiple_choice','What does 清楚 mean?','清楚','["Clear","Complicated","Important","Different"]'::jsonb,'{"correctIndex":0}'::jsonb,'清楚 (qīngchu) means clear.','HSK 3.0 Level 3 vocabulary · original EduAssess item',true),
('hsk3-character-recognition-04',3,'character_recognition','multiple_choice','What does 关心 mean?','关心','["To forget","To care about","To develop","To decide"]'::jsonb,'{"correctIndex":1}'::jsonb,'关心 (guānxīn) means to care about.','HSK 3.0 Level 3 vocabulary · original EduAssess item',true),
('hsk3-character-recognition-05',3,'character_recognition','multiple_choice','What does 世界 mean?','世界','["World","Culture","History","Environment"]'::jsonb,'{"correctIndex":0}'::jsonb,'世界 (shìjiè) means world.','HSK 3.0 Level 3 vocabulary · original EduAssess item',true),
('hsk3-character-recognition-06',3,'character_recognition','multiple_choice','What does 历史 mean?','历史','["News","History","Experience","Development"]'::jsonb,'{"correctIndex":1}'::jsonb,'历史 (lìshǐ) means history.','HSK 3.0 Level 3 vocabulary · original EduAssess item',true),
('hsk3-character-recognition-07',3,'character_recognition','multiple_choice','What does 新闻 mean?','新闻','["News","World","Culture","Change"]'::jsonb,'{"correctIndex":0}'::jsonb,'新闻 (xīnwén) means news.','HSK 3.0 Level 3 vocabulary · original EduAssess item',true),
('hsk3-character-recognition-08',3,'character_recognition','multiple_choice','What does 交通 mean?','交通','["Transportation / traffic","Environment","Opportunity","Experience"]'::jsonb,'{"correctIndex":0}'::jsonb,'交通 (jiāotōng) means transportation or traffic.','HSK 3.0 Level 3 vocabulary · original EduAssess item',true),
('hsk3-character-recognition-09',3,'character_recognition','multiple_choice','What does 发展 mean?','发展','["To develop","To solve","To choose","To influence"]'::jsonb,'{"correctIndex":0}'::jsonb,'发展 (fāzhǎn) means to develop.','HSK 3.0 Level 3 vocabulary · original EduAssess item',true),
('hsk3-character-recognition-10',3,'character_recognition','multiple_choice','What does 经验 mean?','经验','["Experience","Environment","History","Culture"]'::jsonb,'{"correctIndex":0}'::jsonb,'经验 (jīngyàn) means experience.','HSK 3.0 Level 3 vocabulary · original EduAssess item',true),
('hsk3-character-recognition-11',3,'character_recognition','multiple_choice','What does 选择 mean?','选择','["To decide","To choose","To improve","To join"]'::jsonb,'{"correctIndex":1}'::jsonb,'选择 (xuǎnzé) means to choose.','HSK 3.0 Level 3 vocabulary · original EduAssess item',true),
('hsk3-character-recognition-12',3,'character_recognition','multiple_choice','What does 决定 mean?','决定','["To decide","To develop","To solve","To succeed"]'::jsonb,'{"correctIndex":0}'::jsonb,'决定 (juédìng) means to decide.','HSK 3.0 Level 3 vocabulary · original EduAssess item',true),
('hsk3-character-recognition-13',3,'character_recognition','multiple_choice','What does 成功 mean?','成功','["Failure","Success","Change","Opportunity"]'::jsonb,'{"correctIndex":1}'::jsonb,'成功 (chénggōng) means success.','HSK 3.0 Level 3 vocabulary · original EduAssess item',true),
('hsk3-character-recognition-14',3,'character_recognition','multiple_choice','What does 提高 mean?','提高','["To lower","To improve / raise","To explain","To prepare"]'::jsonb,'{"correctIndex":1}'::jsonb,'提高 (tígāo) means to improve or raise.','HSK 3.0 Level 3 vocabulary · original EduAssess item',true),
('hsk3-character-recognition-15',3,'character_recognition','multiple_choice','What does 参加 mean?','参加','["To participate","To influence","To pay attention","To care about"]'::jsonb,'{"correctIndex":0}'::jsonb,'参加 (cānjiā) means to participate.','HSK 3.0 Level 3 vocabulary · original EduAssess item',true)

on conflict (question_id) do update set
 prompt=excluded.prompt,
 stimulus=excluded.stimulus,
 options=excluded.options,
 answer_key=excluded.answer_key,
 explanation=excluded.explanation,
 source_reference=excluded.source_reference,
 is_published=true,
 updated_at=now();

update public.hsk_questions
set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('showPinyin', level = 2),
    updated_at = now()
where level in (2,3)
  and skill in ('vocabulary','character_recognition')
  and question_id like 'hsk%';

commit;

-- Verify expected published counts: 15 items for each of the four level/skill groups.
select level, skill, count(*) as published_questions
from public.hsk_questions
where is_published = true and level in (2,3)
  and skill in ('vocabulary','character_recognition')
group by level, skill
order by level, skill;
