/**
 * Unit tests for the unified-model view builders exported by Candidates.jsx.
 *
 * These exercise the read-flip plumbing the UNIFIED_MODEL_ENABLED flag now
 * depends on: turning a RowState + conceptCache into the algorithm-grouped
 * and quality-grouped row views Candidates renders.
 *
 * Bridge fan-out at the view layer is tested here because the live bridge
 * algorithm only attaches in production builds (PRIVATE_PACKAGES_GIT) and
 * cannot be exercised locally. The data shape is the same in both cases.
 *
 * Run with: npm test
 */

import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildAlgorithmRowViews,
  buildQualityRowViews,
  candidateToRowView,
  conceptForMapping,
  sortRowViews
} from '../viewBuilders.js'

// ---------- Helpers ----------

const KEY_LOINC_GLUCOSE = JSON.stringify(['http://loinc.org', '49494-3', null])
const KEY_LOINC_CHOL    = JSON.stringify(['http://loinc.org', '2093-3', null])
const KEY_CIEL_BRIDGE   = JSON.stringify(['https://CIELterminology.org', 'CIEL_12345', null])
const KEY_CIEL_TARGET_VERSIONED = JSON.stringify(['https://CIELterminology.org', 'CIEL_12345', 'HEAD'])
const KEY_SNOMED_BRIDGE = JSON.stringify(['http://snomed.info/sct', '74521008', null])

const defLOINCGlucose = {
  reference: { url: 'http://loinc.org', code: '49494-3' },
  key: KEY_LOINC_GLUCOSE,
  ocl_url: '/orgs/Regenstrief/sources/LOINC/concepts/49494-3/',
  id: '49494-3',
  display_name: 'Glucose [Mass/volume] in Blood',
  source: 'LOINC',
  owner: 'Regenstrief',
  retired: false,
  lookup_status: 'full',
  lookup_source_type: 'algorithm',
  lookup_source: 'ocl-search'
}

const defLOINCChol = {
  reference: { url: 'http://loinc.org', code: '2093-3' },
  key: KEY_LOINC_CHOL,
  ocl_url: '/orgs/Regenstrief/sources/LOINC/concepts/2093-3/',
  id: '2093-3',
  display_name: 'Cholesterol in Serum or Plasma',
  source: 'LOINC',
  owner: 'Regenstrief',
  retired: false,
  lookup_status: 'full',
  lookup_source_type: 'algorithm',
  lookup_source: 'ocl-search'
}

const defCIELBridge = {
  reference: { url: 'https://CIELterminology.org', code: 'CIEL_12345' },
  key: KEY_CIEL_BRIDGE,
  ocl_url: '/orgs/CIEL/sources/CIEL/concepts/CIEL_12345/',
  id: 'CIEL_12345',
  display_name: 'Blood glucose measurement',
  source: 'CIEL',
  owner: 'CIEL',
  retired: false,
  lookup_status: 'full',
  lookup_source_type: 'algorithm',
  lookup_source: 'ocl-bridge'
}

const defCIELTargetVersioned = {
  reference: { url: 'https://CIELterminology.org', code: 'CIEL_12345', version: 'HEAD' },
  key: KEY_CIEL_TARGET_VERSIONED,
  ocl_url: '/orgs/CIEL/sources/CIEL/concepts/CIEL_12345/',
  id: 'CIEL_12345',
  display_name: 'Blood glucose measurement',
  source: 'CIEL',
  owner: 'CIEL',
  retired: false,
  lookup_status: 'full',
  lookup_source_type: 'algorithm',
  lookup_source: 'ocl-semantic'
}

const defSnomedBridge = {
  reference: { url: 'http://snomed.info/sct', code: '74521008' },
  key: KEY_SNOMED_BRIDGE,
  ocl_url: '/orgs/IHTSDO/sources/SNOMED-CT/concepts/74521008/',
  id: '74521008',
  display_name: 'Blood glucose level',
  source: 'SNOMED-CT',
  owner: 'IHTSDO',
  retired: false,
  lookup_status: 'partial',
  lookup_source_type: 'algorithm',
  lookup_source: 'ocl-bridge'
}

// ---------- candidateToRowView ----------

test('candidateToRowView returns null when concept_key is not in cache', () => {
  const rv = candidateToRowView(
    { id: 'c1', algorithm_id: 'ocl-search', concept_key: 'missing', type: 'standard' },
    {},
    { concept_rows: {} }
  )
  assert.equal(rv, null)
})

test('candidateToRowView joins a standard candidate with its definition and row', () => {
  const cache = { [KEY_LOINC_GLUCOSE]: defLOINCGlucose }
  const rowState = {
    concept_rows: { [KEY_LOINC_GLUCOSE]: { concept_key: KEY_LOINC_GLUCOSE, rerank_score: 87 } }
  }
  const candidate = { id: 'c1', algorithm_id: 'ocl-search', concept_key: KEY_LOINC_GLUCOSE, type: 'standard', score: 0.85 }
  const rv = candidateToRowView(candidate, cache, rowState)
  assert.equal(rv.type, 'standard')
  assert.equal(rv.candidate, candidate)
  assert.equal(rv.conceptDefinition, defLOINCGlucose)
  assert.equal(rv.conceptRow.rerank_score, 87)
  assert.equal(rv.bridgeConceptDefinition, undefined)
})

test('candidateToRowView attaches bridgeConceptDefinition for bridge_child', () => {
  const cache = { [KEY_LOINC_GLUCOSE]: defLOINCGlucose, [KEY_CIEL_BRIDGE]: defCIELBridge }
  const rowState = { concept_rows: {} }
  const child = {
    id: 'c2',
    algorithm_id: 'ocl-bridge',
    concept_key: KEY_LOINC_GLUCOSE,
    type: 'bridge_child',
    bridge_concept_key: KEY_CIEL_BRIDGE,
    parent_candidate_id: 'c1',
    map_type: 'SAME-AS'
  }
  const rv = candidateToRowView(child, cache, rowState)
  assert.equal(rv.bridgeConceptDefinition, defCIELBridge)
})

test('candidateToRowView returns null for null candidate', () => {
  assert.equal(candidateToRowView(null, {}, {}), null)
})

// ---------- buildAlgorithmRowViews ----------

test('buildAlgorithmRowViews returns empty array when rowState is null', () => {
  assert.deepEqual(buildAlgorithmRowViews(null, {}, 'ocl-search'), [])
})

test('buildAlgorithmRowViews filters by algorithm_id and excludes bridge_child at top level', () => {
  const cache = {
    [KEY_LOINC_GLUCOSE]: defLOINCGlucose,
    [KEY_CIEL_BRIDGE]: defCIELBridge
  }
  const rowState = {
    candidates: {
      c1: { id: 'c1', algorithm_id: 'ocl-search', concept_key: KEY_LOINC_GLUCOSE, type: 'standard', score: 0.85 },
      c2: { id: 'c2', algorithm_id: 'ocl-bridge', concept_key: KEY_CIEL_BRIDGE, type: 'bridge', score: 0.92 },
      c3: { id: 'c3', algorithm_id: 'ocl-bridge', concept_key: KEY_LOINC_GLUCOSE, type: 'bridge_child', parent_candidate_id: 'c2', bridge_concept_key: KEY_CIEL_BRIDGE, map_type: 'SAME-AS' }
    },
    concept_rows: {}
  }
  const searchViews = buildAlgorithmRowViews(rowState, cache, 'ocl-search')
  assert.equal(searchViews.length, 1)
  assert.equal(searchViews[0].candidate.id, 'c1')

  const bridgeViews = buildAlgorithmRowViews(rowState, cache, 'ocl-bridge')
  // bridge_child does NOT appear at top level — it's nested under the bridge
  assert.equal(bridgeViews.length, 1)
  assert.equal(bridgeViews[0].type, 'bridge')
  assert.equal(bridgeViews[0].bridgeChildren.length, 1)
  assert.equal(bridgeViews[0].bridgeChildren[0].candidate.id, 'c3')
})

test('buildAlgorithmRowViews: bridge with multiple cascade targets fans out 1 + N children', () => {
  const KEY_LOINC_A = JSON.stringify(['http://loinc.org', 'A-1', null])
  const KEY_LOINC_B = JSON.stringify(['http://loinc.org', 'B-2', null])
  const cache = {
    [KEY_CIEL_BRIDGE]: defCIELBridge,
    [KEY_LOINC_A]: { ...defLOINCGlucose, key: KEY_LOINC_A, id: 'A-1', reference: {url: 'http://loinc.org', code: 'A-1'} },
    [KEY_LOINC_B]: { ...defLOINCGlucose, key: KEY_LOINC_B, id: 'B-2', reference: {url: 'http://loinc.org', code: 'B-2'} }
  }
  const rowState = {
    candidates: {
      bridge1: { id: 'bridge1', algorithm_id: 'ocl-bridge', concept_key: KEY_CIEL_BRIDGE, type: 'bridge', score: 0.91 },
      childA: { id: 'childA', algorithm_id: 'ocl-bridge', concept_key: KEY_LOINC_A, type: 'bridge_child', parent_candidate_id: 'bridge1', bridge_concept_key: KEY_CIEL_BRIDGE, map_type: 'SAME-AS' },
      childB: { id: 'childB', algorithm_id: 'ocl-bridge', concept_key: KEY_LOINC_B, type: 'bridge_child', parent_candidate_id: 'bridge1', bridge_concept_key: KEY_CIEL_BRIDGE, map_type: 'NARROWER-THAN' }
    },
    concept_rows: {}
  }
  const views = buildAlgorithmRowViews(rowState, cache, 'ocl-bridge')
  assert.equal(views.length, 1)
  assert.equal(views[0].bridgeChildren.length, 2)
  assert.deepEqual(
    views[0].bridgeChildren.map(c => c.candidate.map_type).sort(),
    ['NARROWER-THAN', 'SAME-AS']
  )
})

test('buildAlgorithmRowViews skips candidates whose ConceptDefinition is missing from cache', () => {
  const rowState = {
    candidates: {
      c1: { id: 'c1', algorithm_id: 'ocl-search', concept_key: 'orphan', type: 'standard', score: 0.5 }
    },
    concept_rows: {}
  }
  assert.deepEqual(buildAlgorithmRowViews(rowState, {}, 'ocl-search'), [])
})

// ---------- buildQualityRowViews ----------

test('buildQualityRowViews returns empty array when rowState is null', () => {
  assert.deepEqual(buildQualityRowViews(null, {}), [])
})

test('buildQualityRowViews returns one entry per ConceptRow', () => {
  const cache = { [KEY_LOINC_GLUCOSE]: defLOINCGlucose, [KEY_LOINC_CHOL]: defLOINCChol }
  const rowState = {
    candidates: {
      c1: { id: 'c1', algorithm_id: 'ocl-search', concept_key: KEY_LOINC_GLUCOSE, type: 'standard', score: 0.85 },
      c2: { id: 'c2', algorithm_id: 'ocl-search', concept_key: KEY_LOINC_CHOL, type: 'standard', score: 0.6 }
    },
    concept_rows: {
      [KEY_LOINC_GLUCOSE]: { concept_key: KEY_LOINC_GLUCOSE, rerank_score: 87 },
      [KEY_LOINC_CHOL]: { concept_key: KEY_LOINC_CHOL, rerank_score: 55 }
    }
  }
  const views = buildQualityRowViews(rowState, cache)
  assert.equal(views.length, 2)
})

test('buildQualityRowViews dedupes multi-algo convergence (one ConceptRow, multiple contributing candidates)', () => {
  // Both ocl-search and ocl-semantic returned LOINC glucose — should appear
  // ONCE in quality view with both candidates surfaced as contributingCandidates.
  const cache = { [KEY_LOINC_GLUCOSE]: defLOINCGlucose }
  const rowState = {
    candidates: {
      c1: { id: 'c1', algorithm_id: 'ocl-search',   concept_key: KEY_LOINC_GLUCOSE, type: 'standard', score: 0.85 },
      c2: { id: 'c2', algorithm_id: 'ocl-semantic', concept_key: KEY_LOINC_GLUCOSE, type: 'standard', score: 0.78 }
    },
    concept_rows: {
      [KEY_LOINC_GLUCOSE]: { concept_key: KEY_LOINC_GLUCOSE, rerank_score: 87 }
    }
  }
  const views = buildQualityRowViews(rowState, cache)
  assert.equal(views.length, 1)
  assert.equal(views[0].contributingCandidates.length, 2)
  assert.deepEqual(
    views[0].contributingCandidates.map(c => c.algorithm_id).sort(),
    ['ocl-search', 'ocl-semantic']
  )
  assert.deepEqual(
    views[0].contributingAlgorithmIds.sort(),
    ['ocl-search', 'ocl-semantic']
  )
  // Primary is the highest-scoring standard candidate (ocl-search at 0.85),
  // not whichever shows up first in Object.values() iteration order. Without
  // the score-desc sort the choice depended on insertion order and the UI's
  // "primary algorithm" chip flipped between renders.
  assert.equal(views[0].candidate.id, 'c1')
  assert.equal(views[0].candidate.algorithm_id, 'ocl-search')
})

test('buildQualityRowViews: multi-algo convergence — primary is the higher-scoring standard candidate regardless of insertion order', () => {
  // Same as the dedup test, but with the lower-scoring candidate inserted
  // FIRST. Pre-fix, find() returned whichever came first; post-fix, the
  // score-desc sort picks ocl-semantic (0.92) over ocl-search (0.71).
  const cache = { [KEY_LOINC_GLUCOSE]: defLOINCGlucose }
  const rowState = {
    candidates: {
      c1: { id: 'c1', algorithm_id: 'ocl-search',   concept_key: KEY_LOINC_GLUCOSE, type: 'standard', score: 0.71 },
      c2: { id: 'c2', algorithm_id: 'ocl-semantic', concept_key: KEY_LOINC_GLUCOSE, type: 'standard', score: 0.92 }
    },
    concept_rows: {
      [KEY_LOINC_GLUCOSE]: { concept_key: KEY_LOINC_GLUCOSE, rerank_score: 87 }
    }
  }
  const views = buildQualityRowViews(rowState, cache)
  assert.equal(views[0].candidate.algorithm_id, 'ocl-semantic')
})

test('buildQualityRowViews: bridge cascade target converges with direct match into ONE ConceptRow', () => {
  // The same LOINC concept is reached via ocl-search (direct) AND via
  // ocl-bridge (cascade). Quality view shows it once with both candidates
  // contributing. (Multi-source convergence — spec section "Multi-source
  // convergence".)
  const cache = {
    [KEY_LOINC_GLUCOSE]: defLOINCGlucose,
    [KEY_CIEL_BRIDGE]: defCIELBridge
  }
  const rowState = {
    candidates: {
      direct: { id: 'direct', algorithm_id: 'ocl-search', concept_key: KEY_LOINC_GLUCOSE, type: 'standard', score: 0.85 },
      bridge: { id: 'bridge', algorithm_id: 'ocl-bridge', concept_key: KEY_CIEL_BRIDGE, type: 'bridge', score: 0.92 },
      child:  { id: 'child', algorithm_id: 'ocl-bridge', concept_key: KEY_LOINC_GLUCOSE, type: 'bridge_child', parent_candidate_id: 'bridge', bridge_concept_key: KEY_CIEL_BRIDGE, map_type: 'SAME-AS' }
    },
    concept_rows: {
      [KEY_LOINC_GLUCOSE]: { concept_key: KEY_LOINC_GLUCOSE, rerank_score: 88 },
      [KEY_CIEL_BRIDGE]:   { concept_key: KEY_CIEL_BRIDGE,   rerank_score: 91 }
    }
  }
  const views = buildQualityRowViews(rowState, cache)
  assert.equal(views.length, 2)

  const loincView = views.find(v => v.conceptDefinition.key === KEY_LOINC_GLUCOSE)
  // The LOINC target should prefer the 'standard' candidate as primary
  // (per the spec: a direct hit is the user-facing primary)
  assert.equal(loincView.type, 'standard')
  assert.equal(loincView.candidate.id, 'direct')
  // But the bridge_child also contributes
  assert.equal(loincView.contributingCandidates.length, 2)

  const bridgeView = views.find(v => v.conceptDefinition.key === KEY_CIEL_BRIDGE)
  assert.ok(bridgeView, 'bridge intermediary surfaces as its own row in quality view')
})

test('buildQualityRowViews: ConceptRow without any candidate is excluded', () => {
  const cache = { [KEY_LOINC_GLUCOSE]: defLOINCGlucose }
  const rowState = {
    candidates: {},
    concept_rows: {
      [KEY_LOINC_GLUCOSE]: { concept_key: KEY_LOINC_GLUCOSE, rerank_score: 50 }
    }
  }
  assert.deepEqual(buildQualityRowViews(rowState, cache), [])
})

test('buildQualityRowViews: bridge_child becomes the primary when no standard candidate exists', () => {
  // If the LOINC concept is reached ONLY via bridge (no direct ocl-search
  // hit), the bridge_child becomes the primary candidate for that
  // ConceptRow. Its type is 'bridge_child' so Concept.jsx renders the
  // map_type chip and bridge prefix.
  const cache = { [KEY_LOINC_GLUCOSE]: defLOINCGlucose, [KEY_CIEL_BRIDGE]: defCIELBridge }
  const rowState = {
    candidates: {
      bridge: { id: 'bridge', algorithm_id: 'ocl-bridge', concept_key: KEY_CIEL_BRIDGE, type: 'bridge', score: 0.92 },
      child:  { id: 'child',  algorithm_id: 'ocl-bridge', concept_key: KEY_LOINC_GLUCOSE, type: 'bridge_child', parent_candidate_id: 'bridge', bridge_concept_key: KEY_CIEL_BRIDGE, map_type: 'SAME-AS' }
    },
    concept_rows: {
      [KEY_LOINC_GLUCOSE]: { concept_key: KEY_LOINC_GLUCOSE, rerank_score: 84 },
      [KEY_CIEL_BRIDGE]:   { concept_key: KEY_CIEL_BRIDGE,   rerank_score: 91 }
    }
  }
  const views = buildQualityRowViews(rowState, cache)
  const loincView = views.find(v => v.conceptDefinition.key === KEY_LOINC_GLUCOSE)
  assert.equal(loincView.type, 'bridge_child')
  assert.equal(loincView.bridgeConceptDefinition, defCIELBridge)
})

test('buildQualityRowViews: convergence — bridgeContributors lists non-primary bridge candidates', () => {
  // When a target is reached by BOTH a standard algo (primary) AND a bridge,
  // the rowView carries a bridgeContributors entry so the UI can render an
  // [i] indicator next to the algo chip with bridge intermediary + map_type.
  const cache = {
    [KEY_LOINC_GLUCOSE]: defLOINCGlucose,
    [KEY_CIEL_BRIDGE]: defCIELBridge
  }
  const rowState = {
    candidates: {
      direct: { id: 'direct', algorithm_id: 'ocl-search', concept_key: KEY_LOINC_GLUCOSE, type: 'standard', score: 0.85 },
      bridge: { id: 'bridge', algorithm_id: 'ocl-ciel-bridge', concept_key: KEY_CIEL_BRIDGE, type: 'bridge', score: 0.92 },
      child:  { id: 'child', algorithm_id: 'ocl-ciel-bridge', concept_key: KEY_LOINC_GLUCOSE, type: 'bridge_child', parent_candidate_id: 'bridge', bridge_concept_key: KEY_CIEL_BRIDGE, map_type: 'SAME-AS' }
    },
    concept_rows: {
      [KEY_LOINC_GLUCOSE]: { concept_key: KEY_LOINC_GLUCOSE, rerank_score: 88 },
      [KEY_CIEL_BRIDGE]:   { concept_key: KEY_CIEL_BRIDGE,   rerank_score: 91 }
    }
  }
  const views = buildQualityRowViews(rowState, cache)
  const loincView = views.find(v => v.conceptDefinition.key === KEY_LOINC_GLUCOSE)
  assert.equal(loincView.type, 'standard')
  assert.equal(loincView.bridgeContributors.length, 1)
  assert.equal(loincView.bridgeContributors[0].bridgeConceptDefinition, defCIELBridge)
  assert.equal(loincView.bridgeContributors[0].map_type, 'SAME-AS')
  assert.equal(loincView.bridgeContributors[0].algorithm_id, 'ocl-ciel-bridge')
})

test('buildQualityRowViews: bridge-only target has empty bridgeContributors (primary excluded)', () => {
  // Bridge-only case: the primary IS a bridge_child, so it's NOT also in
  // bridgeContributors. Inline framing in Concept.jsx already shows the
  // bridge intermediary; a duplicate [i] indicator would be noise.
  const cache = { [KEY_LOINC_GLUCOSE]: defLOINCGlucose, [KEY_CIEL_BRIDGE]: defCIELBridge }
  const rowState = {
    candidates: {
      bridge: { id: 'bridge', algorithm_id: 'ocl-ciel-bridge', concept_key: KEY_CIEL_BRIDGE, type: 'bridge', score: 0.92 },
      child:  { id: 'child',  algorithm_id: 'ocl-ciel-bridge', concept_key: KEY_LOINC_GLUCOSE, type: 'bridge_child', parent_candidate_id: 'bridge', bridge_concept_key: KEY_CIEL_BRIDGE, map_type: 'SAME-AS' }
    },
    concept_rows: {
      [KEY_LOINC_GLUCOSE]: { concept_key: KEY_LOINC_GLUCOSE, rerank_score: 84 },
      [KEY_CIEL_BRIDGE]:   { concept_key: KEY_CIEL_BRIDGE,   rerank_score: 91 }
    }
  }
  const views = buildQualityRowViews(rowState, cache)
  const loincView = views.find(v => v.conceptDefinition.key === KEY_LOINC_GLUCOSE)
  assert.equal(loincView.type, 'bridge_child')
  assert.equal(loincView.bridgeContributors.length, 0)
})

test('buildQualityRowViews: multi-bridge case — distinct bridge intermediaries do not collide', () => {
  // CIEL + SNOMED-CT both bridge to the same LOINC target. Quality view:
  // ONE LOINC ConceptRow, TWO bridge ConceptRows (one per namespace).
  const cache = {
    [KEY_LOINC_GLUCOSE]: defLOINCGlucose,
    [KEY_CIEL_BRIDGE]: defCIELBridge,
    [KEY_SNOMED_BRIDGE]: defSnomedBridge
  }
  const rowState = {
    candidates: {
      bridgeC: { id: 'bC', algorithm_id: 'ocl-bridge', concept_key: KEY_CIEL_BRIDGE, type: 'bridge', score: 0.92 },
      childC:  { id: 'cC', algorithm_id: 'ocl-bridge', concept_key: KEY_LOINC_GLUCOSE, type: 'bridge_child', parent_candidate_id: 'bC', bridge_concept_key: KEY_CIEL_BRIDGE, map_type: 'SAME-AS' },
      bridgeS: { id: 'bS', algorithm_id: 'ocl-snomed-bridge', concept_key: KEY_SNOMED_BRIDGE, type: 'bridge', score: 0.88 },
      childS:  { id: 'cS', algorithm_id: 'ocl-snomed-bridge', concept_key: KEY_LOINC_GLUCOSE, type: 'bridge_child', parent_candidate_id: 'bS', bridge_concept_key: KEY_SNOMED_BRIDGE, map_type: 'SAME-AS' }
    },
    concept_rows: {
      [KEY_LOINC_GLUCOSE]: { concept_key: KEY_LOINC_GLUCOSE, rerank_score: 90 },
      [KEY_CIEL_BRIDGE]:   { concept_key: KEY_CIEL_BRIDGE,   rerank_score: 91 },
      [KEY_SNOMED_BRIDGE]: { concept_key: KEY_SNOMED_BRIDGE, rerank_score: 87 }
    }
  }
  const views = buildQualityRowViews(rowState, cache)
  assert.equal(views.length, 3, 'two bridges + one target')
  const loincView = views.find(v => v.conceptDefinition.key === KEY_LOINC_GLUCOSE)
  assert.equal(loincView.contributingCandidates.length, 2, 'both bridge_children point to the same LOINC concept')
})

test('buildQualityRowViews: same visible concept from direct and bridge rows collapses into one row with per-algo raw scores', () => {
  const cache = {
    [KEY_CIEL_BRIDGE]: defCIELBridge,
    [KEY_CIEL_TARGET_VERSIONED]: defCIELTargetVersioned
  }
  const rowState = {
    candidates: {
      semantic: { id: 'semantic', algorithm_id: 'ocl-semantic', concept_key: KEY_CIEL_TARGET_VERSIONED, type: 'standard', score: 1.5 },
      bridge: { id: 'bridge', algorithm_id: 'ocl-ciel-bridge', concept_key: KEY_CIEL_BRIDGE, type: 'bridge', score: 3.06 },
      child: { id: 'child', algorithm_id: 'ocl-ciel-bridge', concept_key: KEY_CIEL_TARGET_VERSIONED, type: 'bridge_child', parent_candidate_id: 'bridge', bridge_concept_key: KEY_CIEL_BRIDGE, map_type: 'SAME-AS' }
    },
    concept_rows: {
      [KEY_CIEL_TARGET_VERSIONED]: { concept_key: KEY_CIEL_TARGET_VERSIONED, rerank_score: 99.85 },
      [KEY_CIEL_BRIDGE]: { concept_key: KEY_CIEL_BRIDGE, rerank_score: 99.85 }
    }
  }
  const views = buildQualityRowViews(rowState, cache)
  assert.equal(views.length, 1)
  assert.equal(views[0].contributingCandidates.length, 3)
  assert.deepEqual(
    views[0].contributingAlgorithms.sort((a, b) => a.algorithm_id.localeCompare(b.algorithm_id)),
    [
      { algorithm_id: 'ocl-ciel-bridge', rawScore: 3.06 },
      { algorithm_id: 'ocl-semantic', rawScore: 1.5 }
    ]
  )
})

test('conceptForMapping preserves merged algorithm provenance for mapped header rendering', () => {
  const rowView = {
    candidate: { algorithm_id: 'ocl-semantic', score: 1.5, map_type: 'SAME-AS' },
    conceptDefinition: defCIELTargetVersioned,
    conceptRow: { rerank_score: 99.85 },
    contributingAlgorithms: [
      { algorithm_id: 'ocl-semantic', rawScore: 1.5 },
      { algorithm_id: 'ocl-ciel-bridge', rawScore: 3.06 }
    ],
    contributingAlgorithmIds: ['ocl-semantic', 'ocl-ciel-bridge']
  }
  const out = conceptForMapping(rowView)
  assert.deepEqual(out.contributingAlgorithmIds, ['ocl-semantic', 'ocl-ciel-bridge'])
  assert.deepEqual(out.search_meta.contributing_algorithm_ids, ['ocl-semantic', 'ocl-ciel-bridge'])
  assert.deepEqual(out.search_meta.contributing_algorithms, [
    { algorithm_id: 'ocl-semantic', rawScore: 1.5 },
    { algorithm_id: 'ocl-ciel-bridge', rawScore: 3.06 }
  ])
})

// ---------- sortRowViews ----------

const fixtureViews = [
  { candidate: {score: 0.6}, conceptDefinition: {id: 'b', display_name: 'Beta'},  conceptRow: {rerank_score: 70} },
  { candidate: {score: 0.9}, conceptDefinition: {id: 'a', display_name: 'Alpha'}, conceptRow: {rerank_score: 50} },
  { candidate: {score: 0.7}, conceptDefinition: {id: 'c', display_name: 'Gamma'}, conceptRow: {rerank_score: 90} }
]

test('sortRowViews: rerank_score desc', () => {
  const out = sortRowViews(fixtureViews, 'rerank_score', 'desc')
  assert.deepEqual(out.map(v => v.conceptDefinition.id), ['c', 'b', 'a'])
})

test('sortRowViews: algo_score desc', () => {
  const out = sortRowViews(fixtureViews, 'algo_score', 'desc')
  assert.deepEqual(out.map(v => v.conceptDefinition.id), ['a', 'c', 'b'])
})

test('sortRowViews: id asc', () => {
  const out = sortRowViews(fixtureViews, 'id', 'asc')
  assert.deepEqual(out.map(v => v.conceptDefinition.id), ['a', 'b', 'c'])
})

test('sortRowViews: display_name asc', () => {
  const out = sortRowViews(fixtureViews, 'display_name', 'asc')
  assert.deepEqual(out.map(v => v.conceptDefinition.display_name), ['Alpha', 'Beta', 'Gamma'])
})

test('sortRowViews: undefined scores sort to the bottom in desc order', () => {
  const views = [
    { candidate: {}, conceptDefinition: {display_name: 'x'}, conceptRow: {} },
    { candidate: {}, conceptDefinition: {display_name: 'y'}, conceptRow: {rerank_score: 50} }
  ]
  const out = sortRowViews(views, 'rerank_score', 'desc')
  assert.equal(out[0].conceptDefinition.display_name, 'y')
})

test('sortRowViews: id falls back to reference.code when id is absent', () => {
  const views = [
    { candidate: {}, conceptDefinition: {reference: {code: 'z-1'}}, conceptRow: {} },
    { candidate: {}, conceptDefinition: {reference: {code: 'a-1'}}, conceptRow: {} }
  ]
  const out = sortRowViews(views, 'id', 'asc')
  assert.equal(out[0].conceptDefinition.reference.code, 'a-1')
})
