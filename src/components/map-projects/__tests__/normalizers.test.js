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
  normalizeAlgorithmInvocation,
  filterPropertyBySummary
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

test('ConceptRow picks up search_normalized_score as rerank_score (single-algo reranker:true path)', () => {
  const out = normalizeAlgoResult(oclSearchResult_LOINC_glucose_full, {
    algorithmId: 'ocl-search',
    algorithmConfig: oclSearchAlgo,
    algorithmResponseId: 'ar-1',
    projectContext,
    // The caller must opt in: only trust the server's normalized score when
    // it was produced by reranker:true (single-algo native OCL path).
    trustServerRerank: true
  })
  const [row] = out.concept_rows
  assert.equal(row.concept_key, out.concept_definitions[0].key)
  // The fixture has search_normalized_score=85 (set by $match's
  // reranker:true). The normalizer carries that onto the ConceptRow so no
  // separate $rerank round-trip is needed for the single-algo OCL path.
  assert.equal(row.rerank_score, 85)
})

test('ConceptRow.rerank_score ignored when the caller did not opt in (multi-algo path)', () => {
  // OCL $match emits search_normalized_score unconditionally — for top
  // FAISS hits the value is ~100. Without the trustServerRerank opt-in
  // (multi-algo, bridge, scispacy, custom paths) the normalizer must NOT
  // propagate it: the value isn't a unified rerank score, just a per-algo
  // native score, and treating it as rerank produces a misleading "100%"
  // chip until the debounced $rerank/ pass runs.
  const out = normalizeAlgoResult(oclSearchResult_LOINC_glucose_full, {
    algorithmId: 'ocl-search',
    algorithmConfig: oclSearchAlgo,
    algorithmResponseId: 'ar-multi',
    projectContext
    // trustServerRerank omitted — defaults to falsy
  })
  assert.equal(out.concept_rows[0].rerank_score, undefined,
    'response had search_normalized_score=85 but caller did not opt in → ignored')
})

test('ConceptRow.rerank_score is undefined when the algorithm did not provide search_normalized_score', () => {
  const noScoreResult = {
    ...oclSearchResult_LOINC_glucose_full,
    search_meta: { ...oclSearchResult_LOINC_glucose_full.search_meta, search_normalized_score: undefined }
  }
  const out = normalizeAlgoResult(noScoreResult, {
    algorithmId: 'ocl-search',
    algorithmConfig: oclSearchAlgo,
    algorithmResponseId: 'ar-1b',
    projectContext,
    trustServerRerank: true
  })
  assert.equal(out.concept_rows[0].rerank_score, undefined)
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

// ---------- normalizeAlgoResult: schema-specific property capture ----------

test('verbose response (with `property` array) → ConceptDefinition captures it and lookup_status=full', () => {
  // OCL ConceptDetailSerializer (?verbose=true on $match) emits `property`
  // sourced from the model's `properties` getter — schema-specific dict for
  // sources like LOINC: [{code: 'COMPONENT', valueString: 'X'}, ...]. The
  // UI's ConceptSummaryProperties reads `concept.property` directly.
  const verboseResult = {
    id: '49494-3',
    display_name: 'Glucose [Mass/volume] in Blood',
    url: '/orgs/Regenstrief/sources/LOINC/concepts/49494-3/',
    source: 'LOINC',
    names: [{ name: 'Glucose [Mass/volume] in Blood', locale: 'en', preferred: true }],
    // no descriptions — many LOINC concepts have none
    property: [
      { code: 'COMPONENT', valueString: 'Glucose' },
      { code: 'PROPERTY', valueString: 'MCnc' },
      { code: 'TIME_ASPCT', valueString: 'Pt' }
    ],
    extras: { LOINC_NUM: '49494-3' },
    search_meta: { search_score: 0.85, algorithm: 'ocl-semantic' }
  }
  const out = normalizeAlgoResult(verboseResult, {
    algorithmId: 'ocl-semantic',
    algorithmConfig: oclSemanticAlgo,
    algorithmResponseId: 'ar-verbose',
    projectContext
  })
  const [def] = out.concept_definitions
  assert.equal(def.lookup_status, 'full',
    'response carries `property` array → full, even without descriptions')
  assert.equal(def.property.length, 3, 'property array survives normalization')
  assert.equal(def.property[0].code, 'COMPONENT')
  assert.deepEqual(def.extras, { LOINC_NUM: '49494-3' }, 'extras survives normalization')
})

test('verbose response with empty `property` array still promotes to lookup_status=full', () => {
  // A source with no schema-property definitions returns `property: []`.
  // We still have full payload data — ensureLoaded shouldn't refetch.
  const result = {
    id: 'X-1',
    display_name: 'No-Schema Concept',
    url: '/orgs/Test/sources/Plain/concepts/X-1/',
    source: 'Plain',
    property: [],
    search_meta: { search_score: 0.7, algorithm: 'ocl-search' }
  }
  const out = normalizeAlgoResult(result, {
    algorithmId: 'ocl-search',
    algorithmConfig: oclSearchAlgo,
    algorithmResponseId: 'ar-verbose-empty',
    projectContext
  })
  assert.equal(out.concept_definitions[0].lookup_status, 'full',
    'verbose payload marker is property field presence, not its length')
})

test('brief response (no `property`, no `names`) stays at lookup_status=partial', () => {
  // ConceptMinimalSerializer omits `property` entirely. We have id +
  // display_name but no schema data — ensureLoaded should fire.
  const briefResult = {
    id: '49494-3',
    display_name: 'Glucose [Mass/volume] in Blood',
    url: '/orgs/Regenstrief/sources/LOINC/concepts/49494-3/',
    source: 'LOINC',
    // no property, no names, no descriptions
    search_meta: { search_score: 0.85, algorithm: 'ocl-search' }
  }
  const out = normalizeAlgoResult(briefResult, {
    algorithmId: 'ocl-search',
    algorithmConfig: oclSearchAlgo,
    algorithmResponseId: 'ar-brief',
    projectContext
  })
  assert.equal(out.concept_definitions[0].lookup_status, 'partial',
    'no verbose-payload marker, no names → still partial → ensureLoaded eligible')
  assert.equal(out.concept_definitions[0].property, undefined,
    'no property in response → field stays undefined on the ConceptDefinition')
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
    // No trustServerRerank — bridge scores are unreliable as unified rerank
    // (the bridge endpoint scores intermediaries against a vector index that
    // doesn't speak the project's query semantics). Client-side $rerank/
    // fills both ConceptRows once they're eligible.
  })

  assert.equal(out.concept_rows.length, 2)
  // Bridge intermediary's row stays unscored: even though the response
  // carries search_normalized_score, the bridge path doesn't opt into
  // trustServerRerank so it's ignored. Cascade target was already unscored
  // (bridge response doesn't score cascade targets at all). Both fill in
  // when $rerank/ lands.
  const bridgeRow = out.concept_rows.find(r => r.concept_key === out.concept_definitions.find(d => d.reference.url === 'https://CIELterminology.org').key)
  const targetRow = out.concept_rows.find(r => r.concept_key === out.concept_definitions.find(d => d.reference.url === 'http://loinc.org').key)
  assert.equal(bridgeRow.rerank_score, undefined)
  assert.equal(targetRow.rerank_score, undefined)
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

// ---------- target_repo version alignment across algorithm paths (#2520) ----------
//
// A mapping project pins to ONE explicit target_repo version. Concept identity
// for dedup must be anchored to that pin across ALL algorithm paths that hit
// the same target repo:
//   - target_repo reference_source (ocl-search, ocl-semantic) — inherits pin via projectContext
//   - bridge_repo cascade_target (ocl-bridge cascade hits) — inherits pin via the cascade's target_repo branch
//   - fixed reference_source (ocl-scispacy) whose canonical_url matches the project's target_repo
//     — must also inherit the pin so it dedups with the other paths
//
// Without the fixed-branch inheritance, scispacy LOINC produced concept_keys
// with `version: null` while every other path keyed on the project's pin
// (e.g. "2.81"), splitting the same logical concept into separate
// recommendable_concepts entries with split evidence in the v2 LLM payload.

test('fixed-canonical algo whose URL matches target_repo inherits the project version pin', () => {
  const pinnedCtx = {
    ...projectContext,
    target_repo: { ...projectContext.target_repo, version: '2.81' }
  }
  const out = normalizeAlgoResult(scispacyResult_partial, {
    algorithmId: 'ocl-scispacy-loinc',
    algorithmConfig: oclScispacyAlgo,
    algorithmResponseId: 'ar-scispacy',
    projectContext: pinnedCtx
  })

  const def = out.concept_definitions.find(d => d.reference.code === '49494-3')
  assert.ok(def, 'scispacy ConceptDefinition was emitted')
  assert.equal(def.reference.version, '2.81',
    'fixed canonical matching target_repo must inherit the project version pin')
  assert.deepEqual(def.reference, { url: 'http://loinc.org', code: '49494-3', version: '2.81' })
})

test('all algorithm paths converge on the same concept_key under a pinned target_repo version', () => {
  // Released-version pin (the common case). Four paths hit the same LOINC
  // concept and must produce identical concept_keys for dedup to work:
  //   1. ocl-search direct  (target_repo)
  //   2. ocl-semantic direct (target_repo)
  //   3. ocl-bridge cascade target (target_repo via cascade)
  //   4. ocl-scispacy direct (fixed canonical matching target_repo)
  const pinnedCtx = {
    ...projectContext,
    target_repo: { ...projectContext.target_repo, version: '2.81' }
  }

  const searchOut = normalizeAlgoResult(oclSearchResult_LOINC_glucose_full, {
    algorithmId: 'ocl-search',
    algorithmConfig: oclSearchAlgo,
    algorithmResponseId: 'ar-search',
    projectContext: pinnedCtx
  })
  const semanticOut = normalizeAlgoResult(oclSemanticResult_LOINC_glucose_full, {
    algorithmId: 'ocl-semantic',
    algorithmConfig: oclSemanticAlgo,
    algorithmResponseId: 'ar-semantic',
    projectContext: pinnedCtx
  })
  const bridgeOut = normalizeAlgoResult(bridgeResult_CIEL_to_LOINC, {
    algorithmId: 'ocl-bridge',
    algorithmConfig: oclBridgeAlgo,
    algorithmResponseId: 'ar-bridge',
    projectContext: pinnedCtx
  })
  const scispacyOut = normalizeAlgoResult(scispacyResult_partial, {
    algorithmId: 'ocl-scispacy-loinc',
    algorithmConfig: oclScispacyAlgo,
    algorithmResponseId: 'ar-scispacy',
    projectContext: pinnedCtx
  })

  const expectedKey = makeConceptKey({ url: 'http://loinc.org', code: '49494-3', version: '2.81' })

  const searchDef = searchOut.concept_definitions.find(d => d.reference.code === '49494-3')
  const semanticDef = semanticOut.concept_definitions.find(d => d.reference.code === '49494-3')
  const bridgeCascadeDef = bridgeOut.concept_definitions.find(d => d.reference.code === '49494-3')
  const scispacyDef = scispacyOut.concept_definitions.find(d => d.reference.code === '49494-3')

  assert.ok(searchDef && semanticDef && bridgeCascadeDef && scispacyDef,
    'all four paths emit a ConceptDefinition for the target concept')
  assert.equal(searchDef.key, expectedKey, 'ocl-search keys on pinned version')
  assert.equal(semanticDef.key, expectedKey, 'ocl-semantic keys on pinned version')
  assert.equal(bridgeCascadeDef.key, expectedKey, 'ocl-bridge cascade target keys on pinned version')
  assert.equal(scispacyDef.key, expectedKey, 'ocl-scispacy keys on pinned version (fixed→target_repo alignment)')
})

test('all paths converge under HEAD pin too (degenerate but supported)', () => {
  // HEAD is an explicit, valid project pin — uncommon but allowed. The
  // alignment must hold whether the pin is a released version or HEAD.
  const headCtx = {
    ...projectContext,
    target_repo: { ...projectContext.target_repo, version: 'HEAD' }
  }
  const searchOut = normalizeAlgoResult(oclSearchResult_LOINC_glucose_full, {
    algorithmId: 'ocl-search',
    algorithmConfig: oclSearchAlgo,
    algorithmResponseId: 'ar-search',
    projectContext: headCtx
  })
  const bridgeOut = normalizeAlgoResult(bridgeResult_CIEL_to_LOINC, {
    algorithmId: 'ocl-bridge',
    algorithmConfig: oclBridgeAlgo,
    algorithmResponseId: 'ar-bridge',
    projectContext: headCtx
  })
  const scispacyOut = normalizeAlgoResult(scispacyResult_partial, {
    algorithmId: 'ocl-scispacy-loinc',
    algorithmConfig: oclScispacyAlgo,
    algorithmResponseId: 'ar-scispacy',
    projectContext: headCtx
  })
  const expectedKey = makeConceptKey({ url: 'http://loinc.org', code: '49494-3', version: 'HEAD' })

  assert.equal(searchOut.concept_definitions.find(d => d.reference.code === '49494-3').key, expectedKey)
  assert.equal(bridgeOut.concept_definitions.find(d => d.reference.code === '49494-3').key, expectedKey)
  assert.equal(scispacyOut.concept_definitions.find(d => d.reference.code === '49494-3').key, expectedKey)
})

test('fixed-canonical algo whose URL does NOT match target_repo does not inherit project version', () => {
  // Safety: the version-inheritance only applies when the fixed canonical
  // points at the same repo as target_repo. A fixed algo targeting a
  // different canonical (e.g. SNOMED while the project's target is LOINC)
  // must continue to produce version-less references — those concepts live
  // in a different repo entirely and have no relationship to the pin.
  const pinnedCtx = {
    ...projectContext,
    target_repo: { ...projectContext.target_repo, version: '2.81' }
  }
  const snomedAlgo = {
    id: 'custom-snomed',
    type: 'custom',
    concept_identity: {
      reference_source: 'fixed',
      canonical_url: 'http://snomed.info/sct',
      code_field: 'id'
    }
  }
  const snomedResult = {
    id: '12345678',
    display_name: 'Some SNOMED concept',
    search_meta: { search_score: 0.7, algorithm: 'custom-snomed' }
  }
  const out = normalizeAlgoResult(snomedResult, {
    algorithmId: 'custom-snomed',
    algorithmConfig: snomedAlgo,
    algorithmResponseId: 'ar-snomed',
    projectContext: pinnedCtx
  })

  const def = out.concept_definitions.find(d => d.reference.code === '12345678')
  assert.ok(def)
  assert.equal(def.reference.version, undefined,
    'fixed canonical pointing at a different repo than target_repo does NOT inherit the pin')
  assert.deepEqual(def.reference, { url: 'http://snomed.info/sct', code: '12345678' })
})

test('fixed-canonical algo with no target_repo.version on project (unpinned) still produces version-less key', () => {
  // Backward-compat: when the project's target_repo has no version field
  // (legacy projects or in-flight setup), the fixed-branch inheritance is a
  // no-op — scispacy continues to emit version-less references as before.
  // Once the form-level "version required" validation lands (separate
  // follow-up), this case stops occurring in production.
  const out = normalizeAlgoResult(scispacyResult_partial, {
    algorithmId: 'ocl-scispacy-loinc',
    algorithmConfig: oclScispacyAlgo,
    algorithmResponseId: 'ar-scispacy',
    projectContext  // no target_repo.version
  })
  const def = out.concept_definitions.find(d => d.reference.code === '49494-3')
  assert.ok(def)
  assert.equal(def.reference.version, undefined)
  assert.deepEqual(def.reference, { url: 'http://loinc.org', code: '49494-3' })
})

// ============================================================================
// filterPropertyBySummary — producer-side property filter for AI Assistant
// v2 payload. See unified-mapper-model.md (PR3-D1).
// ============================================================================

// Realistic LOINC property dict (subset). OCL emits this as an array of
// {code, value} pairs from ConceptDetailSerializer.property.
const loincProperty = [
  { code: 'COMPONENT', value: 'Glucose' },
  { code: 'PROPERTY', value: 'MCnc' },
  { code: 'TIME_ASPCT', value: 'Pt' },
  { code: 'SYSTEM', value: 'Ser/Plas' },
  { code: 'SCALE_TYP', value: 'Qn' },
  { code: 'METHOD', value: '' },
  { code: 'CLASS', value: 'CHEM' },
  { code: 'STATUS', value: 'ACTIVE' },
  { code: 'VersionLastChanged', value: '2.74' }
]

test('filterPropertyBySummary: passes property through when no summary codes configured', () => {
  assert.equal(filterPropertyBySummary(loincProperty, undefined), loincProperty)
  assert.equal(filterPropertyBySummary(loincProperty, null), loincProperty)
  assert.equal(filterPropertyBySummary(loincProperty, []), loincProperty)
})

test('filterPropertyBySummary: filters to the summary subset when configured', () => {
  const summary = ['COMPONENT', 'PROPERTY', 'TIME_ASPCT', 'SYSTEM', 'SCALE_TYP', 'METHOD']
  const out = filterPropertyBySummary(loincProperty, summary)
  assert.equal(out.length, 6)
  assert.deepEqual(out.map(p => p.code).sort(),
    ['COMPONENT', 'METHOD', 'PROPERTY', 'SCALE_TYP', 'SYSTEM', 'TIME_ASPCT'])
  // Identity-bearing chips are kept; bookkeeping fields (CLASS / STATUS /
  // VersionLastChanged) are dropped from the v2 prompt push.
  assert.ok(!out.some(p => p.code === 'CLASS'))
  assert.ok(!out.some(p => p.code === 'STATUS'))
})

test('filterPropertyBySummary: returns undefined when property is missing/empty', () => {
  assert.equal(filterPropertyBySummary(undefined, ['COMPONENT']), undefined)
  assert.equal(filterPropertyBySummary(null, ['COMPONENT']), undefined)
  assert.equal(filterPropertyBySummary([], ['COMPONENT']), undefined)
})

test('filterPropertyBySummary: filtered result drops entries whose code is not in the summary', () => {
  const summary = ['COMPONENT', 'SYSTEM']
  const out = filterPropertyBySummary(loincProperty, summary)
  assert.deepEqual(out, [
    { code: 'COMPONENT', value: 'Glucose' },
    { code: 'SYSTEM', value: 'Ser/Plas' }
  ])
})

test('filterPropertyBySummary: tolerates entries without a code field', () => {
  const property = [
    { code: 'COMPONENT', value: 'Glucose' },
    { value: 'orphan' },
    { code: undefined, value: 'still orphan' },
    { code: 'SYSTEM', value: 'Ser/Plas' }
  ]
  const out = filterPropertyBySummary(property, ['COMPONENT', 'SYSTEM'])
  assert.equal(out.length, 2)
  assert.deepEqual(out.map(p => p.code), ['COMPONENT', 'SYSTEM'])
})
