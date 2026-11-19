-- R01 A2 final teacher review
-- Applies the latest teacher notes to the 21 revised A2 questions.
-- Marks the reviewed set approved only after these final corrections.
begin;

update public.reading_question_bank set
 passage = $p$GREEN LEAF CAFÉ
Our lunch menu changes every Monday. This week, we are serving chicken rice, vegetable soup and fresh fruit. If you have a food allergy, please speak to a café employee before you order. Place your order at the counter and a member of our team will bring your meal to your table.$p$,
 prompt = 'What should a customer with a food allergy do before ordering?',
 rationale = 'The notice asks customers with food allergies to speak to a café employee before placing an order.',
 updated_at = now()
where question_code = 'A2-002';

update public.reading_question_bank set
 options = $j$[
 {"label":"A","text":"A customer who bought the shoes ten days ago, has the receipt, and can show that they have not been worn."},
 {"label":"B","text":"A customer who bought the shoes several months ago but has worn them only indoors."},
 {"label":"C","text":"A customer whose shoes are unused but who no longer has the original labels."},
 {"label":"D","text":"A customer returning unused shoes with their original labels and receipt, purchased ten days ago."}
]$j$::jsonb,
 correct_option = 'D',
 rationale = 'The shoes must be unused, have their original labels and be returned within 14 days. The receipt should also be brought to the shop.',
 updated_at = now()
where question_code = 'A2-008';

update public.reading_question_bank set
 options = $j$[
 {"label":"A","text":"Switch off the phone, leave the case on and hand the SIM card to the technician."},
 {"label":"B","text":"Keep the phone switched on, remove the case and take the SIM card out."},
 {"label":"C","text":"Remove the SIM card, leave the phone switched on and ask for a message when the repair is finished."},
 {"label":"D","text":"Turn the phone off, take off its protective cover and keep the SIM card with you."}
]$j$::jsonb,
 correct_option = 'D',
 rationale = 'Before handing in the phone, the customer must switch it off, remove its case and keep the SIM card.',
 updated_at = now()
where question_code = 'A2-016';

update public.reading_question_bank set
 options = $j$[
 {"label":"A","text":"Someone who has a bank card but has never used an automatic ticket machine."},
 {"label":"B","text":"Someone who has not bought a ticket yet and has neither cash nor a bank card to pay with."},
 {"label":"C","text":"Someone who has a bank card and needs an employee to explain how the machine works."},
 {"label":"D","text":"Someone who bought a ticket online but wants to ask a member of staff where to board."}
]$j$::jsonb,
 correct_option = 'B',
 rationale = 'The ticket office is closed, and the machines accept bank cards only. A passenger without cash or a bank card has no stated way to buy a ticket.',
 updated_at = now()
where question_code = 'A2-018';

update public.reading_question_bank set
 options = $j$[
 {"label":"A","text":"Dogs may run freely near the playground as long as their owners remain close."},
 {"label":"B","text":"Dogs must be kept on a lead everywhere in the park, including the open grass areas."},
 {"label":"C","text":"Dogs cannot enter the small garden beside the pond while it is closed to visitors."},
 {"label":"D","text":"Owners may let their dogs off the lead beside the pond if they clean up afterwards."}
]$j$::jsonb,
 correct_option = 'C',
 rationale = 'The small garden beside the pond is closed to visitors. The lead requirement applies specifically to the area near the playground.',
 updated_at = now()
where question_code = 'A2-019';

update public.reading_question_bank set
 options = $j$[
 {"label":"A","text":"Tell the teacher that they feel unwell before going to the health room."},
 {"label":"B","text":"Ask a friend to share some medicine before the lesson ends."},
 {"label":"C","text":"Go home without telling the teacher or anyone in the health room."},
 {"label":"D","text":"Wait until 3 p.m. because the nurse cannot see students earlier."}
]$j$::jsonb,
 correct_option = 'A',
 rationale = 'The notice tells students to inform their teacher before visiting the health room. It does not tell them to wait until 3 p.m.',
 updated_at = now()
where question_code = 'A2-020';

update public.reading_question_bank set
 options = $j$[
 {"label":"A","text":"A photograph taken by the student of a busy market, where every person in the picture has agreed to appear."},
 {"label":"B","text":"A photograph taken by the student''s parent, which the student has cropped and edited before entering."},
 {"label":"C","text":"A photograph taken by the student of a stranger who is clearly recognisable but was not asked for permission."},
 {"label":"D","text":"A picture downloaded from a travel website showing a familiar street in the student''s town."}
]$j$::jsonb,
 correct_option = 'A',
 rationale = 'The entry must be the student''s own photograph, and anyone who can be recognised must have agreed to be photographed.',
 updated_at = now()
where question_code = 'A2-021';

update public.reading_question_bank set
 options = $j$[
 {"label":"A","text":"A student who wants a furnished room and a private kitchen for personal use."},
 {"label":"B","text":"A person who smokes indoors and prefers not to share any household space."},
 {"label":"C","text":"A student who relies on a nearby bus stop because walking any distance is difficult."},
 {"label":"D","text":"An exchange student who does not own furniture, is comfortable sharing a kitchen and can manage the walk to transport."}
]$j$::jsonb,
 correct_option = 'D',
 rationale = 'The room is unfurnished and the kitchen is shared. The best match is someone comfortable with those conditions and not dependent on a nearby bus stop.',
 updated_at = now()
where question_code = 'A2-022';

update public.reading_question_bank set
 prompt = 'Which statement is correct about the museum on Monday morning?',
 options = $j$[
 {"label":"A","text":"Visitors cannot enter any part of the museum before 1 p.m."},
 {"label":"B","text":"Some museum galleries remain open while the space exhibition is closed."},
 {"label":"C","text":"The space exhibition is being taken away permanently."},
 {"label":"D","text":"The dinosaur exhibition is the only area open to visitors."}
]$j$::jsonb,
 correct_option = 'B',
 rationale = 'Only the space exhibition is temporarily closed. The notice says the rest of the museum remains open as usual.',
 updated_at = now()
where question_code = 'A2-025';

update public.reading_question_bank set
 options = $j$[
 {"label":"A","text":"A customer with a dictionary bought yesterday, still in good condition and accompanied by a receipt."},
 {"label":"B","text":"A customer with an unread novel bought five days ago, in good condition and with the receipt."},
 {"label":"C","text":"A customer with a damaged novel bought yesterday who can show the receipt."},
 {"label":"D","text":"A customer with an unread novel bought two weeks ago who has kept the receipt."}
]$j$::jsonb,
 correct_option = 'B',
 rationale = 'The novel is not a reference book, is unread and in good condition, and was bought within the seven-day period. The receipt is available.',
 updated_at = now()
where question_code = 'A2-026';

update public.reading_question_bank set
 prompt = 'Why did Leo message Nina?',
 options = $j$[
 {"label":"A","text":"To let her know that he had completed the presentation and did not need her to check it."},
 {"label":"B","text":"To explain that Nina had made an error when she prepared the presentation."},
 {"label":"C","text":"To tell her that he had corrected the earlier version by adding the picture that was missing."},
 {"label":"D","text":"To ask Nina to repair the presentation by adding a picture before their meeting."}
]$j$::jsonb,
 correct_option = 'C',
 rationale = 'Leo says that he noticed a missing picture and has now added it himself. He asks Nina to check the updated version.',
 updated_at = now()
where question_code = 'A2-027';

update public.reading_question_bank set
 prompt = 'You need to do your homework independently and use books from the library. Where is the most suitable place to work?',
 options = $j$[
 {"label":"A","text":"The main reading area, where quiet individual study is expected."},
 {"label":"B","text":"The glass study room, which is intended for group discussions."},
 {"label":"C","text":"The return trolley beside the entrance, where used books are collected."},
 {"label":"D","text":"The shelves, where students should leave books after they have finished reading."}
]$j$::jsonb,
 correct_option = 'A',
 rationale = 'The main reading area is kept quiet for individual work. The glass room is for group discussions, and the trolley is for returned books.',
 updated_at = now()
where question_code = 'A2-028';

update public.reading_question_bank set
 prompt = 'Which statement is true about the school football practice?',
 options = $j$[
 {"label":"A","text":"The practice has been cancelled because heavy rain is expected."},
 {"label":"B","text":"Students should bring an additional set of sports clothes for the wet weather."},
 {"label":"C","text":"The school can use a covered playing area when the main field cannot be used."},
 {"label":"D","text":"Students need to bring something to protect themselves from the rain during practice."}
]$j$::jsonb,
 correct_option = 'C',
 rationale = 'The practice moves from the main field to the covered court and continues at the normal time. This shows that another playing area is available.',
 updated_at = now()
where question_code = 'A2-029';

update public.reading_question_bank set
 options = $j$[
 {"label":"A","text":"After 1 p.m., once the painters have finished working inside the room."},
 {"label":"B","text":"Tomorrow morning, when the art room has reopened."},
 {"label":"C","text":"Only after the new paint has dried completely."},
 {"label":"D","text":"Before 12 o''clock, while the room is still open."}
]$j$::jsonb,
 correct_option = 'D',
 rationale = 'Students are asked to collect their materials before lunch, ahead of the room''s closure from 1 p.m.',
 updated_at = now()
where question_code = 'A2-031';

update public.reading_question_bank set
 prompt = 'Which statement is true about tasting the fruit?',
 options = $j$[
 {"label":"A","text":"Visitors who try a sample are expected to buy some fruit before leaving."},
 {"label":"B","text":"The fruit arranged on the display table may be picked up and tasted without asking."},
 {"label":"C","text":"Visitors should use one of the paper cups when they want to try a free sample."},
 {"label":"D","text":"All the fruit on the display table is offered free for visitors to take home."}
]$j$::jsonb,
 correct_option = 'C',
 rationale = 'Samples are free, but visitors are asked to take a paper cup and request a sample from the seller rather than take fruit from the display.',
 updated_at = now()
where question_code = 'A2-033';

update public.reading_question_bank set
 passage = $p$EMAIL FROM THE IT TEAM
We have changed the school Wi-Fi password because the previous one had been shared with a large number of people. Students can obtain the new password from their homeroom teacher. Please do not pass it on to visitors. Guests have their own temporary Wi-Fi login codes, which are separate from the student network. If you have trouble connecting, speak to the IT team rather than asking another student for their password.$p$,
 prompt = 'Why did the school change the Wi-Fi password?',
 options = $j$[
 {"label":"A","text":"The school discovered that an unauthorised person had broken into its computer system."},
 {"label":"B","text":"The previous password had become widely known among people who should not all have access to it."},
 {"label":"C","text":"The school introduced a separate temporary login system for visitors."},
 {"label":"D","text":"The school replaced its network equipment and needed a new password for the updated system."}
]$j$::jsonb,
 correct_option = 'B',
 rationale = 'The email says the previous password had been shared with a large number of people. The separate guest codes are an existing arrangement, not the reason for the change.',
 updated_at = now()
where question_code = 'A2-035';

update public.reading_question_bank set
 prompt = 'What should a new tenant arrange before moving into the room?',
 options = $j$[
 {"label":"A","text":"A mattress and a blanket or other bedding for sleeping."},
 {"label":"B","text":"A desk and a wardrobe for clothes and personal belongings."},
 {"label":"C","text":"A washing machine to use in the building''s shared laundry room."},
 {"label":"D","text":"A private laundry area because the building does not provide one."}
]$j$::jsonb,
 correct_option = 'A',
 rationale = 'The desk and wardrobe are already provided. The notice says there is no mattress or bedding, so the tenant must bring these.',
 updated_at = now()
where question_code = 'A2-036';

update public.reading_question_bank set
 options = $j$[
 {"label":"A","text":"A visitor takes a flower from the bed after making sure no one is standing nearby."},
 {"label":"B","text":"A visitor walks between the flowers to photograph an insect more closely."},
 {"label":"C","text":"A visitor moves a plant slightly so that it does not block the view of the path."},
 {"label":"D","text":"A visitor remains on the marked path and photographs the flowers without entering the planted area."}
]$j$::jsonb,
 correct_option = 'D',
 rationale = 'The instructions allow photographs from the marked path but prohibit entering the flower beds and moving the plants.',
 updated_at = now()
where question_code = 'A2-037';

update public.reading_question_bank set
 passage = $p$HIKING GROUP MESSAGE
The rain overnight has affected the upper path beside the waterfall. Although it is still open, several sections have become slippery, especially where the ground slopes towards the water. To avoid delaying the group or putting anyone at risk, we will follow the lower forest route instead. Please wear shoes with a good grip because parts of that route may also be damp.$p$,
 prompt = 'Why has the group decided to use the lower forest route?',
 options = $j$[
 {"label":"A","text":"The upper path has been closed to the public for the rest of the season."},
 {"label":"B","text":"The conditions on the upper path could make it unsafe for the group to use."},
 {"label":"C","text":"The lower route is the only way to reach the waterfall from the starting point."},
 {"label":"D","text":"The group wants to avoid the forest because the lower route is expected to be completely dry."}
]$j$::jsonb,
 correct_option = 'B',
 rationale = 'The upper path is still open, but rain has made several sloping sections slippery. The group chooses the lower route to reduce risk.',
 updated_at = now()
where question_code = 'A2-040';

update public.reading_question_bank set
 options = $j$[
 {"label":"A","text":"When the product has been kept cold after the package was opened."},
 {"label":"B","text":"When the product is going to be eaten within the next three days."},
 {"label":"C","text":"When the seal is not intact or is missing at the time the package is first opened."},
 {"label":"D","text":"When the package has been opened for the first time and the product is still fresh."}
]$j$::jsonb,
 correct_option = 'C',
 rationale = 'The warning says not to eat the product if its safety seal is missing or damaged when opened. It does not say that the product must be vacuum-sealed.',
 updated_at = now()
where question_code = 'A2-041';

update public.reading_question_bank set
 passage = $p$COMPUTER ROOM
Before you sign out, make sure that any work you want to keep has been saved. The headphones should be returned to the labelled storage box so that the next class can use them. Please leave the keyboard and mouse where they are on the desk, and do not adjust the monitor. Finally, push your chair back under the desk and check that you have taken your personal belongings with you.$p$,
 prompt = 'Which item should be returned to its designated storage place after the lesson?',
 options = $j$[
 {"label":"A","text":"The keyboard, which should be put away with the other shared equipment."},
 {"label":"B","text":"The mouse, which should be taken off the desk before the next class arrives."},
 {"label":"C","text":"The monitor, which should be moved so that the desk is clear."},
 {"label":"D","text":"The headphones, which should be placed in their labelled box for the next class."}
]$j$::jsonb,
 correct_option = 'D',
 rationale = 'The headphones must be returned to the labelled storage box. The keyboard, mouse and monitor should remain at the workstation.',
 updated_at = now()
where question_code = 'A2-043';

-- Confirm that all 21 questions exist before approving the set.
do $$
declare
  question_total integer;
begin
  select count(*) into question_total
  from public.reading_question_bank
  where question_code in (
    'A2-002','A2-008','A2-016','A2-018','A2-019','A2-020','A2-021',
    'A2-022','A2-025','A2-026','A2-027','A2-028','A2-029','A2-031',
    'A2-033','A2-035','A2-036','A2-037','A2-040','A2-041','A2-043'
  );
  if question_total <> 21 then
    raise exception 'Expected 21 R01 A2 questions, found %; no approval applied.', question_total;
  end if;
end $$;

-- Lock the reviewed 21-question set as approved.
update public.reading_question_bank
set status = 'approved',
    updated_at = now()
where question_code in (
  'A2-002','A2-008','A2-016','A2-018','A2-019','A2-020','A2-021',
  'A2-022','A2-025','A2-026','A2-027','A2-028','A2-029','A2-031',
  'A2-033','A2-035','A2-036','A2-037','A2-040','A2-041','A2-043'
);

commit;

select question_code, status, correct_option
from public.reading_question_bank
where question_code in (
  'A2-002','A2-008','A2-016','A2-018','A2-019','A2-020','A2-021',
  'A2-022','A2-025','A2-026','A2-027','A2-028','A2-029','A2-031',
  'A2-033','A2-035','A2-036','A2-037','A2-040','A2-041','A2-043'
)
order by question_code;
