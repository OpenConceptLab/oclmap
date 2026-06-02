/* eslint-env node */
/* eslint-disable no-process-env, no-console */

/**
 * Independent v1 -> v2 migration equivalence validator.
 *
 * Reads the SAME NDJSON input that migrate.mjs consumed plus the v2 blobs it
 * produced (output/proj-<id>.v2.json), and independently re-derives what the
 * migration SHOULD have preserved, then diffs against what it DID produce.
 *
 * This does NOT trust the normalizer — it recomputes expectations from the raw
 * v1 data and asserts:
 *   - code coverage : every concept code from a survivable v1 result appears in v2
 *   - row coverage  : every v1 row with survivable results appears in v2.rows
 *   - referential integrity within v2 (candidate->def, candidate->algo_response,
 *     concept_row->def)
 * and QUANTIFIES the two known silent-drop classes:
 *   - orphan-tag drop  : results tagged with an algorithm id not in the project's
 *     current algorithms[] config (normalizers.js `if(!algoDef) return`)
 *   - no-identity drop : results under a configured algo with no derivable
 *     concept_identity (e.g. type:custom with no canonical_url)
 *
 * Read-only. Operates on dry-run artifacts only.
 *
 *   INPUT  ./input/projects.ndjson
 *   OUTDIR ./output            (reads proj-<id>.v2.json, writes validation-report.json)
 */

import { createReadStream } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { createInterface } from 'node:readline'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const INPUT = resolve(process.env.INPUT || join(__dirname, 'input/projects.ndjson'))
const OUTDIR = resolve(process.env.OUTDIR || join(__dirname, 'output'))

// Mirror of migrate.mjs CONCEPT_IDENTITY_BY_TYPE keys (which types have a
// built-in identity). custom needs a canonical_url to get one.
const TYPES_WITH_IDENTITY = new Set([
  'ocl-semantic', 'ocl-search', 'ocl-bridge', 'ocl-ciel-bridge', 'ocl-scispacy'
])
const algoHasIdentity = (a) =>
  !!a && (TYPES_WITH_IDENTITY.has(a.type) || (a.type === 'custom' && !!a.canonical_url))

// Effective tag the migration groups an entry under (mirror of
// candidatesByAlgo): entry.algorithm || results[0].search_meta.algorithm ||
// (sole configured algo id, only when the first two are absent).
const effectiveTag = (entry, soleAlgoId) => {
  const t = entry?.algorithm || entry?.results?.[0]?.search_meta?.algorithm
  if(t) return t
  return soleAlgoId || null
}

const codeFromConceptKey = (key) => {
  try { const a = JSON.parse(key); return Array.isArray(a) ? String(a[1]) : null } catch { return null }
}

const main = async () => {
  const rl = createInterface({ input: createReadStream(INPUT, { encoding: 'utf8' }), crlfDelay: Infinity })
  const report = []
  let hardFail = 0

  for await (const line of rl) {
    if(!line.trim()) continue
    const p = JSON.parse(line)
    const { id, name } = p
    const candidates = Array.isArray(p.candidates) ? p.candidates : []
    const algos = Array.isArray(p.algorithms) ? p.algorithms : []
    const configuredIds = new Set(algos.map(a => a?.id).filter(Boolean))
    const algoById = new Map(algos.map(a => [a?.id, a]))
    const soleAlgoId = algos.length === 1 ? algos[0]?.id : null

    // --- v1 expectations ---
    let v1Results = 0
    let survivableResults = 0          // tag in config AND algo has identity
    let droppedOrphanTag = 0           // tag not in config
    let droppedNoIdentity = 0          // tag in config but algo lacks identity
    const expectedCodes = new Set()    // codes from survivable results (+ cascade targets)
    const survivableRows = new Set()
    const orphanTags = new Map()
    // Codes that the orphan/no-identity result-derived fallback should recover
    // (PR3-C / ocl_issues#2555). Verified present in v2 below.
    const recoverableCodes = new Set()
    const addCodes = (results) => results.forEach(r => { if(r?.id) recoverableCodes.add(String(r.id)) })

    for(const entry of candidates) {
      const results = entry?.results || []
      v1Results += results.length
      const tag = effectiveTag(entry, soleAlgoId)
      const idx = entry?.row?.__index
      if(!tag) { // null tag, multi-algo -> recovered via result-derived fallback
        droppedOrphanTag += results.length
        if(results.length) orphanTags.set('<null>', (orphanTags.get('<null>') || 0) + results.length)
        addCodes(results)
        continue
      }
      if(!configuredIds.has(tag)) {
        droppedOrphanTag += results.length
        if(results.length) orphanTags.set(tag, (orphanTags.get(tag) || 0) + results.length)
        addCodes(results)
        continue
      }
      if(!algoHasIdentity(algoById.get(tag))) {
        droppedNoIdentity += results.length
        addCodes(results)
        continue
      }
      // survivable
      survivableResults += results.length
      if(idx !== undefined && idx !== null && results.length) survivableRows.add(String(idx))
      // Only bridge algos expand result.mappings[].cascade_target into their own
      // concept_defs. For non-bridge algos, result.mappings are the concept's own
      // cross-references and are NOT migrated to concept_defs, so harvesting them
      // here would be a false-positive coverage miss.
      const isBridge = ['ocl-bridge', 'ocl-ciel-bridge'].includes(algoById.get(tag)?.type)
      for(const r of results) {
        if(r?.id) expectedCodes.add(String(r.id))
        if(isBridge) {
          for(const m of (r?.mappings || [])) {
            if(m?.cascade_target_concept_code) expectedCodes.add(String(m.cascade_target_concept_code))
          }
        }
      }
    }

    // --- v2 actuals ---
    let v2 = null
    try { v2 = JSON.parse(await readFile(join(OUTDIR, `proj-${id}.v2.json`), 'utf8')) } catch { /* missing */ }
    const defs = v2?.concept_definitions || []
    const defKeys = new Set(defs.map(([k]) => k))
    const v2Codes = new Set(defs.map(([k]) => codeFromConceptKey(k)).filter(Boolean))
    const rows = v2?.rows || {}
    let v2Candidates = 0
    const refErrors = []
    for(const [idx, row] of Object.entries(rows)) {
      const arIds = new Set(Object.keys(row?.algorithm_responses || {}))
      for(const [cid, c] of Object.entries(row?.candidates || {})) {
        v2Candidates++
        if(c?.concept_key && !defKeys.has(c.concept_key)) refErrors.push(`row ${idx} cand ${cid}: concept_key not in defs`)
        if(c?.algorithm_response_id && !arIds.has(c.algorithm_response_id)) refErrors.push(`row ${idx} cand ${cid}: algorithm_response_id dangling`)
      }
      for(const ck of Object.keys(row?.concept_rows || {})) {
        if(!defKeys.has(ck)) refErrors.push(`row ${idx} concept_row ${ck}: not in defs`)
      }
    }

    // --- checks ---
    const missingCodes = [...expectedCodes].filter(c => !v2Codes.has(c))
    const missingRows = [...survivableRows].filter(r => !(r in rows))
    // Orphan/no-identity recovery: every recoverable code should now be in v2.
    const orphanMissingCodes = [...recoverableCodes].filter(c => !v2Codes.has(c))
    const orphanRecoveredCount = recoverableCodes.size - orphanMissingCodes.length
    const flags = []
    if(missingCodes.length) flags.push(`CODE_COVERAGE_FAIL(${missingCodes.length} missing)`)
    if(missingRows.length) flags.push(`ROW_COVERAGE_FAIL(${missingRows.length} missing)`)
    if(refErrors.length) flags.push(`REF_INTEGRITY_FAIL(${refErrors.length})`)
    if(orphanMissingCodes.length) flags.push(`ORPHAN_UNRECOVERED(${orphanMissingCodes.length} codes)`)
    // info: orphan/no-identity at-risk results now recovered via fallback
    if(droppedOrphanTag > 0) flags.push(`ORPHAN_TAG_RECOVERED(${orphanRecoveredCount}/${recoverableCodes.size} codes)`)
    if(v1Results > 0 && v2Candidates === 0) flags.push('ZERO_OUT_WITH_RESULTS')

    const hard = missingCodes.length > 0 || missingRows.length > 0 || refErrors.length > 0 || orphanMissingCodes.length > 0
    if(hard) hardFail++

    report.push({
      id, name,
      v1_results: v1Results,
      survivable_results: survivableResults,
      dropped_orphan_tag: droppedOrphanTag,
      dropped_no_identity: droppedNoIdentity,
      orphan_tags: Object.fromEntries(orphanTags),
      configured_algo_ids: [...configuredIds],
      v2_candidates: v2Candidates,
      v2_concept_defs: defs.length,
      v2_rows: Object.keys(rows).length,
      missing_codes: missingCodes.length,
      missing_rows: missingRows.length,
      orphan_recoverable_codes: recoverableCodes.size,
      orphan_recovered_codes: orphanRecoveredCount,
      orphan_unrecovered_codes: orphanMissingCodes.length,
      ref_errors: refErrors.slice(0, 5),
      hard_fail: hard,
      flags
    })
  }

  await writeFile(join(OUTDIR, 'validation-report.json'), JSON.stringify(report, null, 2))

  // ---- console summary ----
  const sum = (f) => report.reduce((s, r) => s + (r[f] || 0), 0)
  console.log(`\n=== VALIDATION SUMMARY (${report.length} projects) ===`)
  console.log(`HARD FAILURES (coverage / referential integrity): ${hardFail}`)
  console.log(`Total v1 results: ${sum('v1_results')}`)
  console.log(`  survivable (matched algo, expected in v2): ${sum('survivable_results')}`)
  console.log(`  at-risk - orphan tag (not in current algorithms[]): ${sum('dropped_orphan_tag')}`)
  console.log(`  at-risk - no concept_identity (custom, no canonical): ${sum('dropped_no_identity')}`)
  console.log(`\nOrphan/no-identity RECOVERY (result-derived fallback):`)
  console.log(`  recoverable codes: ${sum('orphan_recoverable_codes')}`)
  console.log(`  recovered in v2:   ${sum('orphan_recovered_codes')}`)
  console.log(`  STILL MISSING:     ${sum('orphan_unrecovered_codes')}`)
  const orphanProjs = report.filter(r => r.dropped_orphan_tag > 0 || r.dropped_no_identity > 0)
  console.log(`\n-- at-risk projects (recovered codes / recoverable) --`)
  for(const r of orphanProjs.sort((a, b) => b.orphan_recoverable_codes - a.orphan_recoverable_codes)) {
    console.log(`  id=${r.id} recovered=${r.orphan_recovered_codes}/${r.orphan_recoverable_codes} missing=${r.orphan_unrecovered_codes} v2_cands=${r.v2_candidates} tags=${JSON.stringify(r.orphan_tags)} | ${r.name.slice(0, 30)}`)
  }
  if(hardFail) {
    console.log(`\n-- HARD FAILURES --`)
    for(const r of report.filter(x => x.hard_fail))
      console.log(`  id=${r.id} missing_codes=${r.missing_codes} missing_rows=${r.missing_rows} ref_errors=${r.ref_errors.length} | ${r.name.slice(0, 32)}`)
  }
  console.log(`\nReport: ${join(OUTDIR, 'validation-report.json')}`)
}

main().catch(e => { console.error('FATAL', e); process.exit(1) })
