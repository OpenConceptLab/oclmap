/**
 * Unit tests for the normalizers module.
 *
 * Run with: npm test
 *
 * Fixtures here are synthesized from the response shapes documented in
 * plans/unified-mapper-model.md and observed in MapProject.jsx
 * (fromScispacyResultsToConcepts at line 2315; bridge handling at 1083-1097;
 * search_meta usage at Score.jsx:18-46).
 *
 * They should be replaced/refined against captured real responses during the
 * verification pass — see plans/unified-mapper-model.md "Verification Plan".
 */

import test from 'node:test'
import assert from 'node:assert/strict'

import {
  createAlgorithmResponse,
  normalizeAlgoResult,
  normalizeAlgorithmInvocation
} from '../normalizers.js'
import { makeConceptKey, parseConceptKey, referencesEqual } from '../conceptKey.js'

// ---------- Project context (shared across tests) ----------

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

// ---------- Algorithm configs (would live in algorithms.jsx) ----------

const oclSearchAlgo = {
  id: 'ocl-search',
  type: 'ocl-search',
  concept_identity: {
    reference_source: 'target_repo',
    code_field: 'id',
    ocl_url_field: 'url'
  }
}

const oclSemanticAlgo = {
  id: 'ocl-semantic',
  type: 'ocl-semantic',
  concept_identity: {
    reference_source: 'target_repo',
    code_field: 'id',
    ocl_url_field: 'url'
  }
}

const oclScispacyAlgo = {
  id: 'ocl-scispacy-loinc',
  type: 'ocl-scispacy',
  concept_identity: {
    reference_source: 'fixed',
    canonical_url: 'http://loinc.org',
    code_field: 'id'
    // no ocl_url_field — scispacy responses don't include it
  }
}

const oclBridgeAlgo = {
  id: 'ocl-bridge',
  type: 'ocl-bridge',
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

// ---------- Fixtures ----------

const oclSearchResult_LOINC_glucose_full = {
  id: '49494-3',
  display_name: 'Glucose [Mass/volume] in Blood',
  url: '/orgs/Regenstrief/sources/LOINC/concepts/49494-3/',
  source: 'LOINC',
  owner: 'Regenstrief',
  names: [
    { name: 'Glucose [Mass/volume] in Blood', locale: 'en', preferred: true }
  ],
  descriptions: [
    { description: 'Glucose mass per volume in blood', locale: 'en' }
  ],
  concept_class: 'LOINC',
  datatype: 'Numeric',
  retired: false,
  search_meta: {
    search_score: 0.85,
    search_normalized_score: 85,
    search_highlight: { name: ['<em>Glucose</em>'] },
    algorithm: 'ocl-search'
  }
}

const oclSemanticResult_LOINC_glucose_full = {
  ...oclSearchResult_LOINC_glucose_full,
  search_meta: {
    search_score: 0.91,
    search_normalized_score: 91,
    search_highlight: { synonyms: ['Glucose'] },
    algorithm: 'ocl-semantic'
  }
}

// scispacy results (post fromScispacyResultsToConcepts) — partial, NO url field
const scispacyResult_partial = {
  id: '49494-3',
  display_name: 'Glucose [Mass/volume] in Blood',
  source: 'LOINC',
  search_meta: {
    search_score: 0.78,
    search_normalized_score: 78,
    algorithm: 'ocl-scispacy-loinc'
  },
  extras: { LOINC_NUM: '49494-3', composite_score: 0.78 }
}

const bridgeResult_CIEL_to_LOINC = {
  id: 'CIEL_12345',
  display_name: 'Blood glucose measurement',
  url: '/orgs/CIEL/sources/CIEL/concepts/CIEL_12345/',
  source: 'CIEL',
  owner: 'CIEL',
  names: [{ name: 'Blood glucose measurement', locale: 'en', preferred: true }],
  search_meta: {
    search_score: 0.92,
    search_normalized_score: 92,
    search_highlight: { name: ['<em>blood glucose</em>'] },
    algorithm: 'ocl-bridge'
  },
  mappings: [
    {
      cascade_target_concept_code: '49494-3',
      cascade_target_concept_url: '/orgs/Regenstrief/sources/LOINC/concepts/49494-3/',
      cascade_target_concept_name: 'Glucose [Mass/volume] in Blood',
      cascade_target_source_name: 'LOINC',
      map_type: 'SAME-AS'
    }
  ]
}

const bridgeResult_multiTarget = {
  id: 'CIEL_99999',
  display_name: 'Hypertension',
  url: '/orgs/CIEL/sources/CIEL/concepts/CIEL_99999/',
  source: 'CIEL',
  owner: 'CIEL',
  search_meta: { search_score: 0.88, algorithm: 'ocl-bridge' },
  mappings: [
    {
      cascade_target_concept_code: 'I10',
      cascade_target_concept_url: '/orgs/WHO/sources/ICD-10/concepts/I10/',
      cascade_target_concept_name: 'Essential hypertension',
      cascade_target_source_name: 'ICD-10',
      map_type: 'SAME-AS'
    },
    {
      cascade_target_concept_code: '38341003',
      cascade_target_concept_url: '/orgs/IHTSDO/sources/SNOMED-CT/concepts/38341003/',
      cascade_target_concept_name: 'Hypertensive disorder',
      cascade_target_source_name: 'SNOMED-CT',
      map_type: 'NARROWER-THAN'
    }
  ]
}

// ---------- conceptKey helpers ----------

test('makeConceptKey + parseConceptKey roundtrip without version', () => {
  const ref = { url: 'http://loinc.org', code: '49494-3' }
  const key = makeConceptKey(ref)
  const back = parseConceptKey(key)
  assert.deepEqual(back, ref)
})

test('makeConceptKey + parseConceptKey roundtrip with version', () => {
  const ref = { url: 'http://loinc.org', code: '49494-3', version: '2.74' }
  const key = makeConceptKey(ref)
  const back = parseConceptKey(key)
  assert.deepEqual(back, ref)
})

test('makeConceptKey throws on missing url or code', () => {
  assert.throws(() => makeConceptKey({ url: 'x' }), TypeError)
  assert.throws(() => makeConceptKey({ code: 'x' }), TypeError)
  assert.throws(() => makeConceptKey(null), TypeError)
})

test('referencesEqual ignores undefined-vs-null version', () => {
  const a = { url: 'http://loinc.org', code: '49494-3' }
  const b = { url: 'http://loinc.org', code: '49494-3', version: undefined }
  assert.equal(referencesEqual(a, b), true)
})

test('two references with the same url+code produce the same key', () => {
  const a = { url: 'http://loinc.org', code: '49494-3' }
  const b = { url: 'http://loinc.org', code: '49494-3' }
  assert.equal(makeConceptKey(a), makeConceptKey(b))
})

// ---------- createAlgorithmResponse ----------

test('createAlgorithmResponse preserves raw response and stamps metadata', () => {
  const raw = { foo: 'bar' }
  const response = createAlgorithmResponse(raw, 'ocl-search', { rowIndex: 3 })

  assert.equal(response.algorithm_id, 'ocl-search')
  assert.equal(response.row_index, 3)
  assert.equal(response.status, 'success')
  assert.equal(response.raw, raw, 'raw should be preserved by reference')
  assert.match(response.id, /.+/)
  assert.match(response.received_at, /^\d{4}-\d{2}-\d{2}T/)
  assert.equal(response.error, undefined)
})

test('createAlgorithmResponse records error when status=failed', () => {
  const response = createAlgorithmResponse(null, 'ocl-bridge', {
    status: 'failed',
    error: 'Network timeout'
  })

  assert.equal(response.status, 'failed')
  assert.equal(response.error, 'Network timeout')
})

// ---------- normalizeAlgoResult: standard ----------

test('standard result produces 1 candidate + 1 ConceptDefinition + 1 ConceptRow', () => {
  const out = normalizeAlgoResult(oclSearchResult_LOINC_glucose_full, {
    algorithmId: 'ocl-search',
    algorithmConfig: oclSearchAlgo,
    algorithmResponseId: 'ar-1',
    projectContext
  })

  assert.equal(out.candidates.length, 1)
  assert.equal(out.concept_definitions.length, 1)
  assert.equal(out.concept_rows.length, 1)

  const [cand] = out.candidates
  assert.equal(cand.type, 'standard')
  assert.equal(cand.algorithm_id, 'ocl-search')
  assert.equal(cand.algorithm_response_id, 'ar-1')
  assert.equal(cand.score, 0.85)
  assert.deepEqual(cand.highlights, { name: ['<em>Glucose</em>'] })
  assert.equal(cand.bridge_concept_key, undefined)
  assert.equal(cand.parent_candidate_id, undefined)
})

test('standard ConceptDefinition has reference {url, code} from target_repo', () => {
  const out = normalizeAlgoResult(oclSearchResult_LOINC_glucose_full, {
    algorithmId: 'ocl-search',
    algorithmConfig: oclSearchAlgo,
    algorithmResponseId: 'ar-1',
    projectContext
  })
  const [def] = out.concept_definitions

  assert.deepEqual(def.reference, { url: 'http://loinc.org', code: '49494-3' })
  assert.equal(def.key, makeConceptKey(def.reference))
  assert.equal(def.ocl_url, '/orgs/Regenstrief/sources/LOINC/concepts/49494-3/')
  assert.equal(def.lookup_status, 'full')
  assert.equal(def.lookup_source_type, 'algorithm')
  assert.equal(def.lookup_source, 'ocl-search')
  assert.equal(def.display_name, 'Glucose [Mass/volume] in Blood')
})

test('Candidate.concept_key matches ConceptDefinition.key', () => {
  const out = normalizeAlgoResult(oclSearchResult_LOINC_glucose_full, {
    algorithmId: 'ocl-search',
    algorithmConfig: oclSearchAlgo,
    algorithmResponseId: 'ar-1',
    projectContext
  })
  assert.equal(out.candidates[0].concept_key, out.concept_definitions[0].key)
})

test('ConceptRow is created with rerank_score=undefined for the matched concept', () => {
  const out = normalizeAlgoResult(oclSearchResult_LOINC_glucose_full, {
    algorithmId: 'ocl-search',
    algorithmConfig: oclSearchAlgo,
    algorithmResponseId: 'ar-1',
    projectContext
  })
  const [row] = out.concept_rows
  assert.equal(row.concept_key, out.concept_definitions[0].key)
  assert.equal(row.rerank_score, undefined)
})

// ---------- normalizeAlgoResult: scispacy (no url, no ocl_url) ----------

test('scispacy result with fixed canonical produces a partial ConceptDefinition with no ocl_url', () => {
  const out = normalizeAlgoResult(scispacyResult_partial, {
    algorithmId: 'ocl-scispacy-loinc',
    algorithmConfig: oclScispacyAlgo,
    algorithmResponseId: 'ar-2',
    projectContext
  })

  assert.equal(out.candidates.length, 1)
  assert.equal(out.concept_definitions.length, 1)

  const [def] = out.concept_definitions
  assert.deepEqual(def.reference, { url: 'http://loinc.org', code: '49494-3' })
  assert.equal(def.ocl_url, undefined,
    'scispacy has no ocl_url field — must remain undefined until ensureLoaded fills it')
  assert.equal(def.lookup_status, 'partial',
    'has id+display_name but no names/descriptions => partial')
  assert.equal(def.lookup_source_type, 'algorithm')
  assert.equal(def.lookup_source, 'ocl-scispacy-loinc')
})

test('scispacy result merges with ocl-search result on the same canonical reference', () => {
  // Same code from both algos → identical reference → identical key → ONE ConceptRow,
  // TWO Candidates. Demonstrated via two separate invocations into the same row.
  const a = normalizeAlgorithmInvocation(
    { row: { __index: 0 }, results: [oclSearchResult_LOINC_glucose_full] },
    { algorithmId: 'ocl-search', algorithmConfig: oclSearchAlgo, projectContext, rowIndex: 0 }
  )
  const b = normalizeAlgorithmInvocation(
    { row: { __index: 0 }, results: [scispacyResult_partial] },
    { algorithmId: 'ocl-scispacy-loinc', algorithmConfig: oclScispacyAlgo, projectContext, rowIndex: 0 }
  )

  assert.equal(a.candidates[0].concept_key, b.candidates[0].concept_key,
    'same canonical reference => same key, regardless of algorithm')
})

// ---------- normalizeAlgoResult: missing data ----------

test('result without id (missing code field) returns empty entities', () => {
  const out = normalizeAlgoResult(
    { display_name: 'orphan' },
    { algorithmId: 'ocl-search', algorithmConfig: oclSearchAlgo, algorithmResponseId: 'ar', projectContext }
  )
  assert.equal(out.candidates.length, 0)
  assert.equal(out.concept_definitions.length, 0)
  assert.equal(out.concept_rows.length, 0)
})

test('null/undefined result returns empty entities', () => {
  assert.deepEqual(
    normalizeAlgoResult(null, { algorithmId: 'x', algorithmConfig: oclSearchAlgo, algorithmResponseId: 'y', projectContext }),
    { candidates: [], concept_definitions: [], concept_rows: [] }
  )
})

test('missing algorithmConfig returns empty entities', () => {
  const out = normalizeAlgoResult(oclSearchResult_LOINC_glucose_full, {
    algorithmId: 'ocl-search',
    algorithmResponseId: 'ar',
    projectContext
  })
  assert.equal(out.candidates.length, 0)
})

test('reference_source=target_repo with no target_repo in context returns empty', () => {
  const out = normalizeAlgoResult(oclSearchResult_LOINC_glucose_full, {
    algorithmId: 'ocl-search',
    algorithmConfig: oclSearchAlgo,
    algorithmResponseId: 'ar',
    projectContext: {} // no target_repo
  })
  assert.equal(out.candidates.length, 0,
    'cannot resolve identity without target_repo canonical_url')
})

// ---------- normalizeAlgoResult: bridge ----------

test('bridge result produces 1 bridge candidate + N bridge_child candidates', () => {
  const out = normalizeAlgoResult(bridgeResult_CIEL_to_LOINC, {
    algorithmId: 'ocl-bridge',
    algorithmConfig: oclBridgeAlgo,
    algorithmResponseId: 'ar-3',
    projectContext
  })

  assert.equal(out.candidates.length, 2)

  const bridge = out.candidates.find(c => c.type === 'bridge')
  const child = out.candidates.find(c => c.type === 'bridge_child')

  assert.ok(bridge && child)
  assert.equal(bridge.score, 0.92)
  assert.deepEqual(bridge.highlights, { name: ['<em>blood glucose</em>'] })

  assert.equal(child.parent_candidate_id, bridge.id)
  assert.equal(child.bridge_concept_key, bridge.concept_key)
  assert.equal(child.map_type, 'SAME-AS')
  assert.equal(child.score, undefined)
  assert.equal(child.highlights, undefined)
})

test('bridge result: bridge concept uses bridge_repo canonical, target uses target_repo canonical', () => {
  const out = normalizeAlgoResult(bridgeResult_CIEL_to_LOINC, {
    algorithmId: 'ocl-bridge',
    algorithmConfig: oclBridgeAlgo,
    algorithmResponseId: 'ar-3',
    projectContext
  })

  assert.equal(out.concept_definitions.length, 2)

  const bridgeDef = out.concept_definitions.find(d => d.reference.code === 'CIEL_12345')
  const targetDef = out.concept_definitions.find(d => d.reference.code === '49494-3')

  assert.deepEqual(bridgeDef.reference, {
    url: 'https://CIELterminology.org', code: 'CIEL_12345'
  })
  assert.equal(bridgeDef.ocl_url, '/orgs/CIEL/sources/CIEL/concepts/CIEL_12345/')
  assert.equal(bridgeDef.lookup_source_type, 'algorithm')
  assert.equal(bridgeDef.lookup_source, 'ocl-bridge')

  assert.deepEqual(targetDef.reference, {
    url: 'http://loinc.org', code: '49494-3'
  })
  assert.equal(targetDef.ocl_url, '/orgs/Regenstrief/sources/LOINC/concepts/49494-3/')
  assert.equal(targetDef.lookup_status, 'pending',
    'cascade target is a stub — must be enriched by ensureLoaded')
})

test('bridge result creates ConceptRows for BOTH intermediary and target', () => {
  const out = normalizeAlgoResult(bridgeResult_CIEL_to_LOINC, {
    algorithmId: 'ocl-bridge',
    algorithmConfig: oclBridgeAlgo,
    algorithmResponseId: 'ar-3',
    projectContext
  })

  assert.equal(out.concept_rows.length, 2)
  for (const row of out.concept_rows) {
    assert.equal(row.rerank_score, undefined)
  }
})

test('bridge result with multiple cascade targets fans out 1 + N candidates', () => {
  const out = normalizeAlgoResult(bridgeResult_multiTarget, {
    algorithmId: 'ocl-bridge',
    algorithmConfig: oclBridgeAlgo,
    algorithmResponseId: 'ar-4',
    projectContext
  })

  assert.equal(out.candidates.length, 3)
  assert.equal(out.candidates.filter(c => c.type === 'bridge').length, 1)
  assert.equal(out.candidates.filter(c => c.type === 'bridge_child').length, 2)
  assert.equal(out.concept_definitions.length, 3)
  assert.equal(out.concept_rows.length, 3)

  const bridge = out.candidates.find(c => c.type === 'bridge')
  for (const child of out.candidates.filter(c => c.type === 'bridge_child')) {
    assert.equal(child.parent_candidate_id, bridge.id)
    assert.equal(child.bridge_concept_key, bridge.concept_key)
  }

  // Note: cascade target canonicals are derived from project target_repo, NOT from the
  // cascade response's source_name. So both targets here land under the project's
  // target_repo canonical (http://loinc.org), not under ICD-10/SNOMED-CT canonicals.
  // Real multi-cascade-target scenarios would have a single target_repo at project setup.
  for (const def of out.concept_definitions.filter(d => d !== out.concept_definitions[0])) {
    assert.equal(def.reference.url, 'http://loinc.org')
  }
})

// ---------- normalizeAlgorithmInvocation ----------

test('invocation wraps a multi-result payload into one AlgorithmResponse + flat entities', () => {
  const payload = {
    row: { __index: 7 },
    results: [oclSearchResult_LOINC_glucose_full]
  }
  const out = normalizeAlgorithmInvocation(payload, {
    algorithmId: 'ocl-search',
    algorithmConfig: oclSearchAlgo,
    projectContext,
    rowIndex: 7
  })

  assert.equal(out.algorithm_response.algorithm_id, 'ocl-search')
  assert.equal(out.algorithm_response.row_index, 7)
  assert.equal(out.algorithm_response.status, 'success')
  assert.equal(out.candidates.length, 1)
  assert.equal(out.candidates[0].algorithm_response_id, out.algorithm_response.id,
    'candidate must FK to the response wrapper')
})

test('invocation deduplicates ConceptDefinitions by key within a payload', () => {
  // Realistic case: two bridge results in one invocation, both cascading to the
  // same LOINC target. The cascade target should appear once.
  const bridgeResultB_to_sameLOINC = {
    id: 'CIEL_88888',
    display_name: 'Serum glucose',
    url: '/orgs/CIEL/sources/CIEL/concepts/CIEL_88888/',
    source: 'CIEL',
    search_meta: { search_score: 0.81, algorithm: 'ocl-bridge' },
    mappings: [
      {
        cascade_target_concept_code: '49494-3',
        cascade_target_concept_url: '/orgs/Regenstrief/sources/LOINC/concepts/49494-3/',
        cascade_target_concept_name: 'Glucose [Mass/volume] in Blood',
        cascade_target_source_name: 'LOINC',
        map_type: 'SAME-AS'
      }
    ]
  }
  const payload = {
    row: { __index: 0 },
    results: [bridgeResult_CIEL_to_LOINC, bridgeResultB_to_sameLOINC]
  }
  const out = normalizeAlgorithmInvocation(payload, {
    algorithmId: 'ocl-bridge',
    algorithmConfig: oclBridgeAlgo,
    projectContext,
    rowIndex: 0
  })

  // 3 distinct keys: 2 bridge concepts (CIEL_12345, CIEL_88888) + 1 shared LOINC target.
  assert.equal(out.concept_definitions.length, 3)
  assert.equal(out.concept_rows.length, 3)

  // 4 candidates: 2 bridges + 2 bridge_children (one per cascade)
  assert.equal(out.candidates.length, 4)
  assert.equal(out.candidates.filter(c => c.type === 'bridge').length, 2)
  assert.equal(out.candidates.filter(c => c.type === 'bridge_child').length, 2)

  // Both bridge_children share the same target concept_key
  const children = out.candidates.filter(c => c.type === 'bridge_child')
  assert.equal(children[0].concept_key, children[1].concept_key,
    'both cascades to the same target should produce candidates with the same concept_key')
})

test('invocation with empty results still produces an AlgorithmResponse', () => {
  const out = normalizeAlgorithmInvocation({ row: { __index: 5 }, results: [] }, {
    algorithmId: 'ocl-semantic',
    algorithmConfig: oclSemanticAlgo,
    projectContext,
    rowIndex: 5
  })

  assert.equal(out.candidates.length, 0)
  assert.equal(out.concept_definitions.length, 0)
  assert.equal(out.concept_rows.length, 0)
  assert.equal(out.algorithm_response.algorithm_id, 'ocl-semantic')
  assert.equal(out.algorithm_response.status, 'success')
})

test('invocation with failure status records the error on AlgorithmResponse', () => {
  const out = normalizeAlgorithmInvocation(null, {
    algorithmId: 'ocl-search',
    algorithmConfig: oclSearchAlgo,
    projectContext,
    rowIndex: 2,
    status: 'failed',
    error: 'HTTP 500',
    rawResponse: { detail: 'HTTP 500' }
  })

  assert.equal(out.algorithm_response.status, 'failed')
  assert.equal(out.algorithm_response.error, 'HTTP 500')
  assert.deepEqual(out.algorithm_response.raw, { detail: 'HTTP 500' })
  assert.equal(out.candidates.length, 0)
})

// ---------- Multi-algo convergence ----------

test('multi-algo: same concept from ocl-search and ocl-semantic produces matching keys', () => {
  const a = normalizeAlgorithmInvocation(
    { row: { __index: 0 }, results: [oclSearchResult_LOINC_glucose_full] },
    { algorithmId: 'ocl-search', algorithmConfig: oclSearchAlgo, projectContext, rowIndex: 0 }
  )
  const b = normalizeAlgorithmInvocation(
    { row: { __index: 0 }, results: [oclSemanticResult_LOINC_glucose_full] },
    { algorithmId: 'ocl-semantic', algorithmConfig: oclSemanticAlgo, projectContext, rowIndex: 0 }
  )

  assert.equal(a.candidates[0].concept_key, b.candidates[0].concept_key)
  assert.equal(a.candidates[0].algorithm_id, 'ocl-search')
  assert.equal(b.candidates[0].algorithm_id, 'ocl-semantic')
  assert.equal(a.candidates[0].score, 0.85)
  assert.equal(b.candidates[0].score, 0.91)
})
