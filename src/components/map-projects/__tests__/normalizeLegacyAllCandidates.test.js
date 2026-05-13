/**
 * Tests for the legacy-shape -> unified-model backfill used at project
 * load time. Critical for the flag flip — without correct backfill,
 * reloaded v1 projects render zero candidates under
 * UNIFIED_MODEL_ENABLED=true.
 *
 * Run with: npm test
 */

import test from 'node:test'
import assert from 'node:assert/strict'

import { normalizeLegacyAllCandidates } from '../normalizers.js'

const CONCEPT_IDENTITY_BY_TYPE = {
  'ocl-search': {
    reference_source: 'target_repo',
    code_field: 'id',
    ocl_url_field: 'url'
  },
  'ocl-semantic': {
    reference_source: 'target_repo',
    code_field: 'id',
    ocl_url_field: 'url'
  },
  'ocl-bridge': {
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

const projectContext = {
  namespace: '/orgs/MyOrg/',
  target_repo: {
    relative_url: '/orgs/Regenstrief/sources/LOINC/',
    canonical_url: 'http://loinc.org',
    canonical_url_source: 'repo'
  },
  bridge_repo: {
    relative_url: '/orgs/CIEL/sources/CIEL/',
    canonical_url: 'https://CIELterminology.org',
    canonical_url_source: 'repo'
  }
}

const oclSearchAlgo = { id: 'ocl-search', type: 'ocl-search' }
const oclBridgeAlgo = { id: 'ocl-bridge', type: 'ocl-bridge' }

const glucose = {
  id: '49494-3',
  display_name: 'Glucose [Mass/volume] in Blood',
  url: '/orgs/Regenstrief/sources/LOINC/concepts/49494-3/',
  source: 'LOINC',
  owner: 'Regenstrief',
  names: [{ name: 'Glucose [Mass/volume] in Blood', locale: 'en', preferred: true }],
  descriptions: [{ description: 'Glucose mass per volume in blood', locale: 'en' }],
  search_meta: { search_score: 0.85, search_normalized_score: 87, algorithm: 'ocl-search' }
}

const cholesterol = {
  id: '2093-3',
  display_name: 'Cholesterol in Serum or Plasma',
  url: '/orgs/Regenstrief/sources/LOINC/concepts/2093-3/',
  source: 'LOINC',
  owner: 'Regenstrief',
  names: [{ name: 'Cholesterol', locale: 'en', preferred: true }],
  descriptions: [{ description: 'Total cholesterol', locale: 'en' }],
  search_meta: { search_score: 0.6, search_normalized_score: 55, algorithm: 'ocl-search' }
}

// ---------- Empty / null inputs ----------

test('normalizeLegacyAllCandidates handles null input', () => {
  const out = normalizeLegacyAllCandidates(null, projectContext, [], {})
  assert.deepEqual(out.rowMatchState, {})
  assert.equal(out.conceptDefinitionsByKey.size, 0)
})

test('normalizeLegacyAllCandidates handles missing projectContext', () => {
  const out = normalizeLegacyAllCandidates({'ocl-search': [{row: {__index: 0}, results: [glucose]}]}, null, [oclSearchAlgo], CONCEPT_IDENTITY_BY_TYPE)
  assert.deepEqual(out.rowMatchState, {})
})

test('normalizeLegacyAllCandidates handles empty allCandidates', () => {
  const out = normalizeLegacyAllCandidates({}, projectContext, [oclSearchAlgo], CONCEPT_IDENTITY_BY_TYPE)
  assert.deepEqual(out.rowMatchState, {})
})

// ---------- Single algo, single row ----------

test('single ocl-search row produces one RowMatchState entry with normalized candidates', () => {
  const allCandidates = {
    'ocl-search': [{ row: { __index: 0, name: 'glucose' }, results: [glucose] }]
  }
  const { rowMatchState, conceptDefinitionsByKey } = normalizeLegacyAllCandidates(
    allCandidates, projectContext, [oclSearchAlgo], CONCEPT_IDENTITY_BY_TYPE
  )
  assert.equal(Object.keys(rowMatchState).length, 1)
  const row0 = rowMatchState[0]
  assert.equal(Object.keys(row0.candidates).length, 1)
  assert.equal(Object.keys(row0.concept_rows).length, 1)
  assert.equal(conceptDefinitionsByKey.size, 1)
})

test('single-algo rerank score is carried onto ConceptRow.rerank_score', () => {
  const allCandidates = {
    'ocl-search': [{ row: { __index: 0 }, results: [glucose] }]
  }
  const { rowMatchState } = normalizeLegacyAllCandidates(
    allCandidates, projectContext, [oclSearchAlgo], CONCEPT_IDENTITY_BY_TYPE
  )
  const cr = Object.values(rowMatchState[0].concept_rows)[0]
  assert.equal(cr.rerank_score, 87)
})

// ---------- Multi-algo + multi-row ----------

test('two algos returning the same concept dedupe into one ConceptRow with two Candidates', () => {
  const semanticHit = {...glucose, search_meta: { search_score: 0.78, search_normalized_score: 87, algorithm: 'ocl-semantic' }}
  const allCandidates = {
    'ocl-search': [{ row: { __index: 0 }, results: [glucose] }],
    'ocl-semantic': [{ row: { __index: 0 }, results: [semanticHit] }]
  }
  const { rowMatchState } = normalizeLegacyAllCandidates(
    allCandidates, projectContext,
    [oclSearchAlgo, {id: 'ocl-semantic', type: 'ocl-semantic'}],
    CONCEPT_IDENTITY_BY_TYPE
  )
  const row = rowMatchState[0]
  assert.equal(Object.keys(row.candidates).length, 2)
  assert.equal(Object.keys(row.concept_rows).length, 1, 'one ConceptRow for the converged concept')
  const algos = Object.values(row.candidates).map(c => c.algorithm_id).sort()
  assert.deepEqual(algos, ['ocl-search', 'ocl-semantic'])
})

test('different rows do not contaminate each other', () => {
  const allCandidates = {
    'ocl-search': [
      { row: { __index: 0 }, results: [glucose] },
      { row: { __index: 1 }, results: [cholesterol] }
    ]
  }
  const { rowMatchState } = normalizeLegacyAllCandidates(
    allCandidates, projectContext, [oclSearchAlgo], CONCEPT_IDENTITY_BY_TYPE
  )
  assert.equal(Object.keys(rowMatchState[0].concept_rows).length, 1)
  assert.equal(Object.keys(rowMatchState[1].concept_rows).length, 1)
  const row0Key = Object.keys(rowMatchState[0].concept_rows)[0]
  const row1Key = Object.keys(rowMatchState[1].concept_rows)[0]
  assert.notEqual(row0Key, row1Key, 'two different concepts → two different keys')
})

// ---------- Bridge backfill ----------

test('bridge result backfill creates 2 ConceptRows + 2 Candidates per cascade target', () => {
  const bridgeHit = {
    id: 'CIEL_12345',
    display_name: 'Blood glucose measurement',
    url: '/orgs/CIEL/sources/CIEL/concepts/CIEL_12345/',
    source: 'CIEL',
    owner: 'CIEL',
    search_meta: { search_score: 0.92, search_normalized_score: 91, algorithm: 'ocl-bridge' },
    mappings: [{
      cascade_target_concept_code: '49494-3',
      cascade_target_concept_url: '/orgs/Regenstrief/sources/LOINC/concepts/49494-3/',
      cascade_target_concept_name: 'Glucose [Mass/volume] in Blood',
      cascade_target_source_name: 'LOINC',
      map_type: 'SAME-AS'
    }]
  }
  const allCandidates = {
    'ocl-bridge': [{ row: { __index: 0 }, results: [bridgeHit] }]
  }
  const { rowMatchState, conceptDefinitionsByKey } = normalizeLegacyAllCandidates(
    allCandidates, projectContext, [oclBridgeAlgo], CONCEPT_IDENTITY_BY_TYPE
  )
  const row = rowMatchState[0]
  assert.equal(Object.keys(row.candidates).length, 2, '1 bridge + 1 bridge_child')
  assert.equal(Object.keys(row.concept_rows).length, 2, 'bridge intermediary + cascade target')
  assert.equal(conceptDefinitionsByKey.size, 2)
  const types = Object.values(row.candidates).map(c => c.type).sort()
  assert.deepEqual(types, ['bridge', 'bridge_child'])
})

// ---------- Concept identity injection fallback ----------

test('algorithm without concept_identity has it injected from conceptIdentityByType', () => {
  // ocl-bridge entries loaded from the API don't carry concept_identity —
  // CONCEPT_IDENTITY_BY_TYPE is the fallback map. This mirrors getAlgoDef's
  // behavior in MapProject.
  const algoWithoutIdentity = { id: 'ocl-bridge', type: 'ocl-bridge' }
  const bridgeHit = {
    id: 'CIEL_999',
    display_name: 'Test',
    url: '/orgs/CIEL/sources/CIEL/concepts/CIEL_999/',
    source: 'CIEL',
    search_meta: { search_score: 0.7 },
    mappings: []
  }
  const out = normalizeLegacyAllCandidates(
    { 'ocl-bridge': [{ row: { __index: 0 }, results: [bridgeHit] }] },
    projectContext,
    [algoWithoutIdentity],
    CONCEPT_IDENTITY_BY_TYPE
  )
  assert.equal(out.conceptDefinitionsByKey.size, 1, 'identity injection worked')
})

test('algorithm with no concept_identity AND no fallback is silently skipped', () => {
  const unknownAlgo = { id: 'mystery', type: 'mystery' }
  const out = normalizeLegacyAllCandidates(
    { 'mystery': [{ row: { __index: 0 }, results: [glucose] }] },
    projectContext,
    [unknownAlgo],
    {} // empty fallback map
  )
  assert.deepEqual(out.rowMatchState, {}, 'no entries when identity cannot be resolved')
})

test('rowEntry without a row index is silently skipped', () => {
  const out = normalizeLegacyAllCandidates(
    { 'ocl-search': [{ row: null, results: [glucose] }, { row: { __index: 0 }, results: [glucose] }] },
    projectContext, [oclSearchAlgo], CONCEPT_IDENTITY_BY_TYPE
  )
  assert.equal(Object.keys(out.rowMatchState).length, 1)
  assert.ok(out.rowMatchState[0])
})

test('ConceptDefinitions are deduped across rows by key with richer-wins', () => {
  // Same concept appears in two rows: should appear once in
  // conceptDefinitionsByKey (it's project-wide), but in both rows'
  // concept_rows (per-row).
  const allCandidates = {
    'ocl-search': [
      { row: { __index: 0 }, results: [glucose] },
      { row: { __index: 1 }, results: [glucose] }
    ]
  }
  const { rowMatchState, conceptDefinitionsByKey } = normalizeLegacyAllCandidates(
    allCandidates, projectContext, [oclSearchAlgo], CONCEPT_IDENTITY_BY_TYPE
  )
  assert.equal(conceptDefinitionsByKey.size, 1, 'project-wide dedup')
  assert.equal(Object.keys(rowMatchState[0].concept_rows).length, 1)
  assert.equal(Object.keys(rowMatchState[1].concept_rows).length, 1)
})
