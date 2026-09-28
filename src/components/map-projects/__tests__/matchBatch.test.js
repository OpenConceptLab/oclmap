/**
 * Bulk Auto Match $match batches (ocl_online#257).
 *
 * A $match call that gets no answer, or a 5xx, used to resolve as a success
 * with no candidates: its rows were marked done and logged algo_finished, and
 * the AutomatchRun reported them completed. runMatchBatch must mark them
 * failed (-2) instead, after retrying transient failures.
 *
 * Run with: npm test
 */

import test from 'node:test'
import assert from 'node:assert/strict'

import { formatRowNumbers, isRetryableMatchError, runMatchBatch, requestSingleMatch } from '../matchBatch.js'
import { createLatestRequestGate } from '../aiVisibility.js'

const NO_WAIT = {baseDelayMs: 0}

// axios rejects with an error carrying isAxiosError; no `response` means the
// request never got an answer (connection reset, DNS, CORS-less gateway page).
const networkError = () => Object.assign(new Error('Network Error'), {isAxiosError: true, code: 'ERR_NETWORK'})
const httpError = (status, data = {}) => Object.assign(new Error(`Request failed with status code ${status}`), {
  isAxiosError: true, code: 'ERR_BAD_RESPONSE', response: {status, data},
})
const ok = data => ({status: 200, data})

const recorder = () => {
  const stages = {}
  const finished = []
  const failed = []
  return {
    stages, finished, failed,
    setStage: (index, stage) => { stages[index] = [...(stages[index] || []), stage] },
    onRowFinished: index => finished.push(index),
    onRowFailed: (index, failure) => failed.push({index, ...failure}),
  }
}

test('runMatchBatch: a network error on one batch fails only that batch; the other batches keep their results', async () => {
  const rec = recorder()
  const batches = [[0, 1], [2, 3], [4, 5]]
  const sends = {0: 0, 1: 0, 2: 0}
  const send = batchNo => async () => {
    sends[batchNo] += 1
    if(batchNo === 1) throw networkError()
    return ok(batches[batchNo].map(i => ({row: {__index: i}, results: [{id: `c${i}`}]})))
  }

  const results = await Promise.all(batches.map((rowIndexes, batchNo) =>
    runMatchBatch({rowIndexes, send: send(batchNo), ...rec, retryOptions: NO_WAIT})
  ))

  assert.deepEqual(results[0].map(r => r.row.__index), [0, 1])
  assert.deepEqual(results[1], [])
  assert.deepEqual(results[2].map(r => r.row.__index), [4, 5])
  assert.deepEqual(rec.finished.sort(), [0, 1, 4, 5])
  assert.deepEqual(rec.failed.map(f => f.index), [2, 3])
  assert.deepEqual(rec.stages, {0: [0, 1], 1: [0, 1], 2: [0, -2], 3: [0, -2], 4: [0, 1], 5: [0, 1]})
  // the failing batch was retried twice before giving up; the others went once
  assert.deepEqual(sends, {0: 1, 1: 3, 2: 1})
  assert.equal(rec.failed[0].attempts, 3)
  assert.equal(rec.failed[0].error, 'Network Error')
  assert.equal(rec.failed[0].status, null)
  assert.equal(rec.failed[0].previewLimit, false)
})

test('runMatchBatch: a transient failure that recovers on retry keeps the rows', async () => {
  const rec = recorder()
  let calls = 0
  const attemptsSeen = []
  const send = async attempt => {
    attemptsSeen.push(attempt)
    calls += 1
    if(calls === 1) throw networkError()
    return ok([{row: {__index: 7}, results: []}])
  }

  const data = await runMatchBatch({rowIndexes: [7], send, ...rec, retryOptions: NO_WAIT})

  assert.equal(data.length, 1)
  assert.deepEqual(attemptsSeen, [0, 1])
  assert.deepEqual(rec.finished, [7])
  assert.deepEqual(rec.failed, [])
})

test('runMatchBatch: a 5xx marks the rows failed with the status and detail', async () => {
  const rec = recorder()
  const send = async () => { throw httpError(500, {detail: 'boom'}) }

  const data = await runMatchBatch({rowIndexes: [0, 1], send, ...rec, retryOptions: NO_WAIT})

  assert.deepEqual(data, [])
  assert.deepEqual(rec.finished, [])
  assert.deepEqual(rec.failed.map(f => [f.index, f.status, f.error, f.attempts]), [[0, 500, 'boom', 1], [1, 500, 'boom', 1]])
})

test('runMatchBatch: gateway errors (502/503/504) are retried; a 500 is not', async () => {
  for(const status of [502, 503, 504]) {
    let calls = 0
    await runMatchBatch({rowIndexes: [0], send: async () => { calls += 1; throw httpError(status) }, ...recorder(), retryOptions: NO_WAIT})
    assert.equal(calls, 3, `status ${status}`)
  }
  let calls = 0
  await runMatchBatch({rowIndexes: [0], send: async () => { calls += 1; throw httpError(500) }, ...recorder(), retryOptions: NO_WAIT})
  assert.equal(calls, 1)
})

test('runMatchBatch: a preview-limit 403 is not retried and is handed to onPreviewLimit', async () => {
  const rec = recorder()
  const limits = []
  let calls = 0
  const send = async () => {
    calls += 1
    throw httpError(403, {error_code: 'mapper_match_operations_limit_reached', limit: 100, used: 100})
  }

  const data = await runMatchBatch({rowIndexes: [3, 4], send, ...rec, onPreviewLimit: err => limits.push(err), retryOptions: NO_WAIT})

  assert.deepEqual(data, [])
  assert.equal(calls, 1)
  assert.equal(limits.length, 1)
  assert.equal(limits[0].response.data.error_code, 'mapper_match_operations_limit_reached')
  assert.deepEqual(rec.failed.map(f => [f.index, f.previewLimit]), [[3, true], [4, true]])
})

test('runMatchBatch: a stop before a retry sends nothing more and puts the rows back to not run', async () => {
  const rec = recorder()
  let calls = 0
  let stopped = false
  const send = async () => { calls += 1; stopped = true; throw networkError() }

  const data = await runMatchBatch({rowIndexes: [0, 1], send, ...rec, shouldStop: () => stopped, retryOptions: NO_WAIT})

  assert.deepEqual(data, [])
  assert.equal(calls, 1)
  assert.deepEqual(rec.stages, {0: [0, -1], 1: [0, -1]})
  assert.deepEqual(rec.failed, [])
  assert.deepEqual(rec.finished, [])
})

test('runMatchBatch: a stop during the backoff sleep is honoured before the next send', async () => {
  const rec = recorder()
  let calls = 0
  let stopped = false
  const send = async () => {
    calls += 1
    setTimeout(() => { stopped = true }, 5)
    throw networkError()
  }

  await runMatchBatch({rowIndexes: [0], send, ...rec, shouldStop: () => stopped, retryOptions: {baseDelayMs: 40, jitterFactor: 0}})

  assert.equal(calls, 1)
  assert.deepEqual(rec.stages, {0: [0, -1]})
  assert.deepEqual(rec.failed, [])
})

test('runMatchBatch: a preview-limit 403 on one batch stops another batch that is waiting to retry', async () => {
  const rec = recorder()
  let quotaStop = false
  const sends = {a: 0, b: 0}
  const sendA = async () => { sends.a += 1; throw networkError() }
  const sendB = async () => {
    sends.b += 1
    await new Promise(resolve => setTimeout(resolve, 5))
    throw httpError(403, {error_code: 'mapper_match_operations_limit_reached'})
  }
  const common = {...rec, shouldStop: () => quotaStop, onPreviewLimit: () => { quotaStop = true }, retryOptions: {baseDelayMs: 40, jitterFactor: 0}}

  await Promise.all([
    runMatchBatch({rowIndexes: [0, 1], send: sendA, ...common}),
    runMatchBatch({rowIndexes: [2, 3], send: sendB, ...common}),
  ])

  assert.deepEqual(sends, {a: 1, b: 1})
  // batch A never got an answer and was stopped: not run, not a failure
  assert.deepEqual(rec.stages[0], [0, -1])
  assert.deepEqual(rec.stages[1], [0, -1])
  // batch B hit the limit: failed, flagged as a preview limit
  assert.deepEqual(rec.failed.map(f => [f.index, f.previewLimit]), [[2, true], [3, true]])
})

test('runMatchBatch: a batch from a cancelled run that wakes after a new run starts sends nothing and writes no stage', async () => {
  // Mirrors processBatch's wiring: the run's gate ticket guards every stage
  // write, and shouldStop checks it before abortRef, which a new run resets.
  const gate = createLatestRequestGate()
  const abortRef = {current: false}
  const ticket = gate.next()
  const isCurrentRun = () => gate.isCurrent(ticket)
  const rec = recorder()
  let calls = 0
  const send = async () => {
    calls += 1
    setTimeout(() => {
      abortRef.current = true   // the user stops the run...
      gate.next()               // ...and starts a new one,
      abortRef.current = false  // which resets abortRef
    }, 5)
    throw networkError()
  }

  await runMatchBatch({
    rowIndexes: [0], send, ...rec,
    setStage: (index, stage) => { if(isCurrentRun()) rec.setStage(index, stage) },
    shouldStop: () => !isCurrentRun() || abortRef.current,
    retryOptions: {baseDelayMs: 40, jitterFactor: 0},
  })

  assert.equal(calls, 1)
  assert.deepEqual(rec.stages, {0: [0]})
  assert.deepEqual(rec.failed, [])
})

test('runMatchBatch: a 2xx with no body resolves to no results, not a failure', async () => {
  const rec = recorder()

  const data = await runMatchBatch({rowIndexes: [0], send: async () => ({status: 200}), ...rec, retryOptions: NO_WAIT})

  assert.deepEqual(data, [])
  assert.deepEqual(rec.finished, [0])
  assert.deepEqual(rec.failed, [])
})

test('isRetryableMatchError: network errors and gateway statuses only', () => {
  assert.equal(isRetryableMatchError(networkError()), true)
  assert.equal(isRetryableMatchError(Object.assign(httpError(200), {code: 'ECONNABORTED'})), true)
  assert.equal(isRetryableMatchError(httpError(503)), true)
  assert.equal(isRetryableMatchError(httpError(500)), false)
  assert.equal(isRetryableMatchError(httpError(400)), false)
  assert.equal(isRetryableMatchError(httpError(429)), false)
  assert.equal(isRetryableMatchError(new TypeError('x is undefined')), false)
})

test('formatRowNumbers: 1-based, sorted, de-duplicated, runs collapsed', () => {
  assert.equal(formatRowNumbers([60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 110, 111, 112]), '61–70, 111–113')
  assert.equal(formatRowNumbers([4, 0, 2, 2, 1]), '1–3, 5')
  assert.equal(formatRowNumbers([9]), '10')
  assert.equal(formatRowNumbers([]), '')
})

test('formatRowNumbers: caps the number of ranges shown', () => {
  assert.equal(formatRowNumbers([0, 2, 4, 6, 8], {maxRanges: 3}), '1, 3, 5, …')
})

// ocl_online#283: the row panel's $match (and "load more") resolved a failed
// call as an empty success, so it showed "no candidates" with no error.
test('requestSingleMatch: a transient failure that recovers on retry returns the response', async () => {
  let calls = 0
  const result = await requestSingleMatch(async () => {
    calls += 1
    if(calls === 1) throw networkError()
    return ok([{ row: { __index: 3 }, results: [] }])
  }, { retryOptions: NO_WAIT })
  assert.equal(result.ok, true)
  assert.equal(result.response.data.length, 1)
  assert.equal(calls, 2)
})

test('requestSingleMatch: a network error that persists gives an error body for the row\'s failure path', async () => {
  let calls = 0
  const result = await requestSingleMatch(async () => { calls += 1; throw networkError() }, { retryOptions: NO_WAIT })
  assert.equal(calls, 3)
  assert.equal(result.ok, false)
  assert.deepEqual(result.errorBody, { detail: 'Network Error', status: null })
})

test('requestSingleMatch: gateway errors retry, a 500 fails at once with the server\'s own body', async () => {
  let calls = 0
  let result = await requestSingleMatch(async () => { calls += 1; throw httpError(503) }, { retryOptions: NO_WAIT })
  assert.equal(calls, 3)
  assert.equal(result.errorBody.status, 503)
  calls = 0
  result = await requestSingleMatch(async () => { calls += 1; throw httpError(500, { detail: 'boom' }) }, { retryOptions: NO_WAIT })
  assert.equal(calls, 1)
  // the server's own body passes through, as the row's failure path reads its detail
  assert.deepEqual(result.errorBody, { detail: 'boom' })
})

test('requestSingleMatch: a preview-limit 403 passes its body through unchanged and is not retried', async () => {
  let calls = 0
  const limit = { detail: 'Match operation limit reached.', error_code: 'mapper_match_operations_limit_reached', limit: 100, used: 100 }
  const result = await requestSingleMatch(async () => { calls += 1; throw httpError(403, limit) }, { retryOptions: NO_WAIT })
  assert.equal(calls, 1)
  assert.equal(result.ok, false)
  assert.equal(result.previewLimit, true)
  assert.deepEqual(result.errorBody, limit)
})
