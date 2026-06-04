// Build the payload for ConceptDetailsPanel from a click on any concept-bearing
// surface (Candidates row, Score chip, Search row, MappingDecisionResult target).
//
// The panel is the Candidates tab's detail modal — its job is to surface the
// FULL candidate story for a concept (metadata + match info across all
// contributing algorithms + bridge context) regardless of where the click
// originated. This helper centralizes the cross-row enrichment + AI flag
// lookup so each call site stays a one-liner.
//
// Tab visibility is data-driven inside the panel:
//   - Concept Details                                    — always
//   - Bridge Concept(s)  — if bridgeContributors.length OR bridge_concept present
//   - Match Details      — if contributingAlgorithms.length OR search_meta has score/highlights
import { buildQualityRowViews, conceptForMapping } from './viewBuilders.js'

const identityKeyOf = concept => {
  if(!concept) return null
  return concept.url || concept.ocl_url || concept.reference?.url || concept.id || concept.reference?.code || null
}

// Shared identity rule: a ConceptDefinition matches a concept if their URLs
// match, OR (id + source) both match. Used by both quality-view enrichment
// and bridge-intermediary detection so the two never disagree on identity.
const defMatchesConcept = (def, concept) => {
  if(!def) return false
  const defUrl = def.ocl_url || def.reference?.url
  const conceptUrl = concept?.url || concept?.ocl_url || concept?.reference?.url
  if(defUrl && conceptUrl && defUrl === conceptUrl) return true
  const defId = def.id || def.reference?.code
  const conceptId = concept?.id || concept?.reference?.code
  const defSource = def.source
  const conceptSource = concept?.source
  return Boolean(defId && conceptId && defId === conceptId && defSource && conceptSource && defSource === conceptSource)
}

const matchesConcept = (view, concept) => defMatchesConcept(view?.conceptDefinition, concept)

// Detect a bridge intermediary by looking for a 'bridge'-type candidate in
// the current row's candidates that matches this concept. When found, also
// return the cascade children (resolved through conceptCache) so the panel
// can show a "Bridge Children" tab listing what this bridge concept resolves
// to in the target repo.
//
// A bridge intermediary's panel semantics differ from a target candidate's:
//   - Target candidate: shows "Bridge Concepts" (intermediaries that found me)
//   - Bridge intermediary: shows "Bridge Children" (concepts I bridge to)
const detectBridgeIntermediary = (concept, rowMatchState, conceptCache) => {
  if(!rowMatchState?.candidates || !conceptCache) return null
  const allCandidates = Object.values(rowMatchState.candidates)
  const intermediary = allCandidates.find(c => {
    if(c?.type !== 'bridge') return false
    return defMatchesConcept(conceptCache[c.concept_key], concept)
  })
  if(!intermediary) return null
  const intermediaryKey = intermediary.concept_key
  const childCandidates = allCandidates.filter(c => c.type === 'bridge_child' && c.bridge_concept_key === intermediaryKey)
  const children = childCandidates
    .map(c => {
      const def = conceptCache[c.concept_key]
      if(!def) return null
      return {
        conceptDefinition: def,
        candidate: c,
        map_type: c.map_type,
        algorithm_id: c.algorithm_id,
      }
    })
    .filter(Boolean)
  return { intermediary, children }
}

// Build the full panel payload. `concept` may be either a unified-model
// rowView (e.g. directly from Candidates) or a legacy concept-shaped object
// (e.g. from the Search tab, MappingDecisionResult, or the score chip).
// Returns null for falsy input. Always returns a normalized legacy-shape
// concept with an extra `panelContext` field carrying enrichment + AI flags.
export const buildPanelPayload = ({
  concept,
  rowMatchState,
  conceptCache,
  currentRowCode,
  AIRecommendedCandidateId,
  AIAlternateCandidateIds,
  initialTab,
  fromCrossTab = false,
}) => {
  if(!concept) return null

  // Normalize input: if it's a rowView tuple, project it; else assume legacy.
  const normalized = concept?.conceptDefinition
    ? conceptForMapping(concept)
    : concept
  if(!normalized) return null

  // Bridge-intermediary detection: does this concept appear as a 'bridge'
  // candidate in the current row? If so, gather its cascade children.
  const bridgeIntermediaryInfo = detectBridgeIntermediary(normalized, rowMatchState, conceptCache)
  const isBridgeIntermediary = Boolean(bridgeIntermediaryInfo)
  const bridgeChildren = bridgeIntermediaryInfo?.children || []

  // Look up this concept in the current row's quality views to discover any
  // additional contributing algorithms / bridge contributors that the caller
  // didn't already know about. This is what powers the "Group By Algorithm
  // click shows the full picture" behavior and the cross-tab enrichment when
  // a Search-tab result happens to also be a candidate for the current row.
  let enrichment = null
  if(rowMatchState && conceptCache) {
    const views = buildQualityRowViews(rowMatchState, conceptCache)
    const match = views.find(v => matchesConcept(v, normalized))
    if(match) {
      enrichment = {
        bridgeContributors: match.bridgeContributors || [],
        contributingAlgorithms: match.contributingAlgorithms || [],
        contributingCandidates: match.contributingCandidates || [],
        primaryCandidate: match.candidate,
        primaryConceptRow: match.conceptRow,
        primaryBridgeConceptDefinition: match.bridgeConceptDefinition,
      }
    }
  }

  // AI ids are resolved canonically via resolveAICandidateID =
  // conceptCache[key].reference.code. The inline Score chip (Concept.jsx)
  // matches on reference.code, but conceptForMapping sets id =
  // conceptDefinition.id || reference.code (prefers .id). When .id differs
  // from .reference.code (verbose vs. expansion shapes) a single-field
  // compare would light the panel's AI chip inconsistently with the row.
  // Match against every code this concept is known by.
  const conceptCodes = [
    normalized.id,
    normalized.reference?.code,
    concept?.conceptDefinition?.reference?.code,
    concept?.conceptDefinition?.id,
  ].filter(Boolean)
  const aiRecommended = Boolean(AIRecommendedCandidateId && conceptCodes.includes(AIRecommendedCandidateId))
  const aiAlternate = Array.isArray(AIAlternateCandidateIds)
    ? conceptCodes.some(c => AIAlternateCandidateIds.includes(c))
    : false

  return {
    ...normalized,
    initialTab,
    panelContext: {
      enrichment,
      isAIRecommended: aiRecommended,
      isAIAlternate: aiAlternate,
      // Only show the cross-tab badge if we actually FOUND the concept in the
      // current row — otherwise the click was a plain Search result.
      fromCrossTab: Boolean(fromCrossTab && enrichment),
      currentRowCode,
      isBridgeIntermediary,
      bridgeChildren,
    }
  }
}

// Derive the all-contributing-bridges list for the Bridge Concepts tab.
// Merges the primary bridge concept (the one the user clicked through, if any)
// with the secondary bridge contributors from enrichment. Deduplicates by
// bridge concept identity. Returns an array of
//   {bridgeConceptDefinition, map_type, algorithm_id}
// entries — same shape as bridgeContributors. Returns [] when no bridges.
export const allBridgesFor = (payload) => {
  const enrichment = payload?.panelContext?.enrichment
  const contributors = enrichment?.bridgeContributors || []
  const primaryBridgeDef = enrichment?.primaryBridgeConceptDefinition
  const primaryCandidate = enrichment?.primaryCandidate

  const all = []
  if(primaryBridgeDef) {
    all.push({
      bridgeConceptDefinition: primaryBridgeDef,
      map_type: primaryCandidate?.map_type,
      algorithm_id: primaryCandidate?.algorithm_id,
    })
  } else if(payload?.bridge_concept) {
    // Click came in via legacy/synthetic projection — no full bridge def in
    // enrichment, but conceptForMapping preserved a stub.
    all.push({
      bridgeConceptDefinition: {
        id: payload.bridge_concept.id,
        reference: { code: payload.bridge_concept.id },
        ocl_url: payload.bridge_concept.url,
        display_name: payload.bridge_concept.display_name,
        source: payload.bridge_concept.source,
      },
      map_type: payload?.search_meta?.map_type,
      algorithm_id: payload?.search_meta?.algorithm,
    })
  }

  for(const c of contributors) {
    const key = identityKeyOf(c.bridgeConceptDefinition)
    if(!key) continue
    if(all.some(a => identityKeyOf(a.bridgeConceptDefinition) === key)) continue
    all.push(c)
  }

  return all
}
