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

import { formatRowNumbers, isRetryableMatchError, runMatchBatch, requestSingleMatch, runWithConcurrency } from '../matchBatch.js'
import { createCapacityGate } from '../../../services/capacity.js'
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

// ── Waiting out a busy server (OpenConceptLab/ocl_issues#2849) ────────────────
// A 429 used to fail the batch at once. Now it waits for Retry-After (plus
// jitter) and resumes; a batch still throttled after the long cap is marked
// throttled (-4, "not run, retry"), never failed.

const throttled = () => httpError(429, {})
const withRetryAfter = (err, seconds) => { err.response.headers = {'retry-after': String(seconds)}; return err }
const virtualClock = () => {
  const clock = {t: 0}
  clock.now = () => clock.t
  clock.sleep = async ms => { clock.t += ms }
  return clock
}

test('runMatchBatch: a 429 waits for Retry-After and the batch then succeeds; its rows are never marked failed', async () => {
  const rec = recorder()
  const clock = virtualClock()
  const waits = []
  let calls = 0
  const send = async () => {
    calls += 1
    if(calls === 1) throw withRetryAfter(throttled(), 12)
    return ok([{row: {__index: 0}, results: []}, {row: {__index: 1}, results: []}])
  }

  const data = await runMatchBatch({
    rowIndexes: [0, 1], send, ...rec,
    onWait: info => waits.push(info.reason), onWaitEnd: () => waits.push('end'),
    retryOptions: {now: clock.now, sleep: clock.sleep, random: () => 0},
  })

  assert.equal(data.length, 2)
  assert.equal(calls, 2)
  assert.equal(clock.t, 12000)
  assert.deepEqual(rec.stages, {0: [0, 1], 1: [0, 1]})
  assert.deepEqual(rec.failed, [])
  assert.deepEqual(rec.finished, [0, 1])
  assert.deepEqual(waits, ['throttled', 'end'])
})

test('runMatchBatch: a batch still throttled after the cap is marked throttled (-4), not failed', async () => {
  const rec = recorder()
  const clock = virtualClock()
  const throttledRows = []

  const data = await runMatchBatch({
    rowIndexes: [5, 6], send: async () => { throw withRetryAfter(throttled(), 60) }, ...rec,
    onRowThrottled: (index, info) => throttledRows.push([index, info.attempts > 1]),
    retryOptions: {now: clock.now, sleep: clock.sleep, random: () => 0, maxWaitMs: 5 * 60 * 1000},
  })

  assert.deepEqual(data, [])
  assert.deepEqual(rec.stages, {5: [0, -4], 6: [0, -4]})
  assert.deepEqual(rec.failed, [])
  assert.deepEqual(rec.finished, [])
  assert.deepEqual(throttledRows, [[5, true], [6, true]])
})

test('runMatchBatch: Stop during a 429 wait puts the rows back to not run and sends nothing more', async () => {
  const rec = recorder()
  let calls = 0
  let stopped = false
  const send = async () => {
    calls += 1
    setTimeout(() => { stopped = true }, 20)
    throw withRetryAfter(throttled(), 600)
  }
  const started = Date.now()

  const data = await runMatchBatch({rowIndexes: [0, 1], send, ...rec, shouldStop: () => stopped, retryOptions: {pollMs: 5}})

  assert.deepEqual(data, [])
  assert.equal(calls, 1)
  assert.ok(Date.now() - started < 1000)
  assert.deepEqual(rec.stages, {0: [0, -1], 1: [0, -1]})
  assert.deepEqual(rec.failed, [])
})

test('runMatchBatch: a 503 is still retried, then fails the rows with its status', async () => {
  const rec = recorder()
  let calls = 0
  await runMatchBatch({rowIndexes: [0], send: async () => { calls += 1; throw httpError(503) }, ...rec, retryOptions: NO_WAIT})
  assert.equal(calls, 3)
  assert.deepEqual(rec.stages, {0: [0, -2]})
  assert.equal(rec.failed[0].status, 503)
})

test('runMatchBatch: a 429 on one batch holds back another batch sharing the gate', async () => {
  const clock = virtualClock()
  const gate = createCapacityGate({now: clock.now})
  const sentAt = {a: [], b: []}
  const sendA = async () => {
    sentAt.a.push(clock.t)
    if(sentAt.a.length === 1) throw withRetryAfter(throttled(), 30)
    return ok([])
  }
  const sendB = async () => { sentAt.b.push(clock.t); return ok([]) }
  const common = {retryOptions: {gate, now: clock.now, sleep: clock.sleep, random: () => 0}}

  await runMatchBatch({rowIndexes: [0], send: sendA, ...recorder(), ...common})
  gate.pause(30000)
  await runMatchBatch({rowIndexes: [1], send: sendB, ...recorder(), ...common})

  assert.deepEqual(sentAt.a, [0, 30000])
  assert.deepEqual(sentAt.b, [60000])
})

test('requestSingleMatch: a 429 waits and then returns the response', async () => {
  const clock = virtualClock()
  let calls = 0
  const result = await requestSingleMatch(async () => {
    calls += 1
    if(calls === 1) throw withRetryAfter(throttled(), 5)
    return ok([{ row: { __index: 3 }, results: [] }])
  }, { retryOptions: {now: clock.now, sleep: clock.sleep, random: () => 0} })
  assert.equal(result.ok, true)
  assert.equal(calls, 2)
  assert.equal(clock.t, 5000)
})

test('requestSingleMatch: still throttled after its cap, it reports throttled, not a failure', async () => {
  const clock = virtualClock()
  const result = await requestSingleMatch(async () => { throw withRetryAfter(throttled(), 60) }, { retryOptions: {now: clock.now, sleep: clock.sleep, random: () => 0} })
  assert.equal(result.ok, false)
  assert.equal(result.throttled, true)
  assert.equal(result.previewLimit, false)
  assert.equal(result.errorBody.status, 429)
  // a person is waiting on the row panel: 5 minutes, not a run's 30
  assert.ok(clock.t <= 5 * 60 * 1000 && clock.t >= 4 * 60 * 1000, `waited ${clock.t}`)
})

// ── the bulk scheduler ─────────────────────────────────────────────────────────

test('runWithConcurrency: at most `concurrency` in flight, every item run once', async () => {
  let inFlight = 0
  let maxInFlight = 0
  const ran = []
  const done = await runWithConcurrency([1, 2, 3, 4, 5, 6, 7], {
    concurrency: 3,
    run: async item => {
      inFlight += 1
      maxInFlight = Math.max(maxInFlight, inFlight)
      await new Promise(resolve => setTimeout(resolve, 3))
      ran.push(item)
      inFlight -= 1
    },
  })
  assert.equal(done, true)
  assert.equal(maxInFlight, 3)
  assert.deepEqual(ran.sort(), [1, 2, 3, 4, 5, 6, 7])
})

test('runWithConcurrency: sends no new batch while the gate is paused, then resumes', async () => {
  const gate = createCapacityGate()
  const started = Date.now()
  const dispatchedAt = {}
  const done = await runWithConcurrency([1, 2, 3, 4], {
    concurrency: 2,
    gate,
    pollMs: 5,
    run: async item => {
      dispatchedAt[item] = Date.now() - started
      // the first batch is throttled: the server asks everyone to wait 80 ms
      if(item === 1)
        gate.pause(80)
      await new Promise(resolve => setTimeout(resolve, 5))
    },
  })
  assert.equal(done, true)
  assert.ok(dispatchedAt[1] < 40)
  for(const item of [2, 3, 4])
    assert.ok(dispatchedAt[item] >= 75, `batch ${item} went out at ${dispatchedAt[item]} ms, during the pause`)
})

test('runWithConcurrency: Stop during a pause returns at once, and sends nothing more', async () => {
  const gate = createCapacityGate()
  let stopped = false
  const ran = []
  const started = Date.now()
  setTimeout(() => { stopped = true }, 20)
  const done = await runWithConcurrency([1, 2, 3], {
    concurrency: 1,
    gate,
    pollMs: 5,
    shouldAbort: () => stopped,
    run: async item => { ran.push(item); gate.pause(60000) },
  })
  assert.equal(done, false)
  assert.deepEqual(ran, [1])
  assert.ok(Date.now() - started < 1000)
})

test('runWithConcurrency: shouldSkipRest drops the queue but lets the batches in flight finish', async () => {
  let skip = false
  const finished = []
  const done = await runWithConcurrency([1, 2, 3, 4, 5], {
    concurrency: 2,
    shouldSkipRest: () => skip,
    run: async item => {
      if(item === 2) skip = true
      await new Promise(resolve => setTimeout(resolve, 3))
      finished.push(item)
    },
  })
  assert.equal(done, true)
  assert.deepEqual(finished.sort(), [1, 2])
})

test('runWithConcurrency: onSkipped gets the batches shouldSkipRest dropped, once', async () => {
  let skip = false
  const skipped = []
  await runWithConcurrency([1, 2, 3, 4, 5], {
    concurrency: 1,
    shouldSkipRest: () => skip,
    onSkipped: items => skipped.push(items),
    run: async item => { if(item === 2) skip = true },
  })
  assert.deepEqual(skipped, [[3, 4, 5]])
})

test('runWithConcurrency: onSkipped isn\'t called when nothing was dropped', async () => {
  const skipped = []
  await runWithConcurrency([1, 2], {concurrency: 2, onSkipped: items => skipped.push(items), run: async () => {}})
  assert.deepEqual(skipped, [])
})

// Codex review, pass 1
test('runWithConcurrency: Stop returns even while a batch in flight never answers', async () => {
  let stopped = false
  setTimeout(() => { stopped = true }, 20)
  const started = Date.now()
  const done = await runWithConcurrency([1, 2, 3], {
    concurrency: 1,
    pollMs: 5,
    shouldAbort: () => stopped,
    run: () => new Promise(() => {}),
  })
  assert.equal(done, false)
  assert.ok(Date.now() - started < 1000)
})

test('runWithConcurrency: a pause longer than maxHoldMs doesn\'t hold the queue (its batches end throttled at once instead)', async () => {
  const gate = createCapacityGate()
  gate.pause(60 * 60 * 1000)
  const ran = []
  const started = Date.now()
  await runWithConcurrency([1, 2, 3], {concurrency: 1, gate, maxHoldMs: 30 * 60 * 1000, pollMs: 5, run: async item => { ran.push(item) }})
  assert.deepEqual(ran, [1, 2, 3])
  assert.ok(Date.now() - started < 1000)
})
