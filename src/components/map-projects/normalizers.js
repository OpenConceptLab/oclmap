/* eslint-disable no-undef */
/**
 * Pure normalization functions for the unified mapper data model.
 * See plans/unified-mapper-model.md for the architectural rationale.
 *
 * Splits the legacy flat candidate-shaped object returned by match algorithms
 * into four entities:
 *   - AlgorithmResponse: raw algorithm output (preserved verbatim)
 *   - Candidate:         a claim that a concept matches a row, per algorithm
 *   - ConceptDefinition: project-wide canonical concept data (lives in conceptCache)
 *   - ConceptRow:        per-row presence of a concept (rerank_score lives here)
 *
 * Concept identity is canonical: ConceptReference = {url, code, version?}, where
 * `url` is the canonical URL of the code system (NOT the OCL relative URL of an
 * instance). Each algorithm declares how to extract the reference from its
 * response via a `concept_identity` config block; the normalizer resolves
 * `reference_source: 'target_repo' | 'bridge_repo' | 'fixed'` against the
 * project context.
 *
 * These functions intentionally have no React or lodash dependencies — they
 * are unit-testable in isolation against captured algorithm fixtures.
 */

import { makeConceptKey } from './conceptKey.js'

const newId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

/**
 * Create an AlgorithmResponse entity wrapping the raw algorithm output.
 * Preserves the response untouched so debug/audit views can render it later.
 */
export const createAlgorithmResponse = (rawResponse, algorithmId, options = {}) => {
  const { status = 'success', error, rowIndex } = options
  return {
    id: newId(),
    algorithm_id: algorithmId,
    row_index: rowIndex,
    raw: rawResponse,
    received_at: new Date().toISOString(),
    status,
    ...(error ? { error } : {})
  }
}

/**
 * Decide a concept's lookup_status based on which fields the algorithm response
 * populated.
 */
const inferLookupStatus = (result) => {
  if (!result) return 'pending'
  const hasNames = Array.isArray(result.names) && result.names.length > 0
  const hasDescriptions = Array.isArray(result.descriptions) && result.descriptions.length > 0
  if (hasNames && hasDescriptions) return 'full'
  if (result.id && result.display_name) return 'partial'
  return 'pending'
}

/**
 * Resolve a ConceptReference from a result given an identity config and project context.
 *
 * @param {Object} result            One algorithm result (concept-shaped).
 * @param {Object} identityConfig    The algorithm's concept_identity config block.
 *                                   Shape: { reference_source, code_field, canonical_url? }
 * @param {Object} projectContext    Project-level canonical context.
 *                                   Shape: { target_repo: {canonical_url, version?},
 *                                            bridge_repo?: {canonical_url, version?} }
 * @returns {ConceptReference | null}
 */
const resolveReference = (result, identityConfig, projectContext) => {
  if (!result || !identityConfig) return null
  const codeField = identityConfig.code_field || 'id'
  const code = result[codeField]
  if (!code) return null

  let url
  let version
  switch (identityConfig.reference_source) {
    case 'fixed':
      url = identityConfig.canonical_url
      break
    case 'target_repo':
      url = projectContext?.target_repo?.canonical_url
      version = projectContext?.target_repo?.version
      break
    case 'bridge_repo':
      url = projectContext?.bridge_repo?.canonical_url
      version = projectContext?.bridge_repo?.version
      break
    default:
      return null
  }

  if (!url) return null
  return version ? { url, code, version } : { url, code }
}

/**
 * Build a ConceptDefinition from a concept-shaped result + a resolved reference.
 */
const toConceptDefinition = (result, reference, identityConfig, { algorithmId } = {}) => {
  if (!reference) return null
  const oclUrlField = identityConfig?.ocl_url_field
  const oclUrl = oclUrlField ? result?.[oclUrlField] : undefined
  return {
    reference,
    key: makeConceptKey(reference),
    ocl_url: oclUrl,
    id: result?.id,
    display_name: result?.display_name,
    source: result?.source,
    owner: result?.owner,
    names: result?.names,
    descriptions: result?.descriptions,
    concept_class: result?.concept_class,
    datatype: result?.datatype,
    retired: result?.retired,
    properties: result?.properties,
    lookup_status: inferLookupStatus(result),
    lookup_source_type: 'algorithm',
    lookup_source: algorithmId
  }
}

/**
 * Build a stub ConceptDefinition for a bridge cascade target. Bridge responses
 * only carry name+code+url for cascade targets, so the resulting definition is
 * always 'pending' — ensureLoaded will fill it in.
 *
 * @param {Object} mapping             A cascade mapping entry from the bridge response.
 * @param {Object} cascadeIdentity     The algo's concept_identity.cascade_target config.
 * @param {Object} projectContext
 */
const cascadeTargetToConceptDefinition = (mapping, cascadeIdentity, projectContext) => {
  if (!mapping || !cascadeIdentity) return null
  // Build a synthetic "result" shape so resolveReference can run uniformly.
  const syntheticResult = {
    [cascadeIdentity.code_field || 'cascade_target_concept_code']:
      mapping[cascadeIdentity.code_field || 'cascade_target_concept_code'],
    ...mapping
  }
  const reference = resolveReference(syntheticResult, cascadeIdentity, projectContext)
  if (!reference) return null

  const oclUrlField = cascadeIdentity.ocl_url_field
  const oclUrl = oclUrlField ? mapping?.[oclUrlField] : undefined

  return {
    reference,
    key: makeConceptKey(reference),
    ocl_url: oclUrl,
    id: reference.code,
    display_name: mapping.cascade_target_concept_name,
    source: mapping.cascade_target_source_name,
    owner: undefined,
    names: undefined,
    descriptions: undefined,
    concept_class: undefined,
    datatype: undefined,
    retired: undefined,
    properties: undefined,
    lookup_status: 'pending',
    lookup_source_type: undefined,
    lookup_source: undefined
  }
}

const newConceptRow = (conceptKey) => ({
  concept_key: conceptKey,
  rerank_score: undefined
})

const isBridgeResult = (identityConfig) =>
  identityConfig?.reference_source === 'bridge_repo' && Boolean(identityConfig.cascade_target)

/**
 * Normalize a single algorithm result into the new entity model.
 *
 * @param {Object} result            One result object (concept-shaped).
 * @param {Object} ctx               Normalization context.
 * @param {string} ctx.algorithmId   The algorithm ID (e.g. 'ocl-search').
 * @param {Object} ctx.algorithmConfig         The algorithm definition with concept_identity.
 * @param {string} ctx.algorithmResponseId     FK back to the AlgorithmResponse.
 * @param {Object} ctx.projectContext          {target_repo, bridge_repo?, namespace}
 * @returns {{candidates: Array, concept_definitions: Array, concept_rows: Array}}
 */
export const normalizeAlgoResult = (result, ctx = {}) => {
  const empty = { candidates: [], concept_definitions: [], concept_rows: [] }
  if (!result) return empty

  const { algorithmId, algorithmConfig, algorithmResponseId, projectContext } = ctx
  const identityConfig = algorithmConfig?.concept_identity
  if (!identityConfig) return empty

  const meta = result.search_meta || {}
  const isBridge = isBridgeResult(identityConfig)

  // Resolve the primary reference (the result's own concept).
  const primaryReference = resolveReference(result, identityConfig, projectContext)
  if (!primaryReference) return empty

  const candidates = []
  const conceptDefinitions = []
  const conceptRows = []

  const primaryDef = toConceptDefinition(result, primaryReference, identityConfig, { algorithmId })
  conceptDefinitions.push(primaryDef)
  conceptRows.push(newConceptRow(primaryDef.key))

  const primaryCandidate = {
    id: newId(),
    algorithm_response_id: algorithmResponseId,
    algorithm_id: algorithmId,
    concept_key: primaryDef.key,
    type: isBridge ? 'bridge' : 'standard',
    score: meta.search_score,
    highlights: meta.search_highlight
  }
  candidates.push(primaryCandidate)

  // For bridge results, fan out one bridge_child candidate per cascade mapping.
  if (isBridge && Array.isArray(result.mappings)) {
    for (const mapping of result.mappings) {
      const targetDef = cascadeTargetToConceptDefinition(
        mapping,
        identityConfig.cascade_target,
        projectContext
      )
      if (!targetDef) continue

      // Avoid duplicate ConceptDefinition entries within the same result.
      if (!conceptDefinitions.some(cd => cd.key === targetDef.key)) {
        conceptDefinitions.push(targetDef)
        conceptRows.push(newConceptRow(targetDef.key))
      }

      candidates.push({
        id: newId(),
        algorithm_response_id: algorithmResponseId,
        algorithm_id: algorithmId,
        concept_key: targetDef.key,
        type: 'bridge_child',
        score: undefined,
        highlights: undefined,
        bridge_concept_key: primaryDef.key,
        parent_candidate_id: primaryCandidate.id,
        map_type: mapping.map_type
      })
    }
  }

  return {
    candidates,
    concept_definitions: conceptDefinitions,
    concept_rows: conceptRows
  }
}

/**
 * Higher-level orchestration: normalize a full algorithm invocation for one row.
 * Takes the wrapped `{row, results}` payload and produces the AlgorithmResponse +
 * flattened entity arrays, with intra-payload dedup.
 *
 * @param {Object} rawPayload                    The {row, results} envelope.
 * @param {Object} ctx
 * @param {string} ctx.algorithmId
 * @param {Object} ctx.algorithmConfig
 * @param {Object} ctx.projectContext
 * @param {number} ctx.rowIndex
 * @param {string} [ctx.status='success']
 * @param {string} [ctx.error]
 * @param {*}      [ctx.rawResponse]             Override stored raw (defaults to rawPayload).
 */
export const normalizeAlgorithmInvocation = (rawPayload, ctx = {}) => {
  const {
    algorithmId,
    algorithmConfig,
    projectContext,
    rowIndex,
    status = 'success',
    error,
    rawResponse
  } = ctx

  const algorithmResponse = createAlgorithmResponse(
    rawResponse !== undefined ? rawResponse : rawPayload,
    algorithmId,
    { status, error, rowIndex }
  )

  const results = Array.isArray(rawPayload?.results) ? rawPayload.results : []

  const allCandidates = []
  const defsByKey = new Map()
  const rowsByKey = new Map()

  for (const result of results) {
    const { candidates, concept_definitions, concept_rows } = normalizeAlgoResult(result, {
      algorithmId,
      algorithmConfig,
      algorithmResponseId: algorithmResponse.id,
      projectContext
    })
    allCandidates.push(...candidates)
    for (const cd of concept_definitions) {
      const existing = defsByKey.get(cd.key)
      // Prefer richer definitions: never overwrite a 'full' with a 'pending'.
      if (!existing || lookupStatusRank(cd.lookup_status) > lookupStatusRank(existing.lookup_status)) {
        defsByKey.set(cd.key, cd)
      }
    }
    for (const cr of concept_rows) {
      if (!rowsByKey.has(cr.concept_key)) {
        rowsByKey.set(cr.concept_key, cr)
      }
    }
  }

  return {
    algorithm_response: algorithmResponse,
    candidates: allCandidates,
    concept_definitions: Array.from(defsByKey.values()),
    concept_rows: Array.from(rowsByKey.values())
  }
}

const LOOKUP_RANK = { pending: 0, failed: 0, partial: 1, full: 2 }
export const lookupStatusRank = (status) => LOOKUP_RANK[status] ?? 0
