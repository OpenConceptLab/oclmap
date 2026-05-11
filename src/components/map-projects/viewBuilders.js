/**
 * Pure functions that project the unified-model state (RowMatchState +
 * conceptCache) into the row-view tuples consumed by Candidates.jsx /
 * Concept.jsx / Score.jsx.
 *
 * Kept in a plain .js file (no JSX) so they're loadable by Node's native
 * ESM resolver under node:test. Components import these from
 * `./viewBuilders.js`; tests in `__tests__/views.test.js` exercise them
 * directly without webpack/babel.
 *
 * See plans/unified-mapper-model.md "How the views map onto this model".
 */

// Match normalizers.js / conceptKey.js — pure JS, no lodash deps, no JSX
// imports, so the module is loadable by Node's native ESM resolver under
// node:test.

const compact = arr => (arr || []).filter(x => x != null && x !== false)
const values = obj => Object.values(obj || {})
const isNumber = v => typeof v === 'number' && !Number.isNaN(v)

/**
 * Build a "RowView" object for a single Candidate. Joins the Candidate
 * with its ConceptDefinition from conceptCache and its ConceptRow from
 * the row's state. Returns null if the ConceptDefinition is missing.
 */
export const candidateToRowView = (candidate, conceptCache, rowState) => {
  if(!candidate) return null
  const conceptDefinition = conceptCache?.[candidate.concept_key]
  if(!conceptDefinition) return null
  const conceptRow = rowState?.concept_rows?.[candidate.concept_key]
  let bridgeConceptDefinition
  if(candidate.type === 'bridge_child' && candidate.bridge_concept_key)
    bridgeConceptDefinition = conceptCache[candidate.bridge_concept_key]
  return {
    type: candidate.type,
    candidate,
    conceptDefinition,
    conceptRow,
    bridgeConceptDefinition
  }
}

/**
 * Algorithm-grouped view: iterate `RowState.candidates` filtered by
 * algorithm_id. Bridge candidates carry their bridge_children for nested
 * rendering. bridge_child candidates do NOT appear at the top level —
 * they are nested under their parent bridge.
 */
export const buildAlgorithmRowViews = (rowState, conceptCache, algoId) => {
  if(!rowState) return []
  const all = values(rowState.candidates || {}).filter(c => c.algorithm_id === algoId)
  const standalone = all.filter(c => c.type !== 'bridge_child')
  return compact(standalone.map(candidate => {
    const view = candidateToRowView(candidate, conceptCache, rowState)
    if(!view) return null
    if(view.type === 'bridge') {
      const children = all.filter(c => c.type === 'bridge_child' && c.parent_candidate_id === candidate.id)
      view.bridgeChildren = compact(children.map(c => candidateToRowView(c, conceptCache, rowState)))
    }
    return view
  }))
}

/**
 * Quality-grouped view: iterate `RowState.concept_rows`. One entry per
 * concept_key (the per-row presence of a concept). Each entry exposes
 * its rerank_score plus a list of contributing candidates so the UI can
 * show algorithm provenance. Bridge children surface here as their
 * target concept (no special-casing needed — the bridge_child Candidate's
 * concept_key IS the target concept's key).
 */
export const buildQualityRowViews = (rowState, conceptCache) => {
  if(!rowState) return []
  const allCandidates = values(rowState.candidates || {})
  const conceptRows = values(rowState.concept_rows || {})
  return compact(conceptRows.map(conceptRow => {
    const conceptDefinition = conceptCache?.[conceptRow.concept_key]
    if(!conceptDefinition) return null
    const contributing = allCandidates.filter(c => c.concept_key === conceptRow.concept_key)
    // Prefer a 'standard' candidate as the primary; else any bridge_child
    // (with its bridge intermediary attached); else whatever's there.
    const primary = contributing.find(c => c.type === 'standard')
      || contributing.find(c => c.type === 'bridge_child')
      || contributing[0]
    if(!primary) return null
    let bridgeConceptDefinition
    if(primary.type === 'bridge_child' && primary.bridge_concept_key)
      bridgeConceptDefinition = conceptCache[primary.bridge_concept_key]
    return {
      type: primary.type === 'bridge_child' ? 'bridge_child' : 'standard',
      candidate: primary,
      conceptDefinition,
      conceptRow,
      bridgeConceptDefinition,
      contributingCandidates: contributing
    }
  }))
}

/**
 * Sort RowViews by the chosen key. `rerank_score` and `algo_score` are
 * numeric; `id` and `display_name` are alphabetical. Missing scores sort
 * to the bottom in `desc` order via a -1 sentinel.
 */
export const sortRowViews = (views, sortBy, order) => {
  const valueFor = view => {
    switch(sortBy) {
      case 'rerank_score': return view.conceptRow?.rerank_score ?? -1
      case 'algo_score':   return view.candidate?.score ?? -1
      case 'id':           return view.conceptDefinition?.id || view.conceptDefinition?.reference?.code || ''
      case 'display_name': return view.conceptDefinition?.display_name || ''
      default:             return 0
    }
  }
  const dir = order === 'desc' ? -1 : 1
  const compare = (a, b) => {
    const va = valueFor(a)
    const vb = valueFor(b)
    if(va < vb) return -1 * dir
    if(va > vb) return 1 * dir
    return 0
  }
  return [...(views || [])].sort(compare)
}

/**
 * Project a unified-model tuple back into a legacy concept-shaped object,
 * used at the onMap / isSelectedForMap boundary. mapSelected and
 * downstream consumers (decision view, getRows, save format) continue to
 * expect the legacy shape; PR3 migrates them to consume the tuple
 * directly.
 */
export const conceptForMapping = (rowView) => {
  if(!rowView) return null
  const { candidate, conceptDefinition, conceptRow, bridgeConceptDefinition } = rowView
  if(!conceptDefinition) return null
  return {
    id: conceptDefinition.id || conceptDefinition.reference?.code,
    display_name: conceptDefinition.display_name,
    url: conceptDefinition.ocl_url,
    source: conceptDefinition.source,
    owner: conceptDefinition.owner,
    names: conceptDefinition.names,
    descriptions: conceptDefinition.descriptions,
    concept_class: conceptDefinition.concept_class,
    datatype: conceptDefinition.datatype,
    retired: conceptDefinition.retired,
    properties: conceptDefinition.properties,
    type: 'Concept',
    search_meta: {
      algorithm: candidate?.algorithm_id,
      search_score: candidate?.score,
      search_normalized_score: conceptRow?.rerank_score,
      search_highlight: candidate?.highlights,
      map_type: candidate?.map_type
    },
    bridge_concept: bridgeConceptDefinition ? {
      id: bridgeConceptDefinition.id || bridgeConceptDefinition.reference?.code,
      url: bridgeConceptDefinition.ocl_url,
      display_name: bridgeConceptDefinition.display_name,
      source: bridgeConceptDefinition.source
    } : undefined
  }
}

/**
 * Compute the unified score (0-100 percentile) and the raw algorithm score
 * for a candidate+row. Unified score = per-(row, concept) rerank score
 * from the ConceptRow. Raw score = per-algorithm score on the Candidate.
 * Pure — caller maps qualityBucket -> bucketColor via SCORES_COLOR.
 */
export const getScoreDetails = ({candidate, conceptRow} = {}, candidatesScore = {}) => {
  const rerankFloat = isNumber(conceptRow?.rerank_score) ? conceptRow.rerank_score : null
  const score = isNumber(candidate?.score) ? candidate.score : null
  // ConceptRow.rerank_score is already on the 0-100 scale (the rerank API
  // returns search_normalized_score in that range). Display directly;
  // when unavailable, scale the candidate's raw score from 0-1 to 0-100.
  let percentile
  if(rerankFloat !== null) percentile = rerankFloat
  else if(score !== null) percentile = score * 100

  const hasPercentile = isNumber(percentile)
  const recommendedScore = candidatesScore?.recommended
  const availableScore = candidatesScore?.available

  let qualityBucket
  if(hasPercentile) {
    if(percentile >= recommendedScore) qualityBucket = 'recommended'
    else if(percentile >= availableScore) qualityBucket = 'available'
    else qualityBucket = 'low_ranked'
  }

  return {
    score,
    percentile,
    hasPercentile,
    qualityBucket,
    rerankScore: `${parseFloat(hasPercentile ? percentile : score).toFixed(2)}%`,
    algoScore: score === null ? '' : `${parseFloat(score).toFixed(2)}`
  }
}

/**
 * Resolve an AI Assistant primary_candidate / alternative_candidate to a
 * displayable concept code. Resolution order:
 *   1. concept_key -> conceptCache[key].reference.code (v2, preferred)
 *   2. canonical_reference.code (v2 fallback, PR2a shim)
 *   3. concept_id / id (legacy v1)
 */
export const resolveAICandidateID = (candidate, conceptCache) => {
  if(!candidate) return null
  if(candidate.concept_key && conceptCache?.[candidate.concept_key]?.reference?.code)
    return conceptCache[candidate.concept_key].reference.code
  return candidate.canonical_reference?.code || candidate.concept_id || candidate.id || null
}
