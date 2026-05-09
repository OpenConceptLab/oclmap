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
  }
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
