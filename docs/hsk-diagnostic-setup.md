# HSK 3.0 diagnostic – implementation notes

This feature is being developed on `feature/hsk-3-diagnostic`. It is an EduAssess learning diagnostic aligned to the HSK 3.0 syllabus, not an official HSK exam or certificate.

## Current foundation

- Listed in the student portal's **Open Tests** area and the teacher Assessment Centre as **HSK Chinese Diagnostic**.
- Student page: `hsk-diagnostic.html`. The student flow, secure question delivery, server-side scoring and saved per-skill progress are implemented on this branch; the feature is not live until the migrations and Edge Function are deployed.

- Private question bank with level, skill, item type, answer key, source reference, image/audio metadata.
- Separate attempt, per-skill result, and persistent per-skill progress tables.
- Private `hsk-media` Supabase Storage bucket.
- `hsk-audio` Edge Function for teacher-triggered, one-time Mandarin TTS generation.
- Gemini-generated audio is stored as WAV and reused; student devices do not synthesize speech.

## Supabase setup for audio

1. Apply the migration in `supabase/migrations/202611050001_hsk_diagnostic_foundation.sql`.
2. Add the secret `GEMINI_API_KEY` to Supabase Edge Function secrets. Keep it server-side; never put it in HTML or browser JavaScript.
3. Deploy `supabase/functions/hsk-audio/index.ts` as the `hsk-audio` Edge Function.
4. Call it from an authenticated teacher session with JSON `{ "schoolId": "...", "questionId": "hsk1-..." }` and the normal Supabase access token in the Authorization header.
5. The teacher must have a membership role of owner, admin, or teacher in the supplied school.

The function uses Gemini `gemini-3.1-flash-tts-preview`, asks for standard Mainland Mandarin (`zh-CN`), and stores WAV audio in the private bucket. The function intentionally does not create audio for arbitrary client-supplied text: it only reads the fixed script attached to an existing question-bank record. The `GEMINI_API_KEY` is required only for `generate`; teachers can list and approve existing clips without it. The teacher review page displays the exact Chinese script beside each recording.

## Audio verification before publication

- Generate audio from the final approved `audio_text`.
- Listen to every clip and verify pronunciation, exact wording, pauses, and intelligibility.
- Only publish the question after the audio has been checked.
- Do not use generated audio as evidence of an official HSK score.


## Student delivery and scoring (feature branch)

The student portal uses its existing custom student session. The HSK actions were added to the `student-assessment` Edge Function, so student access does not rely on a browser-side service-role key.

- `hsk-status`: returns each skill's HSK 1–3 best score, pass state and next unlocked level.
- `hsk-start`: verifies the previous level was passed, selects a reviewed question set and returns question text/options plus short-lived signed media URLs. Answer keys remain server-side, and only the approved student-facing illustration metadata is returned. Listening transcripts are hidden from students.
- `hsk-submit`: scores answers on the server, stores a skill result and updates the student's best progress. A 60–74% first-round score triggers up to five additional confirmation questions. A final score of 75% or higher passes that skill level.
- The overall HSK 1 level advances only when all six core skills (listening, picture recognition, vocabulary, character recognition, reading and grammar) have passed. From HSK 2 onward, writing is also required for the overall level, while each individual skill still progresses independently.
- HSK 1 writing is shown as not assessed in the student interface; writing is planned from HSK 2.

### HSK 1 question bank seed

Apply migrations in timestamp order:

1. `202611050001_hsk_diagnostic_foundation.sql`
2. `202611050002_hsk1_question_bank_seed.sql`
3. `202611050003_hsk1_picture_question_bank.sql`
4. `202611050004_hsk_audio_review.sql`

The seeds contain 90 original EduAssess HSK 1 questions (not official HSK exam questions): 15 each for vocabulary, character recognition, reading, grammar, listening and picture recognition. Picture-recognition items use embedded vector illustrations. Listening rows are marked `pending` until audio is generated; the teacher must listen to each clip and approve it before it can be served to students. The teacher review page is `hsk-audio-manager.html`, linked from the HSK entry in the Assessment Centre.

The diagnostic requires at least 15 eligible questions per skill/level: 10 initial questions plus up to 5 confirmation questions. Only published questions are delivered.

### Deployment and verification still required

These changes are on the feature branch only. Before students can use them, apply the migrations to the intended Supabase project, deploy the updated `student-assessment` function, deploy `hsk-audio`, add the `GEMINI_API_KEY` Edge Function secret, open `hsk-audio-manager.html` from the Assessment Centre, generate the listening clips, and manually listen to and approve every clip. Then verify the HSK page with a real student test account. No production deployment or database migration has been run from this workspace.


### Pre-sharing quality checklist

Before sharing the student link for real diagnostic use:

- Apply all four migrations in order to a test Supabase project and confirm each completes without SQL errors.
- Deploy both Edge Functions and confirm the browser calls use the existing student session; do not expose the service-role key.
- Set `GEMINI_API_KEY`, generate the 15 HSK 1 listening clips, then listen to each one against the displayed Chinese script and approve only clear, accurate clips.
- Confirm that a student sees the audio player but never sees the listening transcript.
- Test each HSK 1 skill with a test student: 0–50%, 60–74% with the extra five questions, and a passing result. Confirm the result persists after sign-out/sign-in.
- Confirm HSK 2 remains locked until that same skill passes HSK 1, and that passing one skill does not unlock another skill.
- Confirm the overall HSK 1 level is not awarded until all six core skills have passed.
- Review all Chinese prompts, options, answer keys and audio with a fluent Mandarin speaker before using the results for placement decisions.

The current HSK 1 bank has 15 items per skill. This is enough for the initial 10-question round plus five confirmation questions, but it is a small diagnostic sample and does not replace a full official HSK assessment. HSK 2/3 banks and the HSK 2+ writing engine are not yet ready. Do not present the current branch as a complete HSK 1–3 assessment.
