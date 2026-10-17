# Student delivery setup (first release)

This is the first server-side student delivery slice. It supports **published multiple-choice assessments** created in Assessment Builder. Adaptive A2 diagnostics and essay rubrics can appear in the student list, but their student delivery is intentionally blocked until their own engines are implemented.

## 1. Apply the database migrations

In Supabase Dashboard → SQL Editor, run these repository files in order:

1. `supabase/student-delivery-migration.sql` — private server-managed student sessions and indexes.
2. `supabase/anonymous-results-migration.sql` — anonymous results table, with no student identifier.
3. Confirm the earlier assessment-builder migration has already been applied so `assessments.assessment_data` and `result_storage_mode` exist.

Both new tables have RLS enabled and intentionally have no browser-facing policies. The Edge Function uses the Supabase service-role key on the server only.

## 2. Deploy the Edge Function

Install the Supabase CLI and sign in, then from the repository root:

```sh
supabase link --project-ref YOUR_PROJECT_REF
supabase functions deploy student-assessment --no-verify-jwt
```

The function uses opaque random student session tokens rather than Supabase Auth JWTs, so this function's gateway JWT verification is disabled in `supabase/config.toml`. The function validates every token against a hashed token record in `student_sessions`. Keep the function code's own session validation in place; do not replace it with client-side trust.

Supabase provides `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to deployed Edge Functions. **Never copy the service-role key into any HTML page, publishable config, GitHub Pages setting, or student device.**

## 3. Configure the student portal

Publish the repository's GitHub Pages site after review. Open `student-portal.html` on the student device and enter the Supabase Project URL and **publishable** key, the school slug, the student ID, and the one-time access code created in Teacher Dashboard. The URL and publishable key may be saved in that browser; the student session token is held in session storage and expires after eight hours.

## 4. How this first release behaves

- Only active, published assessments assigned to the student's active class and currently inside their open/close window are listed.
- Multiple-choice questions are delivered without correct-answer flags or explanations. The server calculates the score.
- `identified` results are written to `attempts` and linked to the student.
- `anonymous` results are written to `anonymous_assessment_results`, which contains no student/session identifier.
- `none` calculates and returns a score but does not save an outcome.
- Logout revokes the server-side session.
- Essay rubric and adaptive diagnostic delivery currently returns an explicit unsupported message rather than pretending those engines work.

## 5. Important limitations before a real exam

This is an initial integration, not a fully proctored exam system. The first version does not yet enforce the configured per-test timer, attempt limits, draft autosave, or a teacher-controlled results release date. It does not prevent students from using another device. Do not use it for high-stakes or controlled exams until those protections and the student flow have been tested with test accounts.

After deploying, test with a disposable school, class, student, and low-stakes published multiple-choice assessment. Verify login, assigned test visibility, server-side scoring, each result-storage mode, logout/revocation, and access denial for an unassigned test before inviting students.
