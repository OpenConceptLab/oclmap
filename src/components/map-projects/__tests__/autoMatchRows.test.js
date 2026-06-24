import test from 'node:test'
import assert from 'node:assert/strict'

import { getRowsToProcess } from '../autoMatchRows.js'

const rows = [
  { __index: 0, label: 'zero' },
  { __index: 1, label: 'one' },
  { __index: 2, label: 'two' },
  { __index: 3, label: 'three' }
]

test('getRowsToProcess: unmapped scope includes only unmapped rows', () => {
  const result = getRowsToProcess(
    rows,
    { unmapped: [0, 2], readyForReview: [1], reviewed: [3] },
    'unmapped',
    [1, 3]
  )

  assert.deepEqual(result.map(row => row.__index), [0, 2])
})

test('getRowsToProcess: selected scope includes only selected rows, even when reviewed', () => {
  const result = getRowsToProcess(
    rows,
    { unmapped: [0], readyForReview: [1], reviewed: [2, 3] },
    'selected',
    [1, 3]
  )

  assert.deepEqual(result.map(row => row.__index), [1, 3])
})

test('getRowsToProcess: all scope excludes reviewed rows and keeps unmapped plus proposed', () => {
  const result = getRowsToProcess(
    rows,
    { unmapped: [0, 2], readyForReview: [1], reviewed: [3] },
    'all',
    [3]
  )

  assert.deepEqual(result.map(row => row.__index), [0, 1, 2])
})

test('getRowsToProcess: selected scope preserves table row order, not selection order', () => {
  const result = getRowsToProcess(
    rows,
    { unmapped: [0, 2], readyForReview: [1], reviewed: [3] },
    'selected',
    [3, 1]
  )

  assert.deepEqual(result.map(row => row.__index), [1, 3])
})

test('getRowsToProcess: invalid rows input returns empty array', () => {
  assert.deepEqual(
    getRowsToProcess(false, { unmapped: [0], readyForReview: [], reviewed: [] }, 'unmapped', [0]),
    []
  )
})
