-- Dictation Academy B1+ final 20 words (250 total with starter and first additional batch).
insert into public.dictation_words (level_code, word, sentence, thai_translation, is_active)
values
  ('B1+','exclusion','The club has a clear policy against the exclusion of new members.','การกีดกัน',true),
  ('B1+','exclusively','The room is used exclusively for science lessons.','โดยเฉพาะ',true),
  ('B1+','execute','The team will execute the plan in three stages.','ดำเนินการ',true),
  ('B1+','execution','The execution of the project took six months.','การดำเนินการ',true),
  ('B1+','exhibition','The students prepared an exhibition of their artwork.','นิทรรศการ',true),
  ('B1+','expand','The school plans to expand its library next year.','ขยาย',true),
  ('B1+','expansion','The expansion of the railway improved local transport.','การขยายตัว',true),
  ('B1+','expertise','Her expertise in languages is valuable to the school.','ความเชี่ยวชาญ',true),
  ('B1+','explanation','His explanation helped the class understand the result.','คำอธิบาย',true),
  ('B1+','exploit','Some companies exploit workers by paying very low wages.','เอาเปรียบ',true),
  ('B1+','exploration','The lesson includes an exploration of different viewpoints.','การสำรวจ',true),
  ('B1+','exposure','Regular exposure to English can improve listening skills.','การสัมผัส',true),
  ('B1+','external','The school invited an external examiner to review the course.','ภายนอก',true),
  ('B1+','facilitate','Clear instructions facilitate effective group work.','อำนวยความสะดวก',true),
  ('B1+','facility','The sports facility is open to students after school.','สิ่งอำนวยความสะดวก',true),
  ('B1+','factor','Cost is an important factor in the decision.','ปัจจัย',true),
  ('B1+','format','Please save the document in the correct format.','รูปแบบ',true),
  ('B1+','formation','The formation of the new team was announced yesterday.','การก่อตั้ง',true),
  ('B1+','formula','The students used a formula to calculate the area.','สูตร',true),
  ('B1+','foundation','The course provides a strong foundation for further study.','พื้นฐาน',true)
on conflict (level_code, word) do update set
 sentence = case when public.dictation_words.sentence = '' then excluded.sentence else public.dictation_words.sentence end,
 thai_translation = case when public.dictation_words.thai_translation = '' then excluded.thai_translation else public.dictation_words.thai_translation end;
