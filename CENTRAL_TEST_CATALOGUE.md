# Central Test Catalogue — rollout and registration rules

## Purpose
`public.test_catalog` is the central registry of Assessly tests. It stores metadata and pointers to the authoritative source; it does not duplicate question banks, rubrics, student attempts, or results.

## Apply the migration
1. Open the Supabase project for SchoolAssessmentPlatform.
2. Open SQL Editor and create a new query.
3. Review and run `supabase/migrations/20261020_central_test_catalog.sql`.
4. Verify with:
   ```sql
   select source_kind, assessment_type, count(*)
   from public.test_catalog group by 1,2 order by 1,2;

   select slug, title, subject, cefr_level, source_kind, source_path, source_table, publication_status
   from public.test_catalog order by title;
   ```
5. Keep all entries private until the source has been tested and the owner explicitly publishes it.

## Source-of-truth rules
- GitHub-hosted diagnostics: question bank and assessment logic remain in their version-controlled HTML/JS source. Register the relative source path and engine key.
- Assessment Builder tests: the existing row in `public.assessments` remains authoritative for question/configuration data. The catalogue stores its row ID and metadata.
- Writing tasks: `public.writing_assignments` remains authoritative for prompt/rubric settings and class-specific assignment rows. The catalogue groups identical task content so repeated class assignments do not create duplicate catalogue items.
- Results and attempts: remain in their existing tables. Never migrate or delete them as part of catalogue registration.

## Required workflow for every new test built with ChatGPT
Before considering a new test complete:
1. Add or update the test implementation in GitHub.
2. Add a catalogue registration for it in the same change: stable slug, title, subject, CEFR level if applicable, assessment type, engine key, source kind/path, source key, version, and initial private status.
3. If the test stores its definition in Supabase, register the existing assessment row instead of copying the full definition into the catalogue.
4. Test the start, submit, result persistence, teacher view, and student view for that engine.
5. Publish only after explicit approval. Registration is not publication and must never assign the test to students automatically.

## Important limitations of this first migration
- This migration creates a discoverable registry table and registers the known GitHub diagnostics plus current builder/writing rows.
- It does not yet replace the current teacher/student pages or make all engines runnable through one universal runner. That integration is a separate implementation step after the catalogue exists and has been verified.
- The initial metadata for older records is inferred only from fields already present. Uncertain CEFR levels stay null. Review records after migration before publishing.
- The catalogue has read access only for shared active tests through browser roles. Writes are intentionally restricted to a trusted admin/server workflow; do not add broad anonymous write policies.
