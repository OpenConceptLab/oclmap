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
 * populated. 'full' means the response carries enough data for the UI:
 *   - `property` field present (the verbose-payload marker — OCL's
 *      ConceptDetailSerializer always emits it, even as an empty array), OR
 *   - a populated `names` array (the list-serializer signal — names are
 *      enough to render the row's display).
 * Many concepts (LOINC especially) have no separate `descriptions`, so
 * requiring descriptions for 'full' stranded verbose-loaded concepts at
 * 'partial' and made the UI's summary chips disappear. We don't check
 * `extras` because scispacy synthesizes that field with internal metadata
 * (LOINC_NUM, composite_score) — not the OCL schema property dict.
 */
const inferLookupStatus = (result) => {
  if (!result) return 'pending'
  const hasNames = Array.isArray(result.names) && result.names.length > 0
  const hasVerbosePayload = Array.isArray(result.property)
    || (Array.isArray(result.properties) && result.properties.length > 0)
  if (result.id && result.display_name && (hasVerbosePayload || hasNames)) return 'full'
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
// Orphan-algo recovery (PR3-C / ocl_issues#2555): extract the OCL source path
// (/owner-type/owner/sources/mnemonic/) and the source mnemonic from an OCL
// url, host-agnostic (handles both relative and absolute api.* urls).
const sourcePathOf = (u) => {
  if (!u) return null
  const parts = String(u).replace(/^https?:\/\/[^/]+/, '').split('/').filter(Boolean)
  const i = parts.indexOf('sources')
  return (i >= 0 && parts.length > i + 1) ? '/' + parts.slice(0, i + 2).join('/') + '/' : null
}
const sourceMnemonicOf = (u) => {
  const p = sourcePathOf(u)
  return p ? p.split('/').filter(Boolean).pop() : null
}

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
      // When a fixed-canonical algo's URL matches the project's target_repo,
      // it's targeting the same repo as the target_repo-pathway algos and must
      // key on the same (url, code, version) for dedup. Without this, e.g.
      // scispacy LOINC (fixed) splits from ocl-search/ocl-semantic LOINC
      // (target_repo) and from ocl-bridge cascade target (target_repo via
      // cascade) under any pinned version. The mapping project pins ONE
      // explicit target repo version; concept identity for dedup must be
      // anchored to that pin across all algorithm paths.
      if (url && url === projectContext?.target_repo?.canonical_url) {
        version = projectContext.target_repo.version
      }
      break
    case 'target_repo':
      url = projectContext?.target_repo?.canonical_url
      version = projectContext?.target_repo?.version
      break
    case 'bridge_repo':
      url = projectContext?.bridge_repo?.canonical_url
      version = projectContext?.bridge_repo?.version
      break
    case 'result': {
      // Orphan-algo recovery: the algorithm that produced this result is no
      // longer in the project config, so there's no concept_identity to look
      // up. Derive the concept's home from the RESULT itself. If it lives in
      // the project's target source, anchor to the target canonical+version
      // (formal — so it dedups and renders/recommends like any target concept);
      // otherwise key on its own (generated) source so it stays correctly
      // NON-target (the UI's target-repo filter keeps it inert instead of
      // mis-surfacing a non-target concept as a mapping candidate).
      const targetSrc = sourcePathOf(projectContext?.target_repo?.relative_url)
      const targetMnem = sourceMnemonicOf(projectContext?.target_repo?.relative_url)
      const resultSrc = sourcePathOf(result.url || result.ocl_url)
      if (resultSrc && targetSrc && resultSrc === targetSrc) {
        url = projectContext.target_repo.canonical_url
        version = projectContext.target_repo.version
      } else if (resultSrc) {
        url = `https://ns.openconceptlab.org${resultSrc}`
      } else if (result.source && targetMnem && result.source === targetMnem) {
        // stub (no url) whose source mnemonic matches the project target source
        url = projectContext.target_repo.canonical_url
        version = projectContext.target_repo.version
      }
      break
    }
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
    // `property` (singular) is the schema-specific property dict OCL returns
    // for sources like LOINC (COMPONENT/PROPERTY/TIME_ASPCT/etc.) sourced from
    // ConceptDetailSerializer.property = JSONField(source='properties').
    // ConceptSummaryProperties.jsx reads this field directly. Without it the
    // verbose payload's schema chips never reach the UI even when $match
    // returns them.
    property: result?.property,
    extras: result?.extras,
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
    property: undefined,
    extras: undefined,
    lookup_status: 'pending',
    lookup_source_type: undefined,
    lookup_source: undefined
  }
}

// rerank_score on ConceptRow comes from search_normalized_score ONLY when
// the caller signals it came from a reranker-true single-algo $match path
// — that's the path where the server-side scores ARE the unified rerank.
// In all other paths (multi-algo, bridge, scispacy, custom) the response's
// search_normalized_score is just the per-algo native score (e.g. FAISS
// similarity × 100), which the OCL server emits unconditionally. Treating
// that as a unified rerank score yields chip values like "100.00%" for
// every top semantic candidate until the debounced $rerank/ pipeline runs
// and overwrites it — misleading during the interim window.
const newConceptRow = (conceptKey, result, trustServerRerank = false) => ({
  concept_key: conceptKey,
  rerank_score: trustServerRerank && typeof result?.search_meta?.search_normalized_score === 'number'
    ? result.search_meta.search_normalized_score
    : undefined
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

  const { algorithmId, algorithmConfig, algorithmResponseId, projectContext, trustServerRerank } = ctx
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
  conceptRows.push(newConceptRow(primaryDef.key, result, trustServerRerank))

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
    result.mappings.forEach(mapping => {
      const targetDef = cascadeTargetToConceptDefinition(
        mapping,
        identityConfig.cascade_target,
        projectContext
      )
      if (!targetDef) return

      // Avoid duplicate ConceptDefinition entries within the same result.
      if (!conceptDefinitions.some(cd => cd.key === targetDef.key)) {
        conceptDefinitions.push(targetDef)
        // Cascade target's row carries no rerank_score yet — the bridge
        // response doesn't score targets, so the debounced rerank pass
        // will fill it once the row is eligible.
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
    })
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
    rawResponse,
    trustServerRerank
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

  results.forEach(result => {
    const { candidates, concept_definitions, concept_rows } = normalizeAlgoResult(result, {
      algorithmId,
      algorithmConfig,
      algorithmResponseId: algorithmResponse.id,
      projectContext,
      trustServerRerank
    })
    allCandidates.push(...candidates)
    concept_definitions.forEach(cd => {
      const existing = defsByKey.get(cd.key)
      // Prefer richer definitions: never overwrite a 'full' with a 'pending'.
      if (!existing || lookupStatusRank(cd.lookup_status) > lookupStatusRank(existing.lookup_status)) {
        defsByKey.set(cd.key, cd)
      }
    })
    concept_rows.forEach(cr => {
      if (!rowsByKey.has(cr.concept_key)) {
        rowsByKey.set(cr.concept_key, cr)
      }
    })
  })

  return {
    algorithm_response: algorithmResponse,
    candidates: allCandidates,
    concept_definitions: Array.from(defsByKey.values()),
    concept_rows: Array.from(rowsByKey.values())
  }
}

const LOOKUP_RANK = { pending: 0, failed: 0, partial: 1, full: 2 }
export const lookupStatusRank = (status) => LOOKUP_RANK[status] ?? 0

/**
 * Filter a ConceptDefinition.property[] dict array to the subset the project
 * considers identifying — repoVersion.meta.display.concept_summary_properties
 * (e.g. for LOINC: COMPONENT / PROPERTY / TIME_ASPCT / SYSTEM / SCALE_TYP /
 * METHOD). Producer-side volume control for the AI Assistant v2 payload's
 * recommendable_concepts[*].property push.
 *
 * Returns:
 *   - undefined  when `property` is missing/empty (essentializer drops the key)
 *   - `property` whole when no summary list is configured (FHIR-passthrough
 *     sources, or repos that haven't pinned summary properties)
 *   - filtered subset matching the summary codes otherwise
 *
 * Pure: no lodash, no React.
 */
export const filterPropertyBySummary = (property, summaryCodes) => {
  if (!Array.isArray(property) || property.length === 0) return undefined
  if (!Array.isArray(summaryCodes) || summaryCodes.length === 0) return property
  const set = new Set(summaryCodes)
  return property.filter(p => p?.code && set.has(p.code))
}

/**
 * Compact a property[] array to a `{code: value}` object for the AI Assistant
 * payload. PR3-D3-lite (L-5): saves ~50% bytes vs. the FHIR-aligned
 * `[{code, valueCoding}, ...]` shape by elimminating per-entry overhead. The
 * LLM reads property values by axis name in plain English (per the LOINC
 * system prompt's axis-by-axis methodology); the wire shape doesn't matter.
 *
 * Safe fallback: FHIR allows a CodeSystem.property `code` to repeat within a
 * single concept (e.g. multiple `parent` codes). If any code appears twice,
 * the original array is returned unchanged so no values are lost to map
 * collision. LOINC's identifying axes (COMPONENT, PROPERTY, etc.) are unique
 * per concept; ICD-11 / SNOMED edge cases preserve the array form.
 *
 * Pure.
 */
export const compactProperty = (property) => {
  if (!Array.isArray(property) || property.length === 0) return property
  const seen = new Set()
  for (const p of property) {
    const code = p?.code
    if (!code) return property
    if (seen.has(code)) return property
    seen.add(code)
  }
  const obj = {}
  for (const p of property) {
    obj[p.code] = p.valueCoding ?? p.value ?? null
  }
  return obj
}

/**
 * Reduce a locale tag to its primary subtag (the part before any `-`),
 * lowercased. `en-US` → `en`, `pt-BR` → `pt`, `EN` → `en`. Empty/nullish
 * input returns `''`. Pure.
 */
export const primarySubtag = (locale) => {
  if (!locale || typeof locale !== 'string') return ''
  const idx = locale.indexOf('-')
  return (idx === -1 ? locale : locale.slice(0, idx)).toLowerCase()
}

/**
 * Reduce a list of locale tags to the unique set of primary subtags.
 * `['en', 'en-US', 'PT-br']` → `['en', 'pt']`. Preserves first-seen order.
 * Pure.
 */
export const uniqByPrimarySubtag = (locales) => {
  if (!Array.isArray(locales)) return []
  const seen = new Set()
  const out = []
  for (const l of locales) {
    const tag = primarySubtag(l)
    if (!tag || seen.has(tag)) continue
    seen.add(tag)
    out.push(tag)
  }
  return out
}

/**
 * Trim a single `names[*]` entry to the fields the LLM actually consumes.
 * Drops `external_id` (upstream-system identifier, useless to the LLM).
 * Keeps `name_type` when set (semantically meaningful — fully-specified
 * vs. synonym vs. index term carries weight for match-recommendation).
 * Emits `locale_preferred` only when literally `true` (mirrors the
 * truthy-only pattern used for `retired`).
 *
 * Pure.
 */
const trimName = (n) => {
  if (!n) return n
  const out = { name: n.name, locale: n.locale }
  if (n.name_type) out.name_type = n.name_type
  if (n.locale_preferred === true) out.locale_preferred = true
  return out
}

/**
 * Trim a single `descriptions[*]` entry. Drops `external_id`. Keeps `type`
 * (description-types like `Definition` / `Usage` carry meaning).
 *
 * Pure.
 */
const trimDescription = (d) => {
  if (!d) return d
  const out = { description: d.description, locale: d.locale }
  if (d.type) out.type = d.type
  if (d.locale_preferred === true) out.locale_preferred = true
  return out
}

/**
 * Filter a list of `names[*]` entries by primary-subtag match against the
 * effective locale set, then trim each surviving entry to the LLM-relevant
 * fields. Names with no `locale` field pass through (defensive — typically
 * canonical fully-specified names that lost their tag in upstream processing).
 *
 * Behavior:
 *   - `effectiveLocales` empty/missing → identity locale-wise (every entry
 *     survives the filter) but `trimName` is still applied. This is the
 *     backwards-compatible path for old projects with neither `input_locale`
 *     nor `filters.locale` set; they pay the structural-trim savings but
 *     keep their full multi-locale set.
 *   - `effectiveLocales` populated → keep entries whose locale's primary
 *     subtag is in the set (case-insensitive), plus entries with no locale.
 *
 * Pure.
 */
export const filterAndTrimNames = (names, effectiveLocales) => {
  if (!Array.isArray(names)) return names
  const set = new Set(uniqByPrimarySubtag(effectiveLocales))
  const filterActive = set.size > 0
  const out = []
  for (const n of names) {
    if (!n) continue
    if (filterActive && n.locale) {
      const tag = primarySubtag(n.locale)
      if (tag && !set.has(tag)) continue
    }
    out.push(trimName(n))
  }
  return out
}

/**
 * Filter+trim companion for `descriptions[*]`. Same locale semantics as
 * `filterAndTrimNames`. Pure.
 */
export const filterAndTrimDescriptions = (descriptions, effectiveLocales) => {
  if (!Array.isArray(descriptions)) return descriptions
  const set = new Set(uniqByPrimarySubtag(effectiveLocales))
  const filterActive = set.size > 0
  const out = []
  for (const d of descriptions) {
    if (!d) continue
    if (filterActive && d.locale) {
      const tag = primarySubtag(d.locale)
      if (tag && !set.has(tag)) continue
    }
    out.push(trimDescription(d))
  }
  return out
}

/**
 * Build a single recommendable_concepts[*] entry for the AI Assistant v2
 * payload. Pure projection — no React, no refs. The MapProject component
 * calls this once per (target-canonical) ConceptDefinition while walking
 * defsByKey in buildV2RecommendationPayload.
 *
 * PR3-D3-lite trims applied here:
 *   - L-2: `ocl_url` dropped (UI deeplink; LLM doesn't use it).
 *   - L-5: `property` compacted via `compactProperty` (FHIR array → object).
 *   - L-8: `descriptions` omitted when the source array is empty.
 *
 * PR3-H trims applied here:
 *   - `names`/`descriptions` filtered by primary-subtag match against
 *     `effectiveLocales` (empty set → no locale filter, identity behavior).
 *   - Per-entry structural trim: drop `external_id` always; emit
 *     `locale_preferred` only when `true`.
 *
 * L-3 (drop constant `concept_class` / `datatype` across the surfaced set) is
 * applied by the caller AFTER this function builds each entry, since the
 * homogeneity check requires the full set.
 *
 * @param {Object} args
 * @param {Object} args.def                  ConceptDefinition (from conceptCache or normalizer output)
 * @param {string} args.key                  the concept_key
 * @param {Array<Object>} args.evidence      [{algorithm_id, candidate_type, score, highlights, via?}, ...]
 * @param {Object} [args.rowState]           rowMatchState[rowIndex] — provides rerank_score per concept_key
 * @param {Array<string>} [args.summaryPropertyCodes] target_repo summary property codes (optional filter)
 * @param {Array<string>} [args.effectiveLocales]     PR3-H union of (input_locale, filters.locale); empty = no locale filter
 */
export const buildRecommendableConceptEntry = ({
  def, key, evidence, rowState, summaryPropertyCodes, effectiveLocales
}) => {
  const filteredNames = filterAndTrimNames(def.names, effectiveLocales)
  const filteredDescriptions = filterAndTrimDescriptions(def.descriptions, effectiveLocales)
  const entry = {
    concept_key: key,
    canonical_reference: def.reference,
    display_name: def.display_name,
    names: filteredNames,
    concept_class: def.concept_class,
    datatype: def.datatype,
    property: compactProperty(filterPropertyBySummary(def.property, summaryPropertyCodes)),
    rerank_score: rowState?.concept_rows?.[key]?.rerank_score,
    evidence
  }
  if (Array.isArray(filteredDescriptions) && filteredDescriptions.length > 0)
    entry.descriptions = filteredDescriptions
  if (def.retired === true) entry.retired = true
  return entry
}

/**
 * Apply L-3 (drop constant `concept_class` / `datatype`) across a built
 * recommendable_concepts[] set. If ALL entries share the same value on
 * either field, that field is removed from every entry — it carries zero
 * discriminatory signal for the LLM in the homogeneous case. If the
 * surfaced set is heterogeneous on the field, the field is kept on every
 * entry as today.
 *
 * Pure. Mutates entries in place.
 */
export const stripConstantClassAndDatatype = (entries) => {
  if (!Array.isArray(entries) || entries.length < 2) return entries
  for (const field of ['concept_class', 'datatype']) {
    const values = entries.map(e => e[field])
    const first = values[0]
    if (first !== undefined && values.every(v => v === first)) {
      for (const e of entries) delete e[field]
    }
  }
  return entries
}

/**
 * Backfill rowMatchState + ConceptDefinitions from the legacy
 * `allCandidates` shape (a saved-project artifact: `{ [algoId]: [{row,
 * results}, ...] }`). Called on project load so that v1-saved projects
 * render correctly under UNIFIED_MODEL_ENABLED=true. A precursor to
 * PR3's `normalizeLegacy.js`.
 *
 * Pure function: no React, no APIService, no mutation of inputs.
 *
 * @param {Object} allCandidates       { [algoId]: [{row, results}, ...] }
 * @param {Object} projectContext      {namespace, target_repo, bridge_repo?}
 * @param {Array}  algorithms          algo defs (may carry concept_identity)
 * @param {Object} [conceptIdentityByType] optional fallback map for algos
 *                                     missing concept_identity (e.g. API-
 *                                     loaded bridge/scispacy variants).
 * @returns {{
 *   rowMatchState: Object,            keyed by row __index
 *   conceptDefinitionsByKey: Map<string, ConceptDefinition>
 * }}
 */
export const normalizeLegacyAllCandidates = (
  allCandidates,
  projectContext,
  algorithms,
  conceptIdentityByType = {}
) => {
  const rowMatchState = {}
  const conceptDefinitionsByKey = new Map()
  if(!allCandidates || !projectContext) return { rowMatchState, conceptDefinitionsByKey }

  const algoById = new Map((algorithms || []).map(a => [a.id, a]))

  Object.entries(allCandidates).forEach(([algoId, rowEntries]) => {
    const algoDef = algoById.get(algoId)
    // Orphan-algo recovery (PR3-C / ocl_issues#2555): when the tag isn't a
    // configured algo (reconfigured / mistagged project) or yields no identity,
    // fall back to a result-derived identity instead of dropping the entries.
    const algoConfig = algoDef?.concept_identity
      ? algoDef
      : (algoDef && conceptIdentityByType[algoDef.type]
        ? { ...algoDef, concept_identity: conceptIdentityByType[algoDef.type] }
        : { id: algoId, concept_identity: { reference_source: 'result', code_field: 'id', ocl_url_field: 'url' } })

    ;(rowEntries || []).forEach(rowEntry => {
      const idx = rowEntry?.row?.__index
      if(idx === undefined || idx === null) return

      const normalized = normalizeAlgorithmInvocation(
        { row: rowEntry.row, results: rowEntry.results || [] },
        {
          algorithmId: algoId,
          algorithmConfig: algoConfig,
          projectContext,
          rowIndex: idx,
          // Saved-project legacy data: search_normalized_score was persisted
          // from a prior session's $rerank/ output, so it IS the canonical
          // rerank score. Honor it (no client-side rerank will fire for
          // already-loaded rows).
          trustServerRerank: true
        }
      )

      const prevRow = rowMatchState[idx] || {
        algorithm_responses: {},
        candidates: {},
        concept_rows: {}
      }
      const nextRow = {
        algorithm_responses: {
          ...prevRow.algorithm_responses,
          [normalized.algorithm_response.id]: normalized.algorithm_response
        },
        candidates: { ...prevRow.candidates },
        concept_rows: { ...prevRow.concept_rows }
      }
      normalized.candidates.forEach(c => { nextRow.candidates[c.id] = c })
      normalized.concept_rows.forEach(cr => {
        const existing = nextRow.concept_rows[cr.concept_key]
        // Existing entry keeps its rerank_score (richer wins); new arrivals
        // are taken only when no entry exists yet.
        if(!existing) nextRow.concept_rows[cr.concept_key] = cr
        else if(existing.rerank_score === undefined && cr.rerank_score !== undefined)
          nextRow.concept_rows[cr.concept_key] = cr
      })
      rowMatchState[idx] = nextRow

      normalized.concept_definitions.forEach(def => {
        const existing = conceptDefinitionsByKey.get(def.key)
        if(!existing || lookupStatusRank(def.lookup_status) > lookupStatusRank(existing.lookup_status))
          conceptDefinitionsByKey.set(def.key, def)
      })
    })
  })

  return { rowMatchState, conceptDefinitionsByKey }
}
