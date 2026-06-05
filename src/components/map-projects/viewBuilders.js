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
const uniq = arr => [...new Set(arr || [])]
const displayIdentityOf = def => `${def?.reference?.url || ''}::${def?.id || def?.reference?.code || ''}`
const normalizeRelativeUrl = (url) => {
  if(typeof url !== 'string' || url === '') return ''
  return url.endsWith('/') ? url : `${url}/`
}
const normalizeCanonicalUrl = (url) => {
  if(typeof url !== 'string' || url === '') return ''
  return url.endsWith('/') ? url : `${url}/`
}
const toNumberOrNull = (v) => {
  if(isNumber(v)) return v
  if(typeof v === 'string' && v.trim() !== '') {
    const parsed = parseFloat(v)
    if(!Number.isNaN(parsed)) return parsed
  }
  return null
}

const canonicalUrlsEqual = (left, right) => (
  normalizeCanonicalUrl(left) !== '' &&
  normalizeCanonicalUrl(left) === normalizeCanonicalUrl(right)
)

export const conceptBelongsToTargetRepo = (conceptDefinition, targetCanonical, targetRelativeUrl) => {
  if(!conceptDefinition) return false
  if(canonicalUrlsEqual(conceptDefinition?.reference?.url, targetCanonical)) return true
  const relativeUrl = normalizeRelativeUrl(targetRelativeUrl)
  const oclUrl = conceptDefinition?.ocl_url || ''
  return relativeUrl !== '' && oclUrl.startsWith(relativeUrl)
}

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
// Deterministic order for bridge_children under a bridge intermediary:
// primary key is rerank_score desc (when both have one), secondary is the
// concept code/id ascending. Without this, children appeared in
// Object.values() insertion order, which flipped between renders and made
// the same project look different each refresh.
const sortBridgeChildren = (rowViews) => {
  const codeOf = (v) => v?.conceptDefinition?.id || v?.conceptDefinition?.reference?.code || ''
  return [...(rowViews || [])].sort((a, b) => {
    const sa = a?.conceptRow?.rerank_score
    const sb = b?.conceptRow?.rerank_score
    const haveA = typeof sa === 'number' && !Number.isNaN(sa)
    const haveB = typeof sb === 'number' && !Number.isNaN(sb)
    if(haveA && haveB && sa !== sb) return sb - sa
    if(haveA && !haveB) return -1
    if(!haveA && haveB) return 1
    return codeOf(a).localeCompare(codeOf(b))
  })
}

export const buildAlgorithmRowViews = (rowState, conceptCache, algoId) => {
  if(!rowState) return []
  const all = values(rowState.candidates || {}).filter(c => c.algorithm_id === algoId)
  const standalone = all.filter(c => c.type !== 'bridge_child')
  return compact(standalone.map(candidate => {
    const view = candidateToRowView(candidate, conceptCache, rowState)
    if(!view) return null
    if(view.type === 'bridge') {
      const children = all.filter(c => c.type === 'bridge_child' && c.parent_candidate_id === candidate.id)
      view.bridgeChildren = sortBridgeChildren(compact(children.map(c => candidateToRowView(c, conceptCache, rowState))))
    }
    return view
  }))
}

/**
 * The distinct algorithm_ids present in rowState.candidates that are NOT in
 * the project's configured algorithm set. These "orphan-algo" candidates are
 * legitimate (a candidate's algorithm_id is a benign label, never a filter —
 * membership is gated by target-repo elsewhere) and arise whenever a project
 * is reconfigured after running algorithms, or via the PR3-C v1->v2 migration.
 * The by-algorithm grouping iterates only configured algos, so these ids would
 * otherwise have no bucket. Order is stable (first-seen) for deterministic
 * rendering. configuredIds may be any iterable of algorithm ids.
 */
export const getOrphanAlgorithmIds = (rowState, configuredIds) => {
  if(!rowState) return []
  const configured = new Set(configuredIds || [])
  const present = values(rowState.candidates || {})
    .map(c => c.algorithm_id)
    .filter(id => id != null && !configured.has(id))
  return uniq(present)
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
  const groupedByIdentity = new Map()

  conceptRows.forEach(conceptRow => {
    const conceptDefinition = conceptCache?.[conceptRow.concept_key]
    if(!conceptDefinition) return
    const contributing = allCandidates.filter(c => c.concept_key === conceptRow.concept_key)
    if(!contributing.length) return
    const identity = displayIdentityOf(conceptDefinition)
    const existing = groupedByIdentity.get(identity)
    if(existing) {
      existing.conceptRows.push(conceptRow)
      existing.contributing.push(...contributing)
      existing.definitions.push(conceptDefinition)
    } else {
      groupedByIdentity.set(identity, {
        conceptRows: [conceptRow],
        contributing: [...contributing],
        definitions: [conceptDefinition]
      })
    }
  })

  return compact([...groupedByIdentity.values()].map(group => {
    const contributing = uniq(group.contributing.map(c => c?.id))
      .map(id => group.contributing.find(c => c?.id === id))
      .filter(Boolean)
    // Prefer a 'standard' candidate as the primary; else any bridge_child
    // (with its bridge intermediary attached); else whatever's there.
    // Within each type group, pick the highest-scoring candidate so the
    // primary is deterministic — without this, multi-algo convergence
    // (e.g. both ocl-search and ocl-semantic returning the same concept)
    // selected by Object.values() iteration order and the "primary algorithm"
    // chip flipped between renders. Falls back to -Infinity for unscored
    // candidates (notably bridge_child, which has no own score).
    const byScoreDesc = (a, b) => (toNumberOrNull(b?.score) ?? -Infinity) - (toNumberOrNull(a?.score) ?? -Infinity)
    const primary = [...contributing.filter(c => c.type === 'standard')].sort(byScoreDesc)[0]
      || [...contributing.filter(c => c.type === 'bridge_child')].sort(byScoreDesc)[0]
      || [...contributing].sort(byScoreDesc)[0]
    if(!primary) return null
    const conceptDefinition = conceptCache?.[primary.concept_key] || group.definitions[0]
    if(!conceptDefinition) return null
    const primaryConceptRow = group.conceptRows.find(cr => cr.concept_key === primary.concept_key) || group.conceptRows[0]
    const rerankScore = group.conceptRows
      .map(cr => cr?.rerank_score)
      .filter(isNumber)
      .sort((a, b) => b - a)[0]
    const conceptRow = isNumber(rerankScore)
      ? { ...primaryConceptRow, rerank_score: rerankScore }
      : primaryConceptRow
    let bridgeConceptDefinition
    if(primary.type === 'bridge_child' && primary.bridge_concept_key)
      bridgeConceptDefinition = conceptCache[primary.bridge_concept_key]
    // Collect bridge contributors OTHER than the primary so the convergence
    // case (target reached by both a standard algo AND one or more bridges)
    // can surface the bridge story on the algo-chip line via [i] tooltip
    // without taking over the row's primary framing.
    const bridgeContributors = compact(contributing
      .filter(c => c.type === 'bridge_child' && c !== primary)
      .map(c => {
        const bridgeDef = c.bridge_concept_key ? conceptCache?.[c.bridge_concept_key] : null
        const bridgeCandidate = c?.parent_candidate_id ? allCandidates.find(a => a?.id === c.parent_candidate_id) : null
        const bridgeConceptRow = c?.bridge_concept_key ? rowState?.concept_rows?.[c.bridge_concept_key] : null
        return bridgeDef ? {
          bridgeConceptDefinition: bridgeDef,
          candidate: bridgeCandidate || c,
          conceptRow: bridgeConceptRow,
          map_type: c.map_type,
          algorithm_id: c.algorithm_id
        } : null
      }))
    const contributingAlgorithms = values(contributing.reduce((acc, c) => {
      const algorithmId = c?.algorithm_id
      if(!algorithmId) return acc
      const parent = c?.parent_candidate_id ? allCandidates.find(a => a?.id === c.parent_candidate_id) : null
      const rawScore = toNumberOrNull(c?.score) ?? toNumberOrNull(parent?.score)
      const existing = acc[algorithmId]
      if(!existing || ((rawScore ?? -Infinity) > (existing.rawScore ?? -Infinity))) {
        acc[algorithmId] = {
          algorithm_id: algorithmId,
          rawScore
        }
      }
      return acc
    }, {}))
    const contributingAlgorithmIds = contributingAlgorithms.map(a => a.algorithm_id)
    return {
      type: primary.type === 'bridge_child' ? 'bridge_child' : 'standard',
      candidate: primary,
      conceptDefinition,
      conceptRow,
      bridgeConceptDefinition,
      bridgeContributors,
      contributingAlgorithms,
      contributingAlgorithmIds,
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
  const { candidate, conceptDefinition, conceptRow, bridgeConceptDefinition, contributingAlgorithms, contributingAlgorithmIds } = rowView
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
    // `property` (singular) is the schema-specific dict — LOINC's
    // COMPONENT/PROPERTY/TIME_ASPCT/etc. ConceptSummaryProperties reads
    // this directly. Without it in the projection, table view rows render
    // without the schema chips (the card view works because it gets the
    // ConceptDefinition directly).
    property: conceptDefinition.property,
    extras: conceptDefinition.extras,
    type: 'Concept',
    search_meta: {
      algorithm: candidate?.algorithm_id,
      search_score: candidate?.score,
      search_normalized_score: conceptRow?.rerank_score,
      search_highlight: candidate?.highlights,
      map_type: candidate?.map_type,
      contributing_algorithms: contributingAlgorithms,
      contributing_algorithm_ids: contributingAlgorithmIds
    },
    bridge_concept: bridgeConceptDefinition ? {
      id: bridgeConceptDefinition.id || bridgeConceptDefinition.reference?.code,
      url: bridgeConceptDefinition.ocl_url,
      display_name: bridgeConceptDefinition.display_name,
      source: bridgeConceptDefinition.source
    } : undefined,
    contributingAlgorithms,
    contributingAlgorithmIds
  }
}

/**
 * Compute the unified score (0-100 percentile) and the raw algorithm score
 * for a candidate+row. Unified score = per-(row, concept) rerank score
 * from the ConceptRow. Raw score = per-algorithm score on the Candidate.
 *
 * Accepts either shape:
 *   - {candidate, conceptRow} — the unified-model tuple
 *   - {search_meta: {search_normalized_score, search_score}} — the legacy
 *     concept shape (also produced by conceptForMapping projection).
 * Both shapes coexist while PR3-era cleanup is pending; the legacy path is
 * exercised by MatchDetailsPanel, which receives the conceptForMapping
 * projection (a legacy concept shape with top-level search_meta).
 *
 * Pure — caller maps qualityBucket -> bucketColor via SCORES_COLOR.
 */
export const getScoreDetails = (input = {}, candidatesScore = {}) => {
  const {candidate, conceptRow} = input || {}
  // Read search_meta without mutating the (cache-backed) candidate. The old
  // code parsed scores in place; toNumberOrNull below already coerces, so a
  // read-only copy keeps this helper pure as its docstring claims.
  const rawSearchMeta = input?.search_meta || candidate?.search_meta
  const searchMeta = rawSearchMeta
    ? {
        ...rawSearchMeta,
        search_score: toNumberOrNull(rawSearchMeta.search_score) ?? rawSearchMeta.search_score,
        search_normalized_score: toNumberOrNull(rawSearchMeta.search_normalized_score) ?? rawSearchMeta.search_normalized_score,
      }
    : rawSearchMeta
  const rerankFloat = isNumber(conceptRow?.rerank_score)
    ? conceptRow.rerank_score
    : (toNumberOrNull(searchMeta?.search_normalized_score))
  const score = toNumberOrNull(candidate?.score)
    ?? toNumberOrNull(searchMeta?.search_score)
  // ConceptRow.rerank_score is already on the 0-100 scale (the rerank API
  // returns search_normalized_score in that range). Display directly.
  // No fallback to `score * 100`: an interim semantic-search candidate has
  // candidate.score ≈ 1.0 and a pending rerank — scaling that produces a
  // misleading 100% chip until rerank lands. Leave percentile undefined so
  // the UI can render a placeholder.
  const percentile = rerankFloat !== null ? rerankFloat : undefined

  const hasPercentile = isNumber(percentile)
  const recommendedScore = candidatesScore?.recommended
  const availableScore = candidatesScore?.available

  let qualityBucket
  if(hasPercentile) {
    if(percentile >= recommendedScore) qualityBucket = 'recommended'
    else if(percentile >= availableScore) qualityBucket = 'available'
    else qualityBucket = 'low_ranked'
  }

  const rerankScore = hasPercentile ? `${parseFloat(percentile).toFixed(2)}%` : ''
  const algoScore = isNumber(score) ? `${parseFloat(score).toFixed(2)}` : ''

  return {
    score,
    percentile,
    hasPercentile,
    qualityBucket,
    rerankScore,
    algoScore
  }
}

/**
 * Resolve an AI Assistant primary_candidate / alternative_candidate to a
 * displayable concept code. Resolution order:
 *   1. concept_key -> conceptCache[key].reference.code (v2, preferred)
 *   2. canonical_reference.code (v2 fallback)
 */
export const resolveAICandidateID = (candidate, conceptCache) => {
  if(!candidate) return null
  if(candidate.concept_key && conceptCache?.[candidate.concept_key]?.reference?.code)
    return conceptCache[candidate.concept_key].reference.code
  return candidate.canonical_reference?.code || null
}
