/* eslint-env node */
/* eslint-disable no-process-env */

/**
 * One-shot v1 -> v2 candidates migration for OCL Mapper projects.
 *
 * Reads a NDJSON dump of the `map_projects` table (one project per line,
 * dumped from prod via psql — see README.md), runs the live oclmap
 * normalizer over each row's v1 `candidates` blob, serializes the result
 * to the v2 wire format, and writes one v2 JSON blob per project plus a
 * single migrate.sql containing BEGIN; UPDATE * N; COMMIT;.
 *
 * Defaults — overridable via env vars:
 *   INPUT  ./input/projects.ndjson
 *   OUTDIR ./output
 *
 * Outputs:
 *   output/proj-<id>.v2.json   — v2 wire format (one per project)
 *   output/summary.json        — per-project status + counts
 *   output/skipped.json        — projects we couldn't normalize
 *   output/migrate.sql         — BEGIN; UPDATE * N; COMMIT; ready to apply
 *
 * See ./README.md for the full migration runbook.
 */

import { createReadStream } from 'node:fs'
import { writeFile, mkdir, open } from 'node:fs/promises'
import { createInterface } from 'node:readline'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'

// Self-contained: the normalizer is vendored into ./vendored/ (pinned to the
// 315e9b0 version this migration was written + validated against) so the
// script runs from any checkout, including main where the v2-only PR
// (9f8f4b3) deleted normalizeLegacyAllCandidates from src/. The whole folder
// is deleted after the one-shot prod migration. (Not ./lib/ — root .gitignore
// ignores lib/.)
import {
  normalizeLegacyAllCandidates
} from './vendored/normalizers.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const INPUT = resolve(process.env.INPUT || join(__dirname, 'input/projects.ndjson'))
const OUTDIR = resolve(process.env.OUTDIR || join(__dirname, 'output'))

// Replicated from oclmap/src/components/map-projects/algorithms.jsx
// (kept inline so this script has no JSX dependency).
const CONCEPT_IDENTITY_BY_TYPE = {
  'ocl-semantic': {
    reference_source: 'target_repo', code_field: 'id', ocl_url_field: 'url'
  },
  'ocl-search': {
    reference_source: 'target_repo', code_field: 'id', ocl_url_field: 'url'
  },
  'ocl-bridge': {
    reference_source: 'bridge_repo', code_field: 'id', ocl_url_field: 'url',
    cascade_target: {
      reference_source: 'target_repo',
      code_field: 'cascade_target_concept_code',
      ocl_url_field: 'cascade_target_concept_url'
    }
  },
  'ocl-ciel-bridge': {
    reference_source: 'bridge_repo', code_field: 'id', ocl_url_field: 'url',
    cascade_target: {
      reference_source: 'target_repo',
      code_field: 'cascade_target_concept_code',
      ocl_url_field: 'cascade_target_concept_url'
    }
  },
  'ocl-scispacy': {
    reference_source: 'fixed',
    canonical_url: 'http://loinc.org',
    code_field: 'id'
  }
}

const ensureConceptIdentity = (algo) => {
  if(!algo) return null
  if(algo.concept_identity) return algo
  if(CONCEPT_IDENTITY_BY_TYPE[algo.type])
    return { ...algo, concept_identity: CONCEPT_IDENTITY_BY_TYPE[algo.type] }
  if(algo.type === 'custom' && algo.canonical_url)
    return { ...algo, concept_identity: { reference_source: 'fixed', canonical_url: algo.canonical_url, code_field: 'id' } }
  return null
}

// Replicated from src/components/map-projects/projectTargetRepo.js
const getTargetRepoVersionFromUrl = url => {
  const parts = (url || '').split('/').filter(Boolean)
  return parts[4] || ''
}

const getProjectTargetRepoVersion = projectData => {
  const versionFromUrl = getTargetRepoVersionFromUrl(projectData?.target_repo_url)
  return versionFromUrl || projectData?.target_repo?.source_version || ''
}

// Migration-time fallback: legacy projects saved before #2522 (which removed
// the silent 'HEAD' default) effectively pinned to HEAD. Use 'HEAD' as the
// version when none is derivable so the projectContext builds and the
// candidates render after migration.
const getProjectTargetRepoVersionWithFallback = projectData => {
  return getProjectTargetRepoVersion(projectData) || 'HEAD'
}

// Replicated from src/common/utils.js dropVersion()
const dropVersion = (uri) => {
  if(!uri) return uri
  const parts = uri.split('/')
  if(parts.length <= 4) return uri
  const resource = parts[parts.length - 4]
  const name = parts[parts.length - 3]
  const version = parts[parts.length - 2]
  if(['concepts', 'mappings', 'sources', 'collections'].includes(resource) && name && version)
    return parts.slice(0, parts.indexOf(parts[parts.length - 2])).join('/') + '/'
  return uri
}

// Mirror of MapProject.jsx:723-745. Returns null if the projectContext
// can't be built (matches the client's current load-time behavior of
// skipping normalization in that case).
const buildProjectContext = (project) => {
  const loadedRelativeURL = dropVersion(project.target_repo_url || '') || project.target_repo_url
  const loadedTargetCanonical = project.target_repo?.canonical_url ||
    (loadedRelativeURL ? `https://ns.openconceptlab.org${loadedRelativeURL}` : null)
  const loadedTargetVersion = getProjectTargetRepoVersionWithFallback(project)
  if(!loadedTargetCanonical || !loadedTargetVersion) return null

  const loadedBridge = (project.algorithms || []).find(a => ['ocl-bridge', 'ocl-ciel-bridge'].includes(a?.type))

  return {
    namespace: project.namespace || project.owner_url || '',
    target_repo: {
      relative_url: loadedRelativeURL,
      canonical_url: loadedTargetCanonical,
      canonical_url_source: project.target_repo?.canonical_url ? 'repo' : 'derived',
      version: loadedTargetVersion
    },
    ...(loadedBridge?.target_repo_url ? {
      bridge_repo: {
        relative_url: loadedBridge.target_repo_url,
        canonical_url: loadedBridge?.bridge_repo?.canonical_url || `https://ns.openconceptlab.org${loadedBridge.target_repo_url}`,
        canonical_url_source: loadedBridge?.bridge_repo?.canonical_url ? 'repo' : 'derived'
      }
    } : {})
  }
}

// Convert MapProject row's array-shaped `candidates` into the
// `allCandidates`-by-algo-id map the normalizer expects.
// Mirror of MapProject.jsx:695 fallback: entry.algorithm ||
// entry.results[0].search_meta.algorithm. Older saves dropped the
// entry-level `algorithm` field; the client recovers it from the first
// result's search_meta. Entries with NEITHER are dropped (matches
// current client load behavior).
// Three-step algo resolution applied inline in candidatesByAlgo():
//   1. entry.algorithm (newest save format)
//   2. entry.results[0].search_meta.algorithm (older format)
//   3. Migration-only: if the project has exactly one algorithm,
//      attribute to it. Recovers ~18 single-algo projects saved in the
//      earliest format where neither (1) nor (2) was populated. Strict
//      improvement over current client behavior (which drops these
//      entries today).
const candidatesByAlgo = (candidates, projectAlgos) => {
  const byAlgo = {}
  let dropped = 0
  let recovered = 0
  const soleAlgoId = (projectAlgos || []).length === 1 ? projectAlgos[0]?.id : null
  for(const entry of candidates || []) {
    const algoFromEntry = entry?.algorithm
      || entry?.results?.[0]?.search_meta?.algorithm
    const algo = algoFromEntry || soleAlgoId
    if(!algo) { dropped++; continue }
    if(!algoFromEntry && soleAlgoId) recovered++
    if(!byAlgo[algo]) byAlgo[algo] = []
    byAlgo[algo].push(entry)
  }
  return { byAlgo, dropped, recovered }
}

// Serialize Map -> array of [key, def] pairs. Drop the runtime `key`
// field on each def (it's derivable from `reference` at load time and
// the unification plan explicitly says "derived `key` string NEVER
// persisted").
const serializeConceptDefinitions = (defsByKey) => {
  const out = []
  defsByKey.forEach((def, key) => {
    const { key: _runtimeKey, ...defWithoutKey } = def  // eslint-disable-line no-unused-vars
    out.push([key, defWithoutKey])
  })
  return out
}

const main = async () => {
  await mkdir(OUTDIR, { recursive: true })

  const stream = createReadStream(INPUT, { encoding: 'utf8' })
  const rl = createInterface({ input: stream, crlfDelay: Infinity })

  const summary = []
  const skipped = []
  let lineNum = 0

  for await (const line of rl) {
    lineNum++
    if(!line.trim()) continue
    let project
    try {
      project = JSON.parse(line)
    } catch (err) {
      skipped.push({ lineNum, reason: 'json_parse_error', error: String(err).slice(0, 200) })
      continue
    }

    const { id, name, candidates, algorithms } = project
    const v1SizeBytes = JSON.stringify(candidates).length
    const v1NumEntries = Array.isArray(candidates) ? candidates.length : 0

    const projectContext = buildProjectContext(project)
    if(!projectContext) {
      skipped.push({
        id, name,
        reason: 'no_project_context',
        target_repo_url: project.target_repo_url,
        derived_version: getProjectTargetRepoVersion(project)
      })
      summary.push({ id, name, status: 'skipped_no_context', v1_entries: v1NumEntries, v1_size_kb: Math.round(v1SizeBytes/1024) })
      continue
    }

    const enrichedAlgos = (algorithms || []).map(a => ensureConceptIdentity(a) || a)
    const algosWithIdentity = enrichedAlgos.filter(a => a?.concept_identity).length
    const algosWithoutIdentity = enrichedAlgos.length - algosWithIdentity

    const { byAlgo, dropped: entriesDroppedNoAlgo, recovered: entriesRecoveredBySoleAlgo } = candidatesByAlgo(candidates, enrichedAlgos)
    let result
    try {
      result = normalizeLegacyAllCandidates(
        byAlgo,
        projectContext,
        enrichedAlgos,
        CONCEPT_IDENTITY_BY_TYPE
      )
    } catch (err) {
      skipped.push({ id, name, reason: 'normalize_error', error: String(err).slice(0, 500) })
      summary.push({ id, name, status: 'error', v1_entries: v1NumEntries, v1_size_kb: Math.round(v1SizeBytes/1024) })
      continue
    }

    const { rowMatchState, conceptDefinitionsByKey } = result

    const v2Blob = {
      mapper_schema_version: 2,
      concept_definitions: serializeConceptDefinitions(conceptDefinitionsByKey),
      rows: rowMatchState
    }

    const v2Json = JSON.stringify(v2Blob)
    const v2SizeBytes = v2Json.length

    await writeFile(join(OUTDIR, `proj-${id}.v2.json`), v2Json)

    const numRows = Object.keys(rowMatchState).length
    const numCandidates = Object.values(rowMatchState).reduce((sum, r) => sum + Object.keys(r.candidates || {}).length, 0)
    const numConceptRows = Object.values(rowMatchState).reduce((sum, r) => sum + Object.keys(r.concept_rows || {}).length, 0)

    summary.push({
      id, name,
      status: 'ok',
      v1_entries: v1NumEntries,
      v1_size_kb: Math.round(v1SizeBytes / 1024),
      v2_size_kb: Math.round(v2SizeBytes / 1024),
      size_delta_pct: Math.round((v2SizeBytes - v1SizeBytes) / v1SizeBytes * 100),
      n_rows: numRows,
      n_candidates: numCandidates,
      n_concept_rows: numConceptRows,
      n_concept_defs: conceptDefinitionsByKey.size,
      n_algos_total: enrichedAlgos.length,
      n_algos_without_identity: algosWithoutIdentity,
      entries_dropped_no_algo: entriesDroppedNoAlgo,
      entries_recovered_by_sole_algo: entriesRecoveredBySoleAlgo,
      target_repo_version_used: getProjectTargetRepoVersionWithFallback(project),
      target_repo_version_was_fallback: !getProjectTargetRepoVersion(project)
    })
  }

  await writeFile(join(OUTDIR, 'summary.json'), JSON.stringify(summary, null, 2))
  await writeFile(join(OUTDIR, 'skipped.json'), JSON.stringify(skipped, null, 2))

  // Emit a single transactional SQL file so the operator can apply via
  // `psql -f migrate.sql` (idempotent at the BEGIN/COMMIT boundary). Each
  // UPDATE re-reads the v2 blob from disk via psql variable substitution
  // to avoid embedding multi-MB JSON inline.
  const sqlPath = join(OUTDIR, 'migrate.sql')
  const sqlFile = await open(sqlPath, 'w')
  await sqlFile.write('-- v1 -> v2 candidates migration\n')
  await sqlFile.write('-- Generated by scripts/migrate-candidates-to-v2/migrate.mjs\n')
  await sqlFile.write('-- Apply with: psql -f migrate.sql\n')
  await sqlFile.write('BEGIN;\n')
  for(const s of summary) {
    if(s.status !== 'ok') continue
    const file = join(OUTDIR, `proj-${s.id}.v2.json`)
    // Use \set + format-string to read each file inline. Postgres parses
    // JSONB from the literal; the escape-on-quotes is handled by E'...'.
    await sqlFile.write(`\\set v2 \`cat ${file}\`\n`)
    await sqlFile.write(`UPDATE map_projects SET candidates = :'v2'::jsonb WHERE id = ${s.id};\n`)
  }
  await sqlFile.write('COMMIT;\n')
  await sqlFile.close()

  const okCount = summary.filter(s => s.status === 'ok').length
  const errCount = summary.filter(s => s.status === 'error').length
  const skipCount = summary.filter(s => s.status === 'skipped_no_context').length
  console.log(`Processed ${summary.length} projects: ${okCount} ok | ${skipCount} skipped | ${errCount} errors`)
  console.log(`Output: ${OUTDIR}/`)
  console.log(`SQL:    ${sqlPath}  (apply with: psql -f ${sqlPath})`)
}

main().catch(err => {
  console.error('FATAL', err)
  process.exit(1)
})
