import React from 'react'
import MatchingIcon from '@mui/icons-material/DeviceHub';

// Canonical concept-identity config per algorithm type
// (plans/unified-mapper-model.md). Single source of truth shared between
// algorithms defined here (ocl-semantic, ocl-search) and algorithms loaded
// from the OCL Online API (ocl-bridge, ocl-ciel-bridge, ocl-scispacy);
// MapProject's getAlgoDef merges the missing concept_identity at lookup time.
export const CONCEPT_IDENTITY_BY_TYPE = {
  'ocl-semantic': {
    'reference_source': 'target_repo',
    'code_field': 'id',
    'ocl_url_field': 'url'
  },
  'ocl-search': {
    'reference_source': 'target_repo',
    'code_field': 'id',
    'ocl_url_field': 'url'
  },
  'ocl-bridge': {
    'reference_source': 'bridge_repo',
    'code_field': 'id',
    'ocl_url_field': 'url',
    'cascade_target': {
      'reference_source': 'target_repo',
      'code_field': 'cascade_target_concept_code',
      'ocl_url_field': 'cascade_target_concept_url'
    }
  },
  'ocl-ciel-bridge': {
    'reference_source': 'bridge_repo',
    'code_field': 'id',
    'ocl_url_field': 'url',
    'cascade_target': {
      'reference_source': 'target_repo',
      'code_field': 'cascade_target_concept_code',
      'ocl_url_field': 'cascade_target_concept_url'
    }
  },
  // Scispacy returns LOINC codes only — fixed canonical, no OCL URL on the
  // result. fromScispacyResultsToConcepts in MapProject.jsx maps LOINC_NUM
  // into `id` before normalization, so code_field='id' resolves correctly.
  'ocl-scispacy': {
    'reference_source': 'fixed',
    'canonical_url': 'http://loinc.org',
    'code_field': 'id'
  }
}

// Cheap structural validator for canonical URLs. The unified mapper model
// requires every algorithm's concept_identity.canonical_url to be a URL —
// custom algos rely on user input for this, so the form validates here.
export const isLikelyCanonicalUrl = (value) => {
  if(!value || typeof value !== 'string') return false
  return /^https?:\/\/[^\s]+$/i.test(value.trim())
}

// Walk algosSelected and return the subset that fails project-config
// validation. Currently: custom algos must have a valid canonical_url.
// (plans/unified-mapper-model.md "Algorithm concept_identity configuration —
// Custom algorithm".) Returns [{algo, reason}] for diagnostic banners.
export const getProjectConfigErrors = (algosSelected) => {
  const errors = []
  ;(algosSelected || []).forEach(algo => {
    if(algo?.type === 'custom' && !isLikelyCanonicalUrl(algo.canonical_url))
      errors.push({ algo, reason: 'missing_canonical_url' })
  })
  return errors
}

// Return a copy of `algo` with `concept_identity` populated. Three sources,
// in priority order:
//   1. algo.concept_identity already set (native built-in algos define this
//      inline in useAlgos below)
//   2. CONCEPT_IDENTITY_BY_TYPE[algo.type] (API-loaded algos: bridge, scispacy)
//   3. For custom algos: derive from algo.canonical_url (user-entered)
// Returns null when none of these can produce a usable concept_identity —
// callers must skip normalization for that algo. This is the single
// integration point for all read/write paths (getAlgoDef, normalizer load,
// bulk processBatch, lookupCandidates).
export const ensureConceptIdentity = (algo) => {
  if(!algo) return null
  if(algo.concept_identity) return algo
  if(CONCEPT_IDENTITY_BY_TYPE[algo.type])
    return { ...algo, concept_identity: CONCEPT_IDENTITY_BY_TYPE[algo.type] }
  if(algo.type === 'custom' && algo.canonical_url)
    return { ...algo, concept_identity: { reference_source: 'fixed', canonical_url: algo.canonical_url, code_field: 'id' } }
  return null
}

export const useAlgos = (t, toggles) => {
  const algos = [
    {
      'id': 'ocl-semantic',
      'getIcon': (props) => <MatchingIcon color='primary' {...props} />,
      'name': t('map_project.ocl_semantic_algorithm'),
      'description': t('map_project.algorithm_llm_description'),
      'type': 'ocl-semantic',
      'provider': 'ocl',
      'batch_size': 10,
      'concurrent_requests': 2,
      'query_params': {
        'semantic': true
      },
      'disabled': !toggles.SEMANTIC_SEARCH_TOGGLE,
      'allow_multiple': false,
      'lookup_required': false,
      'concept_identity': CONCEPT_IDENTITY_BY_TYPE['ocl-semantic']
    },
    {
      'id': 'ocl-search',
      'getIcon': (props) => <MatchingIcon {...props} />,
      'name': t('map_project.ocl_search_algorithm'),
      'description': t('map_project.algorithm_es_description'),
      'type': 'ocl-search',
      'provider': 'ocl',
      'batch_size': 50,
      'concurrent_requests': 2,
      'disabled': false,
      'allow_multiple': false,
      'lookup_required': false,
      'concept_identity': CONCEPT_IDENTITY_BY_TYPE['ocl-search']
    },
  ]
  return algos
}
