import test from 'node:test'
import assert from 'node:assert/strict'

import {
  getPreviewEligibleRowIndexes, getRowsToProcess, spendsMatchQuota, getRowCapByMatchOperations, shouldStopAIStep
} from '../autoMatchRows.js'

const rows = [
  { __index: 0, label: 'zero' },
  { __index: 1, label: 'one' },
  { __index: 2, label: 'two' },
  { __index: 3, label: 'three' }
]

test('getPreviewEligibleRowIndexes: returns fixed first rows in upload order', () => {
  const result = getPreviewEligibleRowIndexes(rows, { rowsPerProject: { limit: 2 } })

  assert.deepEqual(result, [0, 1])
})

test('getPreviewEligibleRowIndexes: unlimited preview returns null eligibility filter', () => {
  const result = getPreviewEligibleRowIndexes(rows, { rowsPerProject: { unlimited: true } })

  assert.equal(result, null)
})

test('getPreviewEligibleRowIndexes: missing capability (limit null) blocks every row', () => {
  const result = getPreviewEligibleRowIndexes(rows, { rowsPerProject: { limit: null } })

  assert.deepEqual(result, [])
})

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

test('getRowsToProcess: allIncludingApproved scope includes every row', () => {
  const result = getRowsToProcess(
    rows,
    { unmapped: [0, 2], readyForReview: [1], reviewed: [3] },
    'allIncludingApproved',
    [3]
  )

  assert.deepEqual(result.map(row => row.__index), [0, 1, 2, 3])
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

test('getRowsToProcess: preview eligibility excludes rows outside the fixed upload-order allowance', () => {
  const result = getRowsToProcess(
    rows,
    { unmapped: [0, 1, 2, 3], readyForReview: [], reviewed: [] },
    'allIncludingApproved',
    [],
    [0, 1]
  )

  assert.deepEqual(result.map(row => row.__index), [0, 1])
})

test('getRowsToProcess: selected scope ignores selected rows outside preview eligibility', () => {
  const result = getRowsToProcess(
    rows,
    { unmapped: [0, 1, 2, 3], readyForReview: [], reviewed: [] },
    'selected',
    [1, 3],
    [0, 1, 2]
  )

  assert.deepEqual(result.map(row => row.__index), [1])
})

test('getRowsToProcess: invalid rows input returns empty array', () => {
  assert.deepEqual(
    getRowsToProcess(false, { unmapped: [0], readyForReview: [], reviewed: [] }, 'unmapped', [0]),
    []
  )
})

test('spendsMatchQuota: only algorithms that call $match spend match quota', () => {
  assert.equal(spendsMatchQuota({ type: 'ocl-search' }), true)
  assert.equal(spendsMatchQuota({ type: 'ocl-semantic' }), true)
  assert.equal(spendsMatchQuota({ type: 'ocl-scispacy' }), false)
  assert.equal(spendsMatchQuota({ type: 'custom', url: 'https://example.org/match' }), false)
  assert.equal(spendsMatchQuota({ type: 'custom' }), true)
  assert.equal(spendsMatchQuota({ type: 'ocl-ciel-bridge' }, { canBridge: false }), false)
  assert.equal(spendsMatchQuota({ type: 'ocl-ciel-bridge' }, { canBridge: true }), true)
  assert.equal(spendsMatchQuota(null), false)
})

test('getRowCapByMatchOperations: divides remaining operations by $match algorithms', () => {
  assert.equal(getRowCapByMatchOperations({ remaining: 50 }, 2), 25)
  assert.equal(getRowCapByMatchOperations({ remaining: 5 }, 2), 2)
  assert.equal(getRowCapByMatchOperations({ remaining: 0 }, 1), 0)
  assert.equal(getRowCapByMatchOperations({ unlimited: true }, 2), null)
  assert.equal(getRowCapByMatchOperations({ remaining: 10 }, 0), null)
})

test('shouldStopAIStep: keeps going with no failures', () => {
  assert.equal(shouldStopAIStep({ quotaExhausted: false, failuresInARow: 0 }), false)
})

test('shouldStopAIStep: one failed row does not stop the AI step', () => {
  assert.equal(shouldStopAIStep({ quotaExhausted: false, failuresInARow: 1 }), false)
})

test('shouldStopAIStep: two failed rows in a row stop the AI step', () => {
  assert.equal(shouldStopAIStep({ quotaExhausted: false, failuresInARow: 2 }), true)
})

test('shouldStopAIStep: a spent AI quota stops the AI step', () => {
  assert.equal(shouldStopAIStep({ quotaExhausted: true, failuresInARow: 0 }), true)
})
