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

> **IMPORTANT — read before running (verified 2026-06-02, see
> `verification-report.md`):**
> 1. **`migrate.mjs` is self-contained.** It imports the normalizer from
>    `./vendored/` (pinned to the validated `315e9b0` version), so
>    `node migrate.mjs` runs from any checkout — including `main`, where the
>    v2-only PR (`9f8f4b3`) deleted `normalizeLegacyAllCandidates` from `src/`.
>    No special checkout or worktree needed.
> 2. **Dump with `dump-projects.sql`** (not the bare query below) so concept_keys
>    use the formal source canonical (matching the live app) instead of a
>    generated `ns.openconceptlab.org` URL. Also apply `fix-algorithm-canonicals.sql`
>    (`--rw`) so the live app stays consistent on re-run. See `ocl_issues#2555`.
> 3. **Validate** every run with `node validate.mjs` (0 hard failures expected;
>    review the orphan-tag drop list — currently ~9 reconfigured/mistagged
>    projects, separate from this fix).
> 4. **Retain the backup permanently** (not just for the rollback window). It is
>    the only recoverable copy of the orphan-tag-dropped raw results.
> 5. **Never re-dump + re-run `migrate.mjs` after applying** — it throws
>    `TypeError: (candidates || []) is not iterable` on v2 data. (`migrate.sql`
>    re-apply is safe/idempotent.)

### 1. Dry-run locally

Confirms current prod data shape against the live normalizer. Run any
time without coordination.

```bash
cd scripts/migrate-candidates-to-v2
mkdir -p input

# 1. Dump with resolved formal canonicals (read-only):
~/.ocl/bin/ocl-psql oclapi2 -t -A -f dump-projects.sql > input/projects.ndjson

# 2. Normalize to v2 (self-contained; runs from any checkout):
node migrate.mjs

# 3. Independently validate the transformation:
node validate.mjs
```

Inspect `output/summary.json`, `skipped.json`, and `output/validation-report.json`
(expect 0 hard failures). Spot-check 3-4 generated `proj-<id>.v2.json` blobs
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
T-0:02  Snapshot the table (RETAIN PERMANENTLY, not just for rollback):
          pg_dump --table=map_projects --data-only > map_projects.backup.sql
T-0:03  Fix the live algorithms config (formal canonicals; app re-run consistency):
          ~/.ocl/bin/ocl-psql oclapi2 --rw -f fix-algorithm-canonicals.sql
T-0:04  Re-dump the live candidates (in case a save landed since the dry run):
          ~/.ocl/bin/ocl-psql oclapi2 -t -A -f dump-projects.sql \
            > input/projects.ndjson
T-0:05  Normalize to v2 + validate:
          node migrate.mjs
          node validate.mjs        # confirm 0 hard failures
T-0:07  Apply the migration (single BEGIN/COMMIT transaction):
          ~/.ocl/bin/ocl-psql oclapi2 --rw -f output/migrate.sql
T-0:08  Deploy the v2-only oclmap build to prod
T-0:16  Smoke test: open 4 representative projects (above) in the UI.
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

Verified against the 2026-06-02 prod snapshot:

- **69** projects with non-empty `candidates` (was 68 on 2026-05-27 — the set
  drifts, so always re-dump immediately before the window)
- v1 total: ~860 MB · v2 total: ~1.2 GB (+~40% structural expansion)
- Migration runtime: ~10 sec (Node normalize) + ~30-60 sec (psql apply)

## Files

- `migrate.mjs` — the migration script (Node 22+, ESM). Self-contained; runs from any checkout.
- `vendored/normalizers.js`, `vendored/conceptKey.js` — vendored normalizer (pinned
  to the validated `315e9b0` version), so `migrate.mjs` doesn't depend on `src/`
  (where the v2-only PR deleted `normalizeLegacyAllCandidates`). Dir is `vendored/`
  rather than `lib/` because the root `.gitignore` ignores `lib/`.
- `dump-projects.sql` — the dump query with resolved formal canonicals.
- `fix-algorithm-canonicals.sql` — one-time `--rw` fix of `algorithms` config so
  the live app keys concepts on the same formal canonicals as the migrated data.
- `validate.mjs` — independent v1↔v2 equivalence + referential-integrity validator.
- `verification-report.md` — the pre-prod verification record (`ocl_issues#2555`).
- `README.md` — this file.
- `.gitignore` — excludes `input/`, `output/`, and `*.tmp` from version control.

## After the migration

This whole folder (including `vendored/`) can be deleted once the migration
has run cleanly in prod and the v2-only oclmap is stable. The vendored
`vendored/normalizers.js` is a frozen copy of the `315e9b0` normalizer
(`normalizeLegacyAllCandidates`), which no longer exists in `src/`.
