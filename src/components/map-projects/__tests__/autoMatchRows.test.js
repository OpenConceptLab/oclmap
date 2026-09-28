import test from 'node:test'
import assert from 'node:assert/strict'

import {
  getPreviewEligibleRowIndexes, getRowsToProcess, spendsMatchQuota, getRowCapByMatchOperations, shouldStopAIStep,
  getAIRequestIdempotencyKey, getCandidatePoolFingerprint, hasCurrentAnalysis, getScispacyRowResults, getPendingRowLookups, waitForLookups
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

test('getAIRequestIdempotencyKey: one key per project, row and request, whatever the retry attempt', () => {
  assert.equal(getAIRequestIdempotencyKey('p1', 3, 1700000000000), 'p1-3-1700000000000')
  assert.notEqual(getAIRequestIdempotencyKey('p1', 3, 1700000000000), getAIRequestIdempotencyKey('p1', 4, 1700000000000))
  assert.notEqual(getAIRequestIdempotencyKey('p1', 3, 1700000000000), getAIRequestIdempotencyKey('p1', 3, 1700000009999))
})

// ocl_online#258: a bulk re-run skipped the AI for any row analysed before,
// so a row kept the verdict from its old candidate pool.
const pool = (...entries) => entries.map(([concept_key, ...algos]) => ({
  concept_key, rerank_score: Math.random() * 100, evidence: algos.map(algorithm_id => ({ algorithm_id, score: Math.random() })),
}))

test('getCandidatePoolFingerprint: the same concepts from the same algorithms give the same fingerprint, in any order and at any score', () => {
  const a = pool(['loinc|2336-6', 'ocl-semantic'], ['loinc|10834-0', 'ocl-search', 'ocl-semantic'])
  const b = pool(['loinc|10834-0', 'ocl-semantic', 'ocl-search'], ['loinc|2336-6', 'ocl-semantic'])
  assert.equal(getCandidatePoolFingerprint(a), getCandidatePoolFingerprint(b))
})

test('getCandidatePoolFingerprint: a new concept, a dropped one, or another algorithm backing one changes it', () => {
  const before = getCandidatePoolFingerprint(pool(['loinc|2336-6', 'ocl-search']))
  assert.notEqual(getCandidatePoolFingerprint(pool(['loinc|2336-6', 'ocl-search'], ['loinc|10834-0', 'ocl-semantic'])), before)
  assert.notEqual(getCandidatePoolFingerprint(pool()), before)
  assert.notEqual(getCandidatePoolFingerprint(pool(['loinc|2336-6', 'ocl-search', 'ocl-scispacy-loinc'])), before)
})

test('getCandidatePoolFingerprint: another bridge, or another map type through it, changes it', () => {
  const viaBridge = (bridgeKey, mapType) => [{
    concept_key: 'loinc|2336-6', display_name: 'Globulin',
    evidence: [{ algorithm_id: 'ocl-bridge', candidate_type: 'bridge_child', score: 1, via: { bridge_concept_key: bridgeKey, bridge_map_type: mapType } }],
  }]
  const before = getCandidatePoolFingerprint(viaBridge('ciel|1', 'SAME-AS'))
  assert.notEqual(getCandidatePoolFingerprint(viaBridge('ciel|2', 'SAME-AS')), before)
  assert.notEqual(getCandidatePoolFingerprint(viaBridge('ciel|1', 'NARROWER-THAN')), before)
  assert.equal(getCandidatePoolFingerprint(viaBridge('ciel|1', 'SAME-AS')), before)
})

test('getCandidatePoolFingerprint: a concept a later lookup filled in changes it', () => {
  // a failed lookup leaves the concept with its name only; a later run's
  // lookup adds its names and properties, which the AI then sees
  const sparse = [{ concept_key: 'loinc|2336-6', display_name: 'Globulin', evidence: [{ algorithm_id: 'ocl-scispacy-loinc' }] }]
  const full = [{ ...sparse[0], names: [{ name: 'Globulin [Mass/volume] in Serum', locale: 'en' }], property: { SYSTEM: 'Ser', COMPONENT: 'Globulin' } }]
  assert.notEqual(getCandidatePoolFingerprint(full), getCandidatePoolFingerprint(sparse))
})

test('getCandidatePoolFingerprint: scores, highlights and key order are left out', () => {
  const a = [{ concept_key: 'k', display_name: 'X', rerank_score: 91, property: { A: 1, B: 2 }, evidence: [{ algorithm_id: 'ocl-search', score: 7, highlights: { name: ['<em>X</em>'] } }] }]
  const b = [{ property: { B: 2, A: 1 }, evidence: [{ highlights: { name: ['X'] }, score: 3, algorithm_id: 'ocl-search' }], rerank_score: 40, display_name: 'X', concept_key: 'k' }]
  assert.equal(getCandidatePoolFingerprint(a), getCandidatePoolFingerprint(b))
})

test('getCandidatePoolFingerprint: no pool has no fingerprint', () => {
  assert.equal(getCandidatePoolFingerprint(undefined), null)
  assert.equal(getCandidatePoolFingerprint(null), null)
})

test('hasCurrentAnalysis: only the latest analysis of the same pool counts', () => {
  const fp = getCandidatePoolFingerprint(pool(['loinc|2336-6', 'ocl-search']))
  const other = getCandidatePoolFingerprint(pool(['loinc|2336-6', 'ocl-semantic']))
  assert.equal(hasCurrentAnalysis([{ candidate_pool_fingerprint: fp }], fp), true)
  assert.equal(hasCurrentAnalysis([{ candidate_pool_fingerprint: other }], fp), false)
  assert.equal(hasCurrentAnalysis([{ candidate_pool_fingerprint: fp }, { candidate_pool_fingerprint: other }], fp), false)
})

test('hasCurrentAnalysis: an analysis saved before fingerprints existed is redone', () => {
  const fp = getCandidatePoolFingerprint(pool(['loinc|2336-6', 'ocl-search']))
  assert.equal(hasCurrentAnalysis([{ output: { recommendation: 'RECOMMEND' } }], fp), false)
})

test('hasCurrentAnalysis: no analysis yet, or no pool to compare, is not current', () => {
  const fp = getCandidatePoolFingerprint(pool(['loinc|2336-6', 'ocl-search']))
  assert.equal(hasCurrentAnalysis([], fp), false)
  assert.equal(hasCurrentAnalysis(undefined, fp), false)
  assert.equal(hasCurrentAnalysis([{ candidate_pool_fingerprint: null }], null), false)
})

// ocl_online#258: the bulk ScispaCy path read each row's results by its
// position in the run instead of its row index, so a Selected Rows re-run
// (rows 61–70 at positions 0–9) got no ScispaCy candidates.
test('getScispacyRowResults: reads the row\'s own results, keyed by its row index', () => {
  const data = { 60: [{ code: 'A' }], 61: [{ code: 'B' }] }
  assert.deepEqual(getScispacyRowResults(data, 60), [{ code: 'A' }])
  assert.deepEqual(getScispacyRowResults(data, 61), [{ code: 'B' }])
  assert.deepEqual(getScispacyRowResults(data, 0), [])
  assert.deepEqual(getScispacyRowResults({ '7': [{ code: 'C' }] }, 7), [{ code: 'C' }])
  assert.deepEqual(getScispacyRowResults(undefined, 7), [])
})

// ocl_online#258 review: after a rerank quota stop a row's AI step can come
// before its lookups settle, so it waits for them the way rerank does.
test('getPendingRowLookups: the in-flight lookups for the row\'s own concepts only', () => {
  const a = Promise.resolve('a')
  const c = Promise.resolve('c')
  const inFlight = new Map([['k:a', a], ['k:c', c]])
  const rowState = { concept_rows: { 'k:a': {}, 'k:b': {} } }
  assert.deepEqual(getPendingRowLookups(rowState, inFlight), [a])
  assert.deepEqual(getPendingRowLookups({ concept_rows: {} }, inFlight), [])
  assert.deepEqual(getPendingRowLookups(undefined, inFlight), [])
})

// Codex pass 2: a lookup can stay pending for good (APIService.post answers a
// 429 with a promise that never settles), so the AI step's wait is bounded.
test('waitForLookups: resolves true once every lookup settles', async () => {
  assert.equal(await waitForLookups([Promise.resolve(1), Promise.resolve(2)], 1000), true)
  assert.equal(await waitForLookups([], 1000), true)
})

test('waitForLookups: gives up after the timeout when a lookup never settles', async () => {
  const started = Date.now()
  assert.equal(await waitForLookups([new Promise(() => {})], 30), false)
  assert.ok(Date.now() - started < 1000)
})

test('waitForLookups: a rejected lookup counts as settled', async () => {
  assert.equal(await waitForLookups([Promise.reject(new Error('x'))], 1000), true)
})
