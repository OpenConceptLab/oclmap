# Candidates v1 -> v2 migration

One-shot migration of `map_projects.candidates` from the legacy v1 shape
(flat `[{algorithm, row, results}, ...]`) to the v2 wire format
(`{mapper_schema_version: 2, concept_definitions, rows}`).

Runs once during a planned maintenance window in coordination with the
oclmap v2-only deploy. After this migration, the legacy
`normalizeLegacyAllCandidates` code path is deleted from oclmap.

See [`docs/plans/unified-mapper-model.md`](https://github.com/OpenConceptLab/ocl-online-docs/blob/main/mapper/unified-mapper-model.md)
for the architectural context.

## What the script does

1. Reads a NDJSON dump of `map_projects` (id, name, target_repo_url,
   owner_url, algorithms, candidates).
2. For each project, reconstructs the `projectContext` (same logic as
   `MapProject.jsx` `fetchAndSetProject` load path) and runs the live
   `normalizeLegacyAllCandidates` from
   `src/components/map-projects/normalizers.js`.
3. Serializes the result to the v2 wire format and writes
   `output/proj-<id>.v2.json`.
4. Emits `output/migrate.sql` containing
   `BEGIN; UPDATE * N; COMMIT;` — a single transaction that applies all
   v2 blobs to the prod DB.

Two migration-time fallbacks are applied to recover currently-dead data
(neither changes any normalizer behavior; both classes of project are
unreadable in the prod UI today):

- **Sole-algo fallback** (~18 projects). Pre-2026 saves omit the
  per-entry `algorithm` field AND the `results[0].search_meta.algorithm`
  field. For single-algorithm projects, attribute the entries to the
  project's only algorithm.
- **HEAD version fallback** (22 projects). ICD-11 projects targeting
  `/orgs/WHO/sources/ICD-11-WHO/` (no version in URL) saved before
  `ocl_issues#2522` removed the silent `'HEAD'` default. Use `'HEAD'` as
  the migrate-time version so the projectContext builds.

## Runbook

The migration is read-only against the source data (dump + normalize)
until the final `psql -f migrate.sql` step. Everything before that can
be inspected, diffed, and re-run safely.

### 1. Dry-run locally

Confirms current prod data shape against the live normalizer. Run any
time without coordination.

```bash
# From any workstation that can reach oclapi2 prod through ocl-psql:
mkdir -p scripts/migrate-candidates-to-v2/input

~/.ocl/bin/ocl-psql oclapi2 -t -A -c "
  SELECT jsonb_build_object(
    'id', id,
    'name', name,
    'target_repo_url', target_repo_url,
    'owner_url', COALESCE(
      '/orgs/' || (SELECT mnemonic FROM organizations WHERE id = organization_id) || '/',
      '/users/' || (SELECT username FROM user_profiles WHERE id = user_id) || '/'
    ),
    'algorithms', algorithms,
    'candidates', candidates
  )::text
  FROM map_projects
  WHERE candidates IS NOT NULL AND candidates::text NOT IN ('{}', '[]', 'null')
  ORDER BY id;
" > scripts/migrate-candidates-to-v2/input/projects.ndjson

node scripts/migrate-candidates-to-v2/migrate.mjs
```

Inspect `scripts/migrate-candidates-to-v2/output/summary.json` and
`skipped.json`. Spot-check 3-4 generated `proj-<id>.v2.json` blobs
against representative live projects:

- One bridge-heavy LOINC (e.g. proj 105, 130, 73 — Jussara / Top-200 / ARUP).
- One ICD-11 custom-algo (e.g. proj 88, 90, 124 — recovered via HEAD
  fallback).
- One sole-algo recovery (e.g. proj 19, 49 — recovered via sole-algo
  fallback).
- One that legitimately normalizes to empty (algorithm found nothing).

### 2. Maintenance-window migration

The migration window (~15-20 min) consists of:

```
T-0:00  Announce maintenance window (Slack/email to active users)
T-0:01  Block oclmap traffic at nginx (or 503 maintenance page)
T-0:02  Snapshot the table:
          pg_dump --table=map_projects --data-only > map_projects.backup.sql
T-0:03  Re-dump the live candidates (in case a save landed since the dry run):
          ~/.ocl/bin/ocl-psql oclapi2 -t -A -c "<see Step 1 query>" \
            > scripts/migrate-candidates-to-v2/input/projects.ndjson
T-0:04  Run migrate.mjs (regenerates v2 blobs + migrate.sql):
          node scripts/migrate-candidates-to-v2/migrate.mjs
T-0:05  Apply the migration (single BEGIN/COMMIT transaction):
          ~/.ocl/bin/ocl-psql oclapi2 --rw \
            -f scripts/migrate-candidates-to-v2/output/migrate.sql
T-0:06  Deploy the v2-only oclmap build to prod
T-0:15  Smoke test: open 4 representative projects (above) in the UI.
        Confirm candidates render correctly.
T-0:18  Unblock traffic
```

### 3. Rollback

If migrate.sql fails midway, the whole transaction rolls back
automatically — no partial state.

If smoke test fails on the v2-only oclmap:

```bash
# Restore the candidates column from the pre-migration snapshot:
~/.ocl/bin/ocl-psql oclapi2 --rw \
  -c "BEGIN; TRUNCATE map_projects; \i map_projects.backup.sql; COMMIT;"
# Redeploy the previous (v1-reading) oclmap build.
```

## Sizes

Verified against the 2026-05-27 prod snapshot:

- 68 projects with non-empty `candidates`
- v1 total: ~803 MB
- v2 total: ~1199 MB (+49% — structural expansion: bridge cascade targets
  become explicit `bridge_child` Candidate + ConceptDefinition entries)
- Migration runtime: ~10 sec (Node) + ~30-60 sec (psql apply over the
  tunnel)

## Files

- `migrate.mjs` — the migration script (Node 22+, ESM).
- `README.md` — this file.
- `.gitignore` — excludes `input/`, `output/`, and `*.tmp` from version
  control.

## After the migration

This whole folder can be deleted once the migration has run cleanly in
prod and the v2-only oclmap is stable. The script imports
`normalizers.js`'s `normalizeLegacyAllCandidates` function, which itself
is deleted in the v2-only oclmap PR.
