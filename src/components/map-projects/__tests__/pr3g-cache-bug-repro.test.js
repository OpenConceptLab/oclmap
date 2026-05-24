/**
 * Pure-logic reproducer for OpenConceptLab/ocl_issues#2536 (PR3-G).
 *
 * Bug: After PR2b + PR3-D1, AI Assistant `recommendable_concepts[*]`
 * entries for bridge cascade targets are missing `display_name` in a
 * significant fraction of cases, even when the lookup repo returns 200.
 * Run-2 (2026-05-21 ICD-11 IMO) showed 162/1574 entries hit by this.
 *
 * Strategy: simulate the run-2 sequence (bridge $match → lookup → second
 * bridge $match → AI-payload build) using:
 *   - the real `normalizeAlgorithmInvocation` from normalizers.js
 *   - pure-function versions of mergeIntoRowMatchState's cache-merge
 *     branch and writeConceptCachePatch (extracted for testability)
 *   - the real `buildRecommendableConceptEntry` from normalizers.js
 *   - real fixture data: bridge $match payload + lookup responses
 *     captured from the 2026-05-21 ICD-11 IMO run.
 *
 * Outcome decision tree:
 *   - If both target tests PASS  → bug is NOT in pure logic. The bug
 *     is in React lifecycle (useEffect / closure capture). Escalate
 *     to an RTL + happy-dom integration test (option B from #2536 PR
 *     discussion) or Playwright (option C).
 *   - If either test FAILS       → we have a deterministic repro in
 *     pure logic. Fix the merge/write logic and this test becomes
 *     the regression guard.
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  normalizeAlgorithmInvocation,
  buildRecommendableConceptEntry,
  lookupStatusRank
} from '../normalizers.js'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const fx = (name) => JSON.parse(fs.readFileSync(path.join(HERE, 'fixtures', name), 'utf8'))

// --- fixtures (captured from the 2026-05-21 ICD-11 IMO run + live lookup repo)
const bridgeRow1   = fx('pr3g-bridge-row1.json')
const lookupQC01_2 = fx('pr3g-lookup-QC01-2.json')
const lookupQC02_Z = fx('pr3g-lookup-QC02-Z.json')

// --- project context: ICD-11 IMO (project 126 in run-2)
const projectContext = {
  namespace: '/users/askanter/',
  target_repo: {
    relative_url: '/orgs/WHO/sources/ICD-11-WHO/',
    canonical_url: 'http://id.who.int/icd/release/11/mms',
    canonical_url_source: 'repo',
    version: 'HEAD'
  },
  bridge_repo: {
    relative_url: '/orgs/CIEL/sources/CIEL/',
    canonical_url: 'https://CIELterminology.org',
    canonical_url_source: 'repo'
  }
}

// --- algorithm config: ocl-ciel-bridge as defined in algorithms.jsx
const bridgeAlgoConfig = {
  id: 'ocl-ciel-bridge',
  type: 'ocl-ciel-bridge',
  concept_identity: {
    reference_source: 'bridge_repo',
    code_field: 'id',
    ocl_url_field: 'url',
    cascade_target: {
      reference_source: 'target_repo',
      code_field: 'cascade_target_concept_code',
      ocl_url_field: 'cascade_target_concept_url'
    }
  }
}

// --- pure-function mirror of MapProject.jsx:374-386 (mergeIntoRowMatchState
// conceptCache-merge branch). Rank-guarded: pending stubs cannot overwrite
// 'full' / 'partial' entries.
const applyCacheMerge = (cache, conceptDefinitions) => {
  const next = { ...cache }
  conceptDefinitions.forEach(def => {
    const existing = next[def.key]
    if (!existing || lookupStatusRank(def.lookup_status) > lookupStatusRank(existing.lookup_status)) {
      next[def.key] = def
    }
  })
  return next
}

// --- pure-function mirror of MapProject.jsx:3308 (writeConceptCachePatch
// lookup write-back). Unconditional overwrite — the lookup result spreads
// over the existing stub.
const applyLookupPatch = (cache, key, lookupData, oclUrl) => {
  const existing = cache[key] || {}
  return {
    ...cache,
    [key]: {
      ...existing,
      ...lookupData,
      ocl_url: oclUrl,
      lookup_status: 'full',
      lookup_source_type: '$lookup',
      lookup_source: oclUrl
    }
  }
}

// --- the simulated end-to-end sequence ---
const runSequence = () => {
  // T=0: row 1 bridge $match arrives.
  const norm1 = normalizeAlgorithmInvocation(bridgeRow1, {
    algorithmId: 'ocl-ciel-bridge',
    algorithmConfig: bridgeAlgoConfig,
    projectContext,
    rowIndex: 1
  })
  let cache = applyCacheMerge({}, norm1.concept_definitions)

  // T=1: ensureLoaded fires for the pending bridge cascade targets.
  // The lookup repo (project's lookup_config) returns 200 for both QC01.2
  // and QC02.Z. writeConceptCachePatch lands the data in cache.
  const qc01Key = norm1.concept_definitions.find(
    d => d.reference?.code === 'QC01.2'
  )?.key
  const qc02Key = norm1.concept_definitions.find(
    d => d.reference?.code === 'QC02.Z'
  )?.key
  cache = applyLookupPatch(cache, qc01Key, lookupQC01_2,
    '/orgs/OpenMRS-OCL-Squad/sources/ICD-11-WHO-Mapper/concepts/QC01.2/')
  cache = applyLookupPatch(cache, qc02Key, lookupQC02_Z,
    '/orgs/OpenMRS-OCL-Squad/sources/ICD-11-WHO-Mapper/concepts/QC02.Z/')

  // T=2: a later row's bridge $match arrives and re-references QC01.2 +
  // QC02.Z as cascade targets (run-2 had multiple rows producing these
  // codes). Same shape: pending stubs with display_name=null. The rank
  // guard at MapProject.jsx:378 should preserve the lookup enrichment.
  const norm2 = normalizeAlgorithmInvocation(bridgeRow1, {
    algorithmId: 'ocl-ciel-bridge',
    algorithmConfig: bridgeAlgoConfig,
    projectContext,
    rowIndex: 7   // pretend it's a different row
  })
  cache = applyCacheMerge(cache, norm2.concept_definitions)

  // T=3: AI payload build for row 1. The defsByKey iteration in
  // buildV2RecommendationPayload (MapProject.jsx:3863) reads each
  // candidate's def from conceptCache by concept_key.
  const buildEntry = (key) => buildRecommendableConceptEntry({
    def: cache[key],
    key,
    evidence: [{
      algorithm_id: 'ocl-ciel-bridge',
      candidate_type: 'bridge_child'
    }],
    rowState: undefined,
    summaryPropertyCodes: undefined,
    effectiveLocales: ['en']
  })

  return {
    qc01Entry: buildEntry(qc01Key),
    qc02Entry: buildEntry(qc02Key),
    qc01CacheEntry: cache[qc01Key],
    qc02CacheEntry: cache[qc02Key]
  }
}

// --- the actual assertions ---

test('PR3-G: bridge cascade target QC02.Z reaches AI payload with display_name (control)', () => {
  const { qc02Entry, qc02CacheEntry } = runSequence()
  assert.equal(qc02CacheEntry.lookup_status, 'full',
    'cache entry for QC02.Z should be lookup-enriched after the sequence')
  assert.equal(qc02CacheEntry.display_name,
    'Need for immunization against certain specified single infectious diseases, unspecified',
    'cache entry for QC02.Z should carry display_name from the lookup repo')
  assert.equal(qc02Entry.display_name,
    'Need for immunization against certain specified single infectious diseases, unspecified',
    'AI payload entry for QC02.Z should have display_name (this is the working case in run-2)')
})

test('PR3-G repro: bridge cascade target QC01.2 reaches AI payload with display_name', () => {
  const { qc01Entry, qc01CacheEntry } = runSequence()
  assert.equal(qc01CacheEntry.lookup_status, 'full',
    'cache entry for QC01.2 should be lookup-enriched after the sequence')
  assert.equal(qc01CacheEntry.display_name,
    'Need for immunization against rabies',
    'cache entry for QC01.2 should carry display_name from the lookup repo')
  // This is the assertion that fails in production for 162/1574 entries:
  // QC01.2 ends up with display_name=null in the AI payload despite the
  // lookup having succeeded.
  assert.equal(qc01Entry.display_name,
    'Need for immunization against rabies',
    'AI payload entry for QC01.2 must have display_name (PR3-G bug)')
})
