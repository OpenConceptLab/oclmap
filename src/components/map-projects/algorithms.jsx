import React from 'react'
import MatchingIcon from '@mui/icons-material/DeviceHub';

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
      // Canonical concept identity (plans/unified-mapper-model.md). Concepts
      // returned by ocl-semantic come from the project's target repo, so the
      // canonical URL of each concept is the target repo's canonical URL.
      'concept_identity': {
        'reference_source': 'target_repo',
        'code_field': 'id',
        'ocl_url_field': 'url'
      }
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
      'concept_identity': {
        'reference_source': 'target_repo',
        'code_field': 'id',
        'ocl_url_field': 'url'
      }
    },
  ]
  return algos
}
