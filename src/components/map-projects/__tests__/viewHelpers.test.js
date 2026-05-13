/**
 * Tests for the pure helpers in viewBuilders.js:
 *   - getScoreDetails (used by Score.jsx)
 *   - conceptForMapping (the tuple -> legacy concept projection at the
 *     onMap / isSelectedForMap boundary)
 *   - resolveAICandidateID (AI Assistant response resolution chain)
 *
 * Run with: npm test
 */

import test from 'node:test'
import assert from 'node:assert/strict'

import {
  getScoreDetails,
  conceptForMapping,
  resolveAICandidateID
} from '../viewBuilders.js'

const candidatesScore = { recommended: 80, available: 60 }

// ---------- getScoreDetails ----------

test('getScoreDetails: rerank_score in recommended bucket', () => {
  const out = getScoreDetails(
    { candidate: { score: 0.85 }, conceptRow: { rerank_score: 90 } },
    candidatesScore
  )
  assert.equal(out.qualityBucket, 'recommended')
  assert.equal(out.percentile, 90)
  assert.equal(out.score, 0.85)
  assert.equal(out.rerankScore, '90.00%')
  assert.equal(out.algoScore, '0.85')
})

test('getScoreDetails: rerank_score in available bucket', () => {
  const out = getScoreDetails(
    { candidate: { score: 0.6 }, conceptRow: { rerank_score: 70 } },
    candidatesScore
  )
  assert.equal(out.qualityBucket, 'available')
})

test('getScoreDetails: rerank_score in low_ranked bucket', () => {
  const out = getScoreDetails(
    { candidate: { score: 0.3 }, conceptRow: { rerank_score: 40 } },
    candidatesScore
  )
  assert.equal(out.qualityBucket, 'low_ranked')
})

test('getScoreDetails: no rerank_score leaves percentile undefined (no score*100 fallback)', () => {
  // Interim state: an algo (e.g. ocl-semantic) returned candidates with a
  // raw score but the debounced $rerank/ pass hasn't landed yet. Scaling
  // raw to a 0-100 percentile would mislead (semantic raw scores cluster
  // near 1.0); leave it undefined so the UI shows a placeholder.
  const out = getScoreDetails(
    { candidate: { score: 0.85 }, conceptRow: {} },
    candidatesScore
  )
  assert.equal(out.percentile, undefined)
  assert.equal(out.hasPercentile, false)
  assert.equal(out.qualityBucket, undefined)
  assert.equal(out.algoScore, '0.85', 'raw score still surfaces for the algo-score chip')
  assert.equal(out.rerankScore, '', 'no unified score string when rerank is pending')
})

test('getScoreDetails: no scores at all yields hasPercentile=false and no bucket', () => {
  const out = getScoreDetails(
    { candidate: {}, conceptRow: {} },
    candidatesScore
  )
  assert.equal(out.hasPercentile, false)
  assert.equal(out.qualityBucket, undefined)
})

test('getScoreDetails: bridge_child candidate (no own score) uses rerank_score only', () => {
  // bridge_child has no algorithm score (the bridge response didn't score
  // the cascade target). But the ConceptRow has a rerank_score from the
  // debounced rerank pass.
  const out = getScoreDetails(
    { candidate: { score: undefined }, conceptRow: { rerank_score: 75 } },
    candidatesScore
  )
  assert.equal(out.percentile, 75)
  assert.equal(out.qualityBucket, 'available')
  assert.equal(out.algoScore, '', 'no raw score when candidate.score is undefined')
})

test('getScoreDetails: percentile exactly at threshold lands in the higher bucket', () => {
  const out = getScoreDetails(
    { candidate: {}, conceptRow: { rerank_score: 80 } },
    candidatesScore
  )
  assert.equal(out.qualityBucket, 'recommended', '80 is >= 80 so recommended')
})

// ---------- conceptForMapping ----------

const sampleDef = {
  reference: { url: 'http://loinc.org', code: '49494-3' },
  key: 'k1',
  ocl_url: '/orgs/Regenstrief/sources/LOINC/concepts/49494-3/',
  id: '49494-3',
  display_name: 'Glucose [Mass/volume] in Blood',
  source: 'LOINC',
  owner: 'Regenstrief',
  names: [{ name: 'Glucose', locale: 'en' }],
  descriptions: [{ description: 'Test', locale: 'en' }],
  concept_class: 'LOINC',
  datatype: 'Numeric',
  retired: false,
  properties: []
}

test('conceptForMapping: returns null when conceptDefinition is missing', () => {
  assert.equal(conceptForMapping(null), null)
  assert.equal(conceptForMapping({}), null)
})

test('conceptForMapping: projects a standard tuple to the legacy concept shape', () => {
  const out = conceptForMapping({
    candidate: { algorithm_id: 'ocl-search', score: 0.85, highlights: {name: ['<em>glucose</em>']} },
    conceptDefinition: sampleDef,
    conceptRow: { rerank_score: 87 }
  })
  assert.equal(out.id, '49494-3')
  assert.equal(out.display_name, 'Glucose [Mass/volume] in Blood')
  assert.equal(out.url, '/orgs/Regenstrief/sources/LOINC/concepts/49494-3/')
  assert.equal(out.source, 'LOINC')
  assert.equal(out.type, 'Concept')
  assert.equal(out.search_meta.algorithm, 'ocl-search')
  assert.equal(out.search_meta.search_score, 0.85)
  assert.equal(out.search_meta.search_normalized_score, 87)
  assert.deepEqual(out.search_meta.search_highlight, {name: ['<em>glucose</em>']})
  assert.equal(out.bridge_concept, undefined)
})

test('conceptForMapping: falls back to reference.code when conceptDefinition.id is absent', () => {
  const def = { ...sampleDef, id: undefined }
  const out = conceptForMapping({
    candidate: { algorithm_id: 'ocl-search' },
    conceptDefinition: def,
    conceptRow: {}
  })
  assert.equal(out.id, '49494-3', 'reference.code is the fallback id')
})

test('conceptForMapping: bridge_child includes bridge_concept summary', () => {
  const bridgeDef = {
    reference: { url: 'https://CIELterminology.org', code: 'CIEL_12345' },
    id: 'CIEL_12345',
    display_name: 'Blood glucose measurement',
    ocl_url: '/orgs/CIEL/sources/CIEL/concepts/CIEL_12345/',
    source: 'CIEL'
  }
  const out = conceptForMapping({
    candidate: { algorithm_id: 'ocl-bridge', map_type: 'SAME-AS' },
    conceptDefinition: sampleDef,
    conceptRow: { rerank_score: 87 },
    bridgeConceptDefinition: bridgeDef
  })
  assert.ok(out.bridge_concept)
  assert.equal(out.bridge_concept.id, 'CIEL_12345')
  assert.equal(out.bridge_concept.display_name, 'Blood glucose measurement')
  assert.equal(out.bridge_concept.source, 'CIEL')
  assert.equal(out.search_meta.map_type, 'SAME-AS')
})

test('conceptForMapping: search_meta carries algorithm_id even when no scores', () => {
  const out = conceptForMapping({
    candidate: { algorithm_id: 'ocl-bridge' },
    conceptDefinition: sampleDef,
    conceptRow: {}
  })
  assert.equal(out.search_meta.algorithm, 'ocl-bridge')
  assert.equal(out.search_meta.search_score, undefined)
})

// ---------- resolveAICandidateID ----------

test('resolveAICandidateID: null candidate returns null', () => {
  assert.equal(resolveAICandidateID(null, {}), null)
})

test('resolveAICandidateID: concept_key resolves via conceptCache (preferred)', () => {
  const cache = {
    k1: { reference: { url: 'http://loinc.org', code: '49494-3' } }
  }
  const candidate = {
    concept_key: 'k1',
    canonical_reference: { code: 'WRONG' },  // should be ignored when concept_key works
    concept_id: 'ALSO-WRONG'
  }
  assert.equal(resolveAICandidateID(candidate, cache), '49494-3')
})

test('resolveAICandidateID: falls back to canonical_reference.code when concept_key is absent (PR2a shim)', () => {
  const cache = {}
  const candidate = { canonical_reference: { code: '49494-3' }, concept_id: 'LEGACY' }
  assert.equal(resolveAICandidateID(candidate, cache), '49494-3')
})

test('resolveAICandidateID: falls back to concept_id when v2 fields are absent (legacy v1)', () => {
  const candidate = { concept_id: '49494-3' }
  assert.equal(resolveAICandidateID(candidate, {}), '49494-3')
})

test('resolveAICandidateID: falls back to id when concept_id absent', () => {
  const candidate = { id: '49494-3' }
  assert.equal(resolveAICandidateID(candidate, {}), '49494-3')
})

test('resolveAICandidateID: concept_key present but not in cache falls through to canonical_reference', () => {
  // If the AI returns a concept_key the client doesn't know (e.g. cache
  // hasn't loaded yet, or there's a mismatch), fall through gracefully.
  const candidate = { concept_key: 'missing', canonical_reference: { code: 'FALLBACK' } }
  assert.equal(resolveAICandidateID(candidate, {}), 'FALLBACK')
})

test('resolveAICandidateID: completely unidentified candidate returns null', () => {
  assert.equal(resolveAICandidateID({}, {}), null)
})
