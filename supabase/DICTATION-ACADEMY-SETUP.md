# EduAssess Dictation Academy setup

This is an additive feature in the existing EduAssess Supabase project and GitHub Pages site.

## 1. Database

In the existing Supabase project, open **SQL Editor → New query**, paste the complete contents of `supabase/dictation-academy-migration.sql`, and run it once.

This creates:
- `dictation_words` — the 250-word bank for each of 13 CEFR levels
- `dictation_attempts` — practice and final assessment attempts
- `dictation_responses` — each student's spelling responses

The tables have RLS enabled and no browser-facing policies. The Edge Function accesses them with the existing server-side service-role secret after validating the student's current `student_sessions` token.

## 2. Deploy the Edge Function

From the repository root, with the existing Supabase project linked:

```bash
supabase functions deploy dictation-academy
```

The function uses the existing Supabase project environment variables `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. Do not put the service-role key in GitHub or browser code.

The function is configured with `verify_jwt = false` because EduAssess students use the platform's own short-lived student session token; the function validates that token server-side.

## 3. Word bank

The dashboard is ready to display the 13 levels, mastery counts, assessment history, and difficult-word analysis. The word bank still needs to be populated with exactly 250 reviewed words and example sentences per level (3,250 total) before all levels are fully usable.

A level's final assessment draws 25 random words. A score of 24/25 (96%) or higher passes and unlocks the next level. Practice mode allows unlimited audio replays and contributes to personal mastery, but does not unlock the next level. Final assessment mode allows two replays per word.

## 4. Student access

After the GitHub Pages deployment finishes, students sign in through the existing EduAssess student portal and choose **Dictation Academy**. Their existing student session is reused; no new account or Supabase project is required.

## 5. Difficult words

A word appears in a level's difficult-word list when it has at least 10 responses from students in the same school and more than 50% of those responses are incorrect. Practice and final assessment responses both contribute to this school-level statistic.

## 6. Browser spelling support

The answer field disables spellcheck, autocorrect, autocomplete, and autocapitalisation where the browser supports those attributes. A website cannot override every operating-system keyboard or third-party spellchecking feature. The assessment page also detects when the browser tab loses focus and displays a reminder; it does not automatically fail the student.
