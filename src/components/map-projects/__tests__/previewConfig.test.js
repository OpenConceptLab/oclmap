import test from 'node:test'
import assert from 'node:assert/strict'

import { getPreviewAlgorithmOptions, getPreviewConfigAccessErrors } from '../previewConfig.js'

const algos = [
  { id: 'search', type: 'ocl-search', provider: 'ocl' },
  { id: 'semantic', type: 'ocl-semantic', provider: 'ocl' },
  { id: 'bridge', type: 'ocl-bridge', provider: 'ocl' },
  { id: 'custom', type: 'custom', provider: 'external' },
]

test('getPreviewAlgorithmOptions hides custom algorithms when the user lacks access', () => {
  const result = getPreviewAlgorithmOptions({
    algos,
    canUseCustomAlgorithms: false,
    canBridge: true,
  })

  assert.deepEqual(result.map(algo => algo.type), ['ocl-search', 'ocl-semantic', 'ocl-bridge'])
})

test('getPreviewAlgorithmOptions keeps a selected custom algorithm visible but disabled', () => {
  const result = getPreviewAlgorithmOptions({
    algos,
    algosSelected: [{ id: 'custom', type: 'custom' }],
    canUseCustomAlgorithms: false,
    canBridge: true,
  })

  const custom = result.find(algo => algo.type === 'custom')
  assert.equal(custom?.disabled, true)
})

test('getPreviewConfigAccessErrors blocks org owners without org-project access', () => {
  assert.deepEqual(
    getPreviewConfigAccessErrors({
      owner: '/orgs/demo/',
      userUrl: '/users/me/',
      canUseOrgProjects: false,
    }),
    ['org_projects']
  )
})

test('getPreviewConfigAccessErrors blocks selected custom algorithms without custom access', () => {
  assert.deepEqual(
    getPreviewConfigAccessErrors({
      owner: '/users/me/',
      userUrl: '/users/me/',
      algosSelected: [{ id: 'custom', type: 'custom' }],
      canUseCustomAlgorithms: false,
    }),
    ['custom_algorithms']
  )
})

test('getPreviewConfigAccessErrors allows personal owner and built-in algorithms', () => {
  assert.deepEqual(
    getPreviewConfigAccessErrors({
      owner: '/users/me/',
      userUrl: '/users/me/',
      algosSelected: [{ id: 'search', type: 'ocl-search' }],
      canUseOrgProjects: false,
      canUseCustomAlgorithms: false,
    }),
    []
  )
})
