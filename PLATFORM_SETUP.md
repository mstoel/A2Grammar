# A2 Grammar Diagnostic — secure platform foundation

## Decisions
- Any teacher can register using Supabase Auth and create a school; the database function `create_school_and_owner` creates the school and owner membership atomically.
- Students select school and class, then enter their student ID and individual access code.
- Keep the existing adaptive test and rule-based scoring in `index.html` unchanged.
- Teacher analysis is the only AI-assisted feature planned; AI keys must stay server-side.

## First database stage
1. Create a Supabase project.
2. Open SQL Editor → New query.
3. Paste and run `supabase/schema.sql`.
4. Enable email/password authentication for teacher accounts.
5. Add the GitHub Pages origin to allowed redirect URLs.

## Security status
The schema enables row-level security on all tables and creates no anonymous policies for student records. It includes schools, memberships, classes, teacher-class assignments, students, assessments, class assignments and attempts. Student access codes are represented by a hash field only.

**This is the database foundation, not yet a live secure portal.** Do not enter real student data until server-side student code verification, short-lived student sessions, assignment checks, and result submission validation have been implemented and tested.

## Required next steps
1. Build teacher sign-up/sign-in and school/class management UI against this schema.
2. Add an Edge Function that verifies individual student codes and returns only the student's assigned tests and own result history.
3. Add an Edge Function for result submission that verifies the student's session and class assignment. Never trust a client-supplied student ID or score.
4. Test cross-school and cross-student access denial before launch.
5. Add AI teacher analysis through a server-side function only.

Do not put Supabase service-role keys, AI keys, or student data in this public GitHub repository. The existing local JSON dashboard remains a prototype, not a secure multi-school portal.