# PR3-C migration verification — findings (interim)

Date: 2026-06-02 · Verifier: automated dry-run + sandbox rehearsal against live prod data
Scope: oclmap candidates v1→v2 migration (`migrate.mjs` / PR #34) + v2-only app (PR #35),
ahead of the production migration + deploy. QA + staging already migrated.

## Bottom line

**Migration MECHANICS and transformation FIDELITY are verified and safe.** Of the 69
non-empty prod projects, **52 (75%) migrate with zero data loss** and **100% of the
133,042 "survivable" candidate results transform faithfully** (perfect code coverage,
row coverage, and v2 referential integrity — 0 hard failures). The apply is a single
atomic transaction that takes ~25s and turns **100% of projects into
`mapper_schema_version: 2`**; rollback restores **byte-identical** data.

**One material finding:** the migration **permanently discards ~2,678 raw candidate
results (~2%) across 17 projects** (5 of them fully zeroed). **Crucially this is NOT a
new user-facing regression** — those candidates are *already invisible in current
production* (PR2b runs `UNIFIED_MODEL_ENABLED=true` and normalizes-on-load via the
identical function). The migration's only new effect is that it **overwrites the raw v1
data**, so a future bug-fix could no longer recover those results from the live row —
only from the backup.

**Recommendation: GO**, conditioned on (a) **retaining the pre-migration `pg_dump`
permanently** (archive, not just for the rollback window), and ideally (b) landing a
small `normalizers.js` fix first that recovers most of the loss. Plus the runbook
corrections below. Final 98% gate still needs the staging deployed-app UI smoke tests
(Track C — blocked on SSO creds).

## What was tested

| Track | What | Result |
|---|---|---|
| A | Fresh read-only dump of all 69 non-empty prod projects (860 MB) | ✅ |
| A | `migrate.mjs` dry-run | ✅ **69 ok / 0 skipped / 0 errors** |
| A | Sandbox Postgres: apply exact `migrate.sql` | ✅ 69 UPDATEs, 1 txn, **100% → v2**, 0 nulled |
| B | `validate.mjs` independent v1↔v2 equivalence | ✅ **0 hard failures**; loss fully characterized |
| D | Rollback rehearsal (TRUNCATE + restore backup) | ✅ **byte-identical** (69/69 md5 match) |
| D | Idempotency of `migrate.sql` re-apply | ✅ 69→69 v2 |
| D | Double-run guard (re-run `migrate.mjs` on v2 data) | ✅ crashes loudly & safely (no corruption) |
| E | `matches`/`analysis` cross-field integrity | ✅ matches reference concept by URL+rowIndex — survive intact |
| F | QA parity | ✅ no un-migrated leftovers (QA has no real data) |
| C | Staging deployed-app UI smoke tests | ⏳ blocked on staging SSO creds |

## The data-loss finding (detail)

**Root cause** — `oclmap/src/components/map-projects/normalizers.js`, in
`normalizeLegacyAllCandidates` (commit `315e9b0`):

```js
const algoById = new Map((algorithms || []).map(a => [a.id, a]))
Object.entries(allCandidates).forEach(([algoId, rowEntries]) => {
  const algoDef = algoById.get(algoId)
  if(!algoDef) return    // ← silently drops EVERY result whose tag isn't a CURRENT algo id
```

Candidate entries are grouped by their stored algorithm tag (`entry.algorithm` →
`results[0].search_meta.algorithm` → sole-algo fallback), then matched against the
project's **current** `algorithms[]` by `id`. Two ways an entry's tag fails to match:

- **Reconfigured project** — algorithms changed after results were saved.
  e.g. id=132/135 ran `ocl-ciel-bridge`+`ocl-semantic`, now configured `ocl-scispacy-loinc`.
- **Mistagged results** — e.g. id=52 "CES drugs": results tagged `ocl-search`, algo
  configured as `ocl-semantic`. (The sole-algo fallback is skipped because a tag *is*
  present, just the wrong one.)

A second, smaller class is **no-identity drop** (1,703 results): `custom` algos with no
`canonical_url` get no `concept_identity` (the ICD-11 custom-API demo projects).

**Blast radius** (from `validate.mjs` / `validation-report.json`):

- Total v1 results: 135,720 → survivable 133,042 · orphan-tag drop 975 · no-identity drop 1,703.
- 52/69 projects clean. 17 projects lose ≥1 result.
- **5 worst-case "FULL-ZERO + USED"** (had results + user matches/analysis, → 0 candidates):
  | id | name | results→v2 | matches | analysis | tags vs config |
  |---|---|---|---|---|---|
  | 52 | CES drugs | 132→0 | 126 | 0 | `ocl-search` vs `ocl-semantic` |
  | 132 | HL7 Brazil Jusssara | 270→0 | 4 | 9 | bridge+semantic vs `ocl-scispacy-loinc` |
  | 67 | ICD 11 Demo Showcase #001 | 53→0 | 18 | 15 | ICD-API names vs `custom` |
  | 57 | ICD 11 Test | 9→0 | 6 | 1 | ICD-API names vs `custom` |
  | 55 | conceptDictionary…copy | 28→0 | 1 | 0 | ICD-API name vs `custom` |
- 12 partial-loss projects keep most data (e.g. id=90 dropped 663 of 8,518; id=135 270→10).

**Why it is NOT a new regression:** current prod (PR2b) renders the candidate grid from
the normalized `rowMatchState` (`buildQualityRowViews(rowMatchStateRef.current[idx], …)`,
MapProject.jsx@bbdc360:3705), which is built by the *same* `normalizeLegacyAllCandidates`
with the *same* drop. So these candidates already don't render today. The migration
persists that state and discards the raw v1 source.

**`matches` are safe:** each match is self-contained (`{url, mapType, repoURL, decision,
rowIndex, state}`) and references concepts by URL — never by candidate-array index. So
users' actual mapping decisions and CSV export survive intact for all projects, including
the zeroed ones.

## Recommendations

1. **GO** for the prod migration on data-integrity grounds.
2. **Retain the pre-migration `pg_dump` permanently** (archive it). It is the only
   recoverable copy of the 2,678 dropped raw results after migration.
3. **(Recommended) Land a small normalizer fix first** to recover most of the loss:
   when `algoById.get(algoId)` misses, fall back to `conceptIdentityByType[algoId]`
   (the tags `ocl-search`/`ocl-ciel-bridge`/`ocl-semantic` are all valid identity types).
   This recovers id=52, 132, 135, 61, 95, 114. It will NOT recover the `custom` ICD-API
   projects (no `canonical_url` → no identity); those are demo/test data. Re-run the
   dry-run + `validate.mjs` after the fix. Route to Sunny (snyaggarwal), PR3-C owner.

## Runbook corrections (found during rehearsal)

- **Run the migration from commit `315e9b0`**, not `main`. `migrate.mjs` imports
  `normalizeLegacyAllCandidates`, which PR #35 (`9f8f4b3`) deletes — running from `main`
  crashes on import. (Use a detached worktree at `315e9b0`.)
- **Target count is now 69** non-empty projects (was 68 at the 2026-05-27 dry-run).
  Always re-dump immediately before the window (the runbook's T-0:03 step) — the set drifts.
- **Never re-dump+migrate after applying** — `migrate.mjs` on v2 data throws
  `TypeError: (candidates || []) is not iterable`. (`migrate.sql` re-apply is safe/idempotent.)
- nginx-block step is necessary: a save landing between dump and apply is overwritten; the
  T-0:03 re-dump mitigates.

## Artifacts (this folder; input/ and output/ are gitignored)

- `validate.mjs` — new independent equivalence validator (read-only over dry-run outputs).
- `output/summary.json`, `output/skipped.json` (empty), `output/validation-report.json`,
  `output/migrate.sql`, `output/proj-*.v2.json`.
- Sandbox: throwaway Postgres at `127.0.0.1:55432` (data in `/tmp/oclmap-sandbox-pg`),
  `/tmp/map_projects.backup.sql`, `/tmp/pre_migration_md5.txt`. Remove when done.

## Canonical resolution (follow-up — fixes most of the loss + a deeper issue)

The "no-canonical → drop" path turned out to be one face of a broader problem: the
migration always keys concepts on the **generated** `https://ns.openconceptlab.org/...`
URL, while the live app keys them on each source's **formal** `canonical_url`
(it fetches `target_repo` at runtime; reads `custom`/`bridge` canonicals from the
algo config). Consequences on real data: (a) custom ICD-11 algos drop entirely
(no identity), (b) **10 LOINC/ICD-11 projects split a concept's identity** between
formal + generated, (c) migrated keys mismatch the live app on re-run.

**Decision (@paynejd):** ICD-11 (all variants) → `http://id.who.int/icd/release/11/mms`;
PIH → generated; everything else → the source's registered canonical. Resolve at
dump time (static snapshot), not a runtime read.

**Prototyped + measured** (dry-run + validator on the real 69):

| | before (generated) | after (formal resolution) |
|---|---|---|
| no-identity drops | 1,703 | **0** |
| split-identity projects | 10 | **0** |
| concept keys | mostly generated | **all formal** (only 24 PIH generated) |
| hard failures | 0 | 0 |
| orphan-tag drops (separate bug) | 975 | 975 (unchanged) |

**Two production pieces (both validated):**
1. `fix-algorithm-canonicals.sql` — one-time `--rw` UPDATE of `map_projects.algorithms`
   setting formal canonical on custom + bridge algos. Fixes the **live app** too
   (it reads these from config). Run before the migration, after backup.
2. `dump-projects.sql` — migration dump with resolved `target_repo.canonical_url`
   (the app fetches target live; the migration can't, so it resolves at dump time).
   `migrate.mjs` is unchanged.

Hand both to Sunny. **Still open: the 975 orphan-tag drops** (results tagged with an
algorithm not in the project's current `algorithms[]` — reconfigured/mistagged
projects: id 52, 132, 135, 61, 67, 55, 57, 95, 114). That's a separate normalizer
fallback (`conceptIdentityByType[tag]` / result-derived identity), not a canonical
issue — ~99% recoverable per earlier analysis if we choose to fix it.

## Outstanding for ≥98% (Track C)

Seed staging with ~8 diverse real prod projects (incl. a bridge, a scispacy, an
ICD-11/HEAD, a sole-algo, the largest, and one of the zeroed projects), then SSO browser
smoke tests on the deployed v2 app: load without legacy alert, render candidates/scores,
bridge cascade targets, Concept Details panel, AI Recommend, CSV export, re-save→reload,
and a fresh new-project save. **Needs staging Keycloak creds.**
