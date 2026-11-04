# HSK 3.0 diagnostic – implementation notes

This feature is being developed on `feature/hsk-3-diagnostic`. It is an EduAssess learning diagnostic aligned to the HSK 3.0 syllabus, not an official HSK exam or certificate.

## Current foundation

- Listed in the student portal's **Open Tests** area and the teacher Assessment Centre as **HSK Chinese Diagnostic**.
- Landing page: `hsk-diagnostic.html`. It is deliberately marked as a preview until secure question delivery, scoring and saved progress are complete.

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

The function uses Gemini `gemini-3.1-flash-tts-preview`, asks for standard Mainland Mandarin (`zh-CN`), and stores WAV audio in the private bucket. The function intentionally does not create audio for arbitrary client-supplied text: it only reads the fixed script attached to an existing question-bank record.

## Audio verification before publication

- Generate audio from the final approved `audio_text`.
- Listen to every clip and verify pronunciation, exact wording, pauses, and intelligibility.
- Only publish the question after the audio has been checked.
- Do not use generated audio as evidence of an official HSK score.


## Student delivery and scoring (feature branch)

The student portal uses its existing custom student session. The HSK actions were added to the `student-assessment` Edge Function, so student access does not rely on a browser-side service-role key.

- `hsk-status`: returns each skill's HSK 1–3 best score, pass state and next unlocked level.
- `hsk-start`: verifies the previous level was passed, selects a reviewed question set and returns question text/options plus short-lived signed media URLs. Answer keys remain server-side.
- `hsk-submit`: scores answers on the server, stores a skill result and updates the student's best progress. A 60–74% first-round score triggers up to five additional confirmation questions. A final score of 75% or higher passes that skill level.
- The overall HSK level advances only when all six core skills (listening, picture recognition, vocabulary, character recognition, reading and grammar) have passed that level.
- HSK 1 writing is shown as not assessed in the student interface; writing is planned from HSK 2.

### HSK 1 question bank seed

Apply migrations in timestamp order:

1. `202611050001_hsk_diagnostic_foundation.sql`
2. `202611050002_hsk1_question_bank_seed.sql`

The seed contains original EduAssess questions (not official HSK exam questions): 15 each for vocabulary, character recognition, reading, grammar and listening. Listening rows are marked `pending` until audio is generated and manually reviewed. Picture-recognition content and its visual assets are not seeded yet, so that skill will report as not ready rather than presenting a broken test.

The diagnostic requires at least 15 eligible questions per skill/level: 10 initial questions plus up to 5 confirmation questions. Only published questions are delivered.

### Deployment and verification still required

These changes are on the feature branch only. Before students can use them, apply the migrations to the intended Supabase project, deploy the updated `student-assessment` function, deploy `hsk-audio`, add the `GEMINI_API_KEY` Edge Function secret, generate the listening clips, and manually listen to every clip. Then verify the HSK page with a real student test account. No production deployment or database migration has been run from this workspace.
