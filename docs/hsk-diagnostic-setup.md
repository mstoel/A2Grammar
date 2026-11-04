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
