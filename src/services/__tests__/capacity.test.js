/**
 * Waiting out a busy server (OpenConceptLab/ocl_issues#2849).
 *
 * A 429 means "slow down", not "failed": the call waits for its Retry-After
 * (plus 0-50% jitter) and tries again, until a long cap. A 502/503/504 or a
 * network error is retried a bounded number of times and then reported as an
 * error. Stop ends any wait. Requests to one server share a gate, so a 429 on
 * one pauses the others.
 *
 * The tests drive a virtual clock: sleep advances it instead of waiting.
 *
 * Run with: npm test
 */

import test from 'node:test'
import assert from 'node:assert/strict'

import {
  CAPACITY_LIMIT,
  CAPACITY_WAIT_CAP_MS,
  createCapacityGate,
  createLimiter,
  getCapacityHeaders,
  getRetryAfterMs,
  getThrottleLimit,
  HEAVY_REQUEST_TIMEOUT_MS,
  LIGHT_REQUEST_TIMEOUT_MS,
  RATE_LIMIT,
  requestWithCapacityRetry,
  sleepUnlessCancelled,
  untilCancelled,
} from '../capacity.js'

const networkError = () => Object.assign(new Error('Network Error'), {isAxiosError: true, code: 'ERR_NETWORK'})
const httpError = (status, {data = {}, headers = {}} = {}) => Object.assign(new Error(`Request failed with status code ${status}`), {
  isAxiosError: true, code: 'ERR_BAD_RESPONSE', response: {status, data, headers},
})
const throttled = (retryAfter, extra = {}) => httpError(429, {headers: retryAfter === undefined ? {} : {'retry-after': String(retryAfter)}, ...extra})
const ok = (data = [], headers = {}) => ({status: 200, data, headers})

const virtualClock = () => {
  const clock = {t: 0, sleeps: []}
  clock.now = () => clock.t
  clock.sleep = async ms => {
    clock.sleeps.push(ms)
    clock.t += ms
  }
  return clock
}

// Sends answer from a script, one entry per attempt: an error to throw, or a
// response to return.
const scripted = (...answers) => {
  const sent = []
  const send = async attempt => {
    sent.push(attempt)
    const answer = answers[Math.min(sent.length - 1, answers.length - 1)]
    if(answer instanceof Error) throw answer
    return answer
  }
  return {send, sent}
}

// ── getRetryAfterMs ──────────────────────────────────────────────────────────

test('getRetryAfterMs: seconds from the Retry-After header, whatever its case', () => {
  assert.equal(getRetryAfterMs({headers: {'retry-after': '12'}}), 12000)
  assert.equal(getRetryAfterMs({headers: {'Retry-After': '3'}}), 3000)
  // axios' AxiosHeaders has a get()
  assert.equal(getRetryAfterMs({headers: {get: key => (key.toLowerCase() === 'retry-after' ? '7' : undefined)}}), 7000)
})

test('getRetryAfterMs: an HTTP date counts from now', () => {
  const now = Date.parse('2026-09-30T12:00:00Z')
  assert.equal(getRetryAfterMs({headers: {'retry-after': 'Wed, 30 Sep 2026 12:00:20 GMT'}}, {now: () => now}), 20000)
  // a date already past means "now"
  assert.equal(getRetryAfterMs({headers: {'retry-after': 'Wed, 30 Sep 2026 11:00:00 GMT'}}, {now: () => now}), 0)
})

test('getRetryAfterMs: the body\'s retry_after when the header is missing', () => {
  assert.equal(getRetryAfterMs({headers: {}, data: {retry_after: 15}}), 15000)
})

test('getRetryAfterMs: null when the server gave no delay, or garbage', () => {
  assert.equal(getRetryAfterMs({headers: {}}), null)
  assert.equal(getRetryAfterMs({headers: {'retry-after': 'soon'}}), null)
  assert.equal(getRetryAfterMs({headers: {'retry-after': '-4'}}), null)
  assert.equal(getRetryAfterMs(undefined), null)
})

// ── getCapacityHeaders ──────────────────────────────────────────────────────

test('getCapacityHeaders: reads the X-OCL-Capacity-* headers', () => {
  const headers = {
    'x-ocl-capacity-decision': 'shadow-refused',
    'x-ocl-capacity-limit': '4',
    'x-ocl-capacity-in-flight': '5',
    'x-ocl-capacity-tier': 'preview',
    'x-ocl-capacity-tier-limit': '2',
    'x-ocl-capacity-tier-in-flight': '3',
    'x-ocl-capacity-suggested-concurrency': '1',
    'x-ocl-capacity-suggested-spacing-ms': '500',
  }
  assert.deepEqual(getCapacityHeaders({headers}), {
    decision: 'shadow-refused', limit: 4, inFlight: 5, tier: 'preview', tierLimit: 2, tierInFlight: 3,
    suggestedConcurrency: 1, suggestedSpacingMs: 500,
  })
})

test('getCapacityHeaders: null when the response carries none', () => {
  assert.equal(getCapacityHeaders({headers: {'content-type': 'application/json'}}), null)
  assert.equal(getCapacityHeaders(undefined), null)
})

test('getCapacityHeaders: only the headers present', () => {
  assert.deepEqual(getCapacityHeaders({headers: {'X-OCL-Capacity-Decision': 'admitted'}}), {decision: 'admitted'})
})

// ── requestWithCapacityRetry ────────────────────────────────────────────────

test('requestWithCapacityRetry: a 429 waits its Retry-After plus 0-50% jitter, then succeeds', async () => {
  const clock = virtualClock()
  const {send, sent} = scripted(throttled(10), ok(['row']))

  const result = await requestWithCapacityRetry(send, {now: clock.now, sleep: clock.sleep, random: () => 0.5})

  assert.equal(result.ok, true)
  assert.deepEqual(result.response.data, ['row'])
  assert.deepEqual(sent, [0, 1])
  // 10 s + 25% jitter (random 0.5 × 50%)
  assert.equal(clock.t, 12500)
  assert.equal(result.waitedMs, 12500)
})

test('requestWithCapacityRetry: the jitter stays within 0-50% of Retry-After', async () => {
  for(const random of [0, 0.999]) {
    const clock = virtualClock()
    const {send} = scripted(throttled(8), ok())
    await requestWithCapacityRetry(send, {now: clock.now, sleep: clock.sleep, random: () => random})
    assert.ok(clock.t >= 8000 && clock.t < 12000, `waited ${clock.t}`)
  }
})

test('requestWithCapacityRetry: 429s keep waiting past the error-retry budget, and aren\'t failures', async () => {
  const clock = virtualClock()
  const {send, sent} = scripted(throttled(5), throttled(5), throttled(5), throttled(5), throttled(5), ok())

  const result = await requestWithCapacityRetry(send, {now: clock.now, sleep: clock.sleep, random: () => 0, maxRetries: 2})

  assert.equal(result.ok, true)
  assert.equal(sent.length, 6)
  assert.equal(clock.t, 25000)
})

test('requestWithCapacityRetry: after the long cap a throttled call ends "throttled", not "error"', async () => {
  const clock = virtualClock()
  const {send, sent} = scripted(throttled(60))

  const result = await requestWithCapacityRetry(send, {now: clock.now, sleep: clock.sleep, random: () => 0})

  assert.equal(result.ok, false)
  assert.equal(result.reason, 'throttled')
  assert.equal(result.error.response.status, 429)
  // it waited up to the cap, never past it
  assert.ok(clock.t <= CAPACITY_WAIT_CAP_MS, `waited ${clock.t}`)
  assert.ok(clock.t >= CAPACITY_WAIT_CAP_MS - 60000, `waited ${clock.t}`)
  assert.equal(sent.length, clock.t / 60000 + 1)
})

test('requestWithCapacityRetry: the cap is 30 minutes', () => {
  assert.equal(CAPACITY_WAIT_CAP_MS, 30 * 60 * 1000)
})

test('requestWithCapacityRetry: a Retry-After past the cap ends "throttled" at once, without waiting', async () => {
  const clock = virtualClock()
  // a daily limit: come back tomorrow
  const {send, sent} = scripted(throttled(86400))

  const result = await requestWithCapacityRetry(send, {now: clock.now, sleep: clock.sleep})

  assert.equal(result.reason, 'throttled')
  assert.equal(sent.length, 1)
  assert.equal(clock.t, 0)
})

test('requestWithCapacityRetry: a 429 without Retry-After backs off from 5 s, doubling to at most 60 s', async () => {
  const clock = virtualClock()
  const {send} = scripted(throttled(), throttled(), throttled(), throttled(), throttled(), throttled(), ok())

  await requestWithCapacityRetry(send, {now: clock.now, sleep: clock.sleep, random: () => 0})

  assert.equal(clock.t, 5000 + 10000 + 20000 + 40000 + 60000 + 60000)
})

test('requestWithCapacityRetry: a 503 is retried twice with backoff, then reported as an error', async () => {
  const clock = virtualClock()
  const {send, sent} = scripted(httpError(503))

  const result = await requestWithCapacityRetry(send, {now: clock.now, sleep: clock.sleep, random: () => 0.5})

  assert.equal(result.ok, false)
  assert.equal(result.reason, 'error')
  assert.equal(result.error.response.status, 503)
  assert.equal(result.attempts, 3)
  assert.equal(sent.length, 3)
  // 3 s, then 12 s (factor 4), no jitter at random 0.5
  assert.equal(clock.t, 15000)
})

test('requestWithCapacityRetry: a 503 with Retry-After waits that long before its retry', async () => {
  const clock = virtualClock()
  const {send} = scripted(httpError(503, {headers: {'retry-after': '20'}}), ok())

  const result = await requestWithCapacityRetry(send, {now: clock.now, sleep: clock.sleep, random: () => 0})

  assert.equal(result.ok, true)
  assert.equal(clock.t, 20000)
})

test('requestWithCapacityRetry: a network failure is retried twice, then reported as an error', async () => {
  const clock = virtualClock()
  const {send, sent} = scripted(networkError())

  const result = await requestWithCapacityRetry(send, {now: clock.now, sleep: clock.sleep})

  assert.equal(result.reason, 'error')
  assert.equal(result.error.message, 'Network Error')
  assert.equal(sent.length, 3)
})

test('requestWithCapacityRetry: a transient failure that recovers keeps the response', async () => {
  const clock = virtualClock()
  const {send} = scripted(networkError(), httpError(502), ok(['x']))

  const result = await requestWithCapacityRetry(send, {now: clock.now, sleep: clock.sleep})

  assert.equal(result.ok, true)
  assert.equal(result.attempts, 3)
})

test('requestWithCapacityRetry: a 500 or a 4xx is an error at once', async () => {
  for(const status of [500, 400, 403, 404]) {
    const clock = virtualClock()
    const {send, sent} = scripted(httpError(status))
    const result = await requestWithCapacityRetry(send, {now: clock.now, sleep: clock.sleep})
    assert.equal(result.reason, 'error', `status ${status}`)
    assert.equal(sent.length, 1, `status ${status}`)
    assert.equal(clock.t, 0, `status ${status}`)
  }
})

test('requestWithCapacityRetry: a caller can widen what counts as retryable', async () => {
  const clock = virtualClock()
  const {send, sent} = scripted(httpError(404), ok())

  const result = await requestWithCapacityRetry(send, {now: clock.now, sleep: clock.sleep, isRetryable: err => err?.response?.status === 404})

  assert.equal(result.ok, true)
  assert.equal(sent.length, 2)
})

test('requestWithCapacityRetry: Stop during a 429 wait ends it at once, "cancelled", with nothing more sent', async () => {
  let stopped = false
  const clock = virtualClock()
  const sleep = async ms => {
    await clock.sleep(ms)
    if(clock.t >= 3000) stopped = true
  }
  const {send, sent} = scripted(throttled(600), ok())

  const result = await requestWithCapacityRetry(send, {now: clock.now, sleep, isCancelled: () => stopped})

  assert.equal(result.ok, false)
  assert.equal(result.reason, 'cancelled')
  assert.equal(sent.length, 1)
  // polled every 250 ms: stopped within one poll of the Stop, not after 600 s
  assert.ok(clock.t <= 3250, `waited ${clock.t}`)
})

test('requestWithCapacityRetry: Stop during an error backoff ends it too', async () => {
  let stopped = false
  const {send, sent} = scripted(networkError(), ok())

  const result = await requestWithCapacityRetry(send, {
    isCancelled: () => stopped,
    sleep: async () => { stopped = true },
  })

  assert.equal(result.reason, 'cancelled')
  assert.equal(sent.length, 1)
})

test('requestWithCapacityRetry: a call cancelled before it starts sends nothing', async () => {
  const {send, sent} = scripted(ok())
  const result = await requestWithCapacityRetry(send, {isCancelled: () => true})
  assert.equal(result.reason, 'cancelled')
  assert.equal(sent.length, 0)
})

test('requestWithCapacityRetry: with real timers, Stop breaks a long wait within a poll', async () => {
  let stopped = false
  setTimeout(() => { stopped = true }, 30)
  const started = Date.now()

  const result = await requestWithCapacityRetry(scripted(throttled(600)).send, {isCancelled: () => stopped, pollMs: 10})

  assert.equal(result.reason, 'cancelled')
  assert.ok(Date.now() - started < 1000)
})

test('requestWithCapacityRetry: onWait and onWaitEnd bracket each wait, with the reason and the delay', async () => {
  const clock = virtualClock()
  const events = []
  const {send} = scripted(throttled(10), httpError(503), ok())

  await requestWithCapacityRetry(send, {
    now: clock.now, sleep: clock.sleep, random: () => 0,
    onWait: info => events.push(['wait', info.reason, info.delayMs, info.status]),
    onWaitEnd: () => events.push(['end']),
  })

  assert.deepEqual(events, [['wait', 'throttled', 10000, 429], ['end'], ['wait', 'error', 2250, 503], ['end']])
})

test('requestWithCapacityRetry: onCapacity gets the capacity headers of a success and of a 429', async () => {
  const clock = virtualClock()
  const seen = []
  const {send} = scripted(
    throttled(1, {headers: {'retry-after': '1', 'x-ocl-capacity-decision': 'refused'}}),
    ok([], {'x-ocl-capacity-decision': 'admitted', 'x-ocl-capacity-suggested-concurrency': '2'}),
  )

  await requestWithCapacityRetry(send, {now: clock.now, sleep: clock.sleep, onCapacity: headers => seen.push(headers)})

  assert.deepEqual(seen, [{decision: 'refused'}, {decision: 'admitted', suggestedConcurrency: 2}])
})

test('requestWithCapacityRetry: a send that throws a non-HTTP error is an error, not retried', async () => {
  const {send, sent} = scripted(new TypeError('x is undefined'))
  const result = await requestWithCapacityRetry(send, {})
  assert.equal(result.reason, 'error')
  assert.equal(sent.length, 1)
})

// ── the gate: one 429 pauses every request to that server ────────────────────

test('createCapacityGate: pause extends, never shortens, the pause', () => {
  const clock = virtualClock()
  const gate = createCapacityGate({now: clock.now})
  assert.equal(gate.isPaused(), false)
  gate.pause(10000)
  gate.pause(4000)
  assert.equal(gate.pausedForMs(), 10000)
  clock.t = 6000
  gate.pause(8000)
  assert.equal(gate.pausedForMs(), 8000)
  clock.t = 14000
  assert.equal(gate.isPaused(), false)
})

test('createCapacityGate: wait sleeps until the gate reopens, and Stop ends it', async () => {
  const clock = virtualClock()
  const gate = createCapacityGate({now: clock.now})
  gate.pause(5000)
  assert.equal(await gate.wait(() => false, {sleep: clock.sleep}), true)
  assert.equal(clock.t, 5000)

  gate.pause(60000)
  let stopped = false
  const sleep = async ms => { await clock.sleep(ms); stopped = clock.t >= 6000 }
  assert.equal(await gate.wait(() => stopped, {sleep}), false)
  assert.ok(clock.t < 7000)
})

test('requestWithCapacityRetry: a 429 on one request holds back another that shares the gate', async () => {
  const clock = virtualClock()
  const gate = createCapacityGate({now: clock.now})
  const first = scripted(throttled(20), ok())
  const second = scripted(ok())

  await requestWithCapacityRetry(first.send, {gate, now: clock.now, sleep: clock.sleep, random: () => 0})
  // the first call slept through the pause; start a second while it's still paused
  gate.pause(20000)
  const startedAt = clock.t
  const events = []
  const result = await requestWithCapacityRetry(second.send, {
    gate, now: clock.now, sleep: clock.sleep, random: () => 0,
    onWait: info => events.push(info.reason),
  })

  assert.equal(result.ok, true)
  assert.equal(clock.t - startedAt, 20000)
  assert.deepEqual(events, ['paused'])
})

test('requestWithCapacityRetry: a 429 pauses the shared gate for its Retry-After', async () => {
  const clock = virtualClock()
  const gate = createCapacityGate({now: clock.now})
  let pausedDuringWait = null
  const sleep = async ms => {
    if(pausedDuringWait === null) pausedDuringWait = gate.pausedForMs()
    await clock.sleep(ms)
  }

  await requestWithCapacityRetry(scripted(throttled(30), ok()).send, {gate, now: clock.now, sleep, random: () => 0})

  assert.equal(pausedDuringWait, 30000)
})

test('requestWithCapacityRetry: time waiting on the gate counts toward the cap', async () => {
  const clock = virtualClock()
  const gate = createCapacityGate({now: clock.now})
  gate.pause(CAPACITY_WAIT_CAP_MS + 60000)
  const {send, sent} = scripted(ok())

  const result = await requestWithCapacityRetry(send, {gate, now: clock.now, sleep: clock.sleep})

  assert.equal(result.reason, 'throttled')
  assert.equal(sent.length, 0)
})

// ── sleepUnlessCancelled ────────────────────────────────────────────────────

test('sleepUnlessCancelled: true after the full sleep, false as soon as it is cancelled', async () => {
  const clock = virtualClock()
  assert.equal(await sleepUnlessCancelled(1000, () => false, {sleep: clock.sleep}), true)
  assert.equal(clock.t, 1000)
  assert.equal(await sleepUnlessCancelled(1000, () => clock.t >= 1500, {sleep: clock.sleep}), false)
  assert.equal(clock.t, 1500)
})

// ── createLimiter: at most N in flight ──────────────────────────────────────

test('createLimiter: at most 2 in flight; the rest queue and run in order', async () => {
  const limiter = createLimiter(2)
  let inFlight = 0
  let maxInFlight = 0
  const order = []
  const task = async id => {
    const release = await limiter.acquire()
    inFlight += 1
    maxInFlight = Math.max(maxInFlight, inFlight)
    order.push(id)
    await new Promise(resolve => setTimeout(resolve, 5))
    inFlight -= 1
    release()
  }

  await Promise.all([1, 2, 3, 4, 5, 6, 7].map(task))

  assert.equal(maxInFlight, 2)
  assert.deepEqual(order, [1, 2, 3, 4, 5, 6, 7])
  assert.equal(limiter.active(), 0)
})

test('createLimiter: a queued caller cancelled before its turn gets null and takes no slot', async () => {
  const limiter = createLimiter(1)
  const release = await limiter.acquire()
  let stopped = false
  const queued = limiter.acquire({isCancelled: () => stopped, pollMs: 5})
  stopped = true
  assert.equal(await queued, null)
  release()
  assert.equal(limiter.active(), 0)
  const next = await limiter.acquire()
  assert.equal(limiter.active(), 1)
  next()
})

test('createLimiter: releasing twice frees one slot only', async () => {
  const limiter = createLimiter(2)
  const a = await limiter.acquire()
  await limiter.acquire()
  a()
  a()
  assert.equal(limiter.active(), 1)
})

test('requestWithCapacityRetry: a throttled wait carries the 429\'s capacity headers, for the row log', async () => {
  const clock = virtualClock()
  const waits = []
  const {send} = scripted(
    throttled(2, {headers: {'retry-after': '2', 'x-ocl-capacity-decision': 'refused', 'x-ocl-capacity-tier': 'preview'}}),
    throttled(2),
    ok(),
  )

  await requestWithCapacityRetry(send, {now: clock.now, sleep: clock.sleep, onWait: info => waits.push(info.capacity)})

  assert.deepEqual(waits, [{decision: 'refused', tier: 'preview'}, null])
})

// ── Codex review, pass 1 ────────────────────────────────────────────────────

test('createCapacityGate: wait gives up once maxMs has passed, even as the pause keeps extending', async () => {
  const clock = virtualClock()
  const gate = createCapacityGate({now: clock.now})
  gate.pause(10000)
  // another request's 429 keeps pushing the pause out
  const sleep = async ms => { await clock.sleep(ms); gate.pause(10000) }
  assert.equal(await gate.wait(() => false, {sleep, maxMs: 30000}), 'timeout')
  assert.ok(clock.t >= 30000 && clock.t <= 30250, `waited ${clock.t}`)
})

test('requestWithCapacityRetry: a gate pause that keeps extending ends "throttled" at the cap, without sending', async () => {
  const clock = virtualClock()
  const gate = createCapacityGate({now: clock.now})
  gate.pause(20000)
  const sleep = async ms => { await clock.sleep(ms); gate.pause(20000) }
  const {send, sent} = scripted(ok())

  const result = await requestWithCapacityRetry(send, {gate, now: clock.now, sleep, maxWaitMs: 60000})

  assert.equal(result.reason, 'throttled')
  assert.equal(sent.length, 0)
  assert.ok(clock.t <= 60250, `waited ${clock.t}`)
})

// The e2e re-run (scenario T): pausing the whole server for a Retry-After past
// the cap blocked every other algorithm, rerank and later run in the tab for
// as long. The request gives up alone; the run stops asking for that
// algorithm (MapProject's run-level throttle), and the others carry on.
test('requestWithCapacityRetry: a Retry-After past the cap ends "throttled" without pausing the gate for the others', async () => {
  const clock = virtualClock()
  const gate = createCapacityGate({now: clock.now})

  const first = await requestWithCapacityRetry(scripted(throttled(4000)).send, {gate, now: clock.now, sleep: clock.sleep})
  const other = scripted(ok())
  const next = await requestWithCapacityRetry(other.send, {gate, now: clock.now, sleep: clock.sleep})

  assert.equal(first.reason, 'throttled')
  assert.equal(gate.isPaused(), false)
  assert.equal(next.ok, true)
  assert.equal(other.sent.length, 1)
  assert.equal(clock.t, 0)
})

test('untilCancelled: the promise\'s value when it settles, or cancelled when Stop comes first', async () => {
  assert.deepEqual(await untilCancelled(Promise.resolve(7), () => false, {pollMs: 5}), {settled: true, value: 7})
  let stopped = false
  setTimeout(() => { stopped = true }, 15)
  const started = Date.now()
  assert.deepEqual(await untilCancelled(new Promise(() => {}), () => stopped, {pollMs: 5}), {settled: false})
  assert.ok(Date.now() - started < 500)
})

test('untilCancelled: a rejection passes through', async () => {
  await assert.rejects(untilCancelled(Promise.reject(new Error('boom')), () => false, {pollMs: 5}), /boom/)
})

// Codex review, pass 2: transport timeouts bound a send that never answers.
test('request timeouts: heavy calls outlast any answer the API gives; light calls give up within a minute', () => {
  assert.ok(HEAVY_REQUEST_TIMEOUT_MS > 10 * 60 * 1000)
  assert.equal(LIGHT_REQUEST_TIMEOUT_MS, 60 * 1000)
})

test('requestWithCapacityRetry: an attempt that timed out (axios ECONNABORTED) is retried like a network error', async () => {
  const timedOut = Object.assign(new Error('timeout of 60000ms exceeded'), {isAxiosError: true, code: 'ECONNABORTED'})
  const {send, sent} = scripted(timedOut, ok())
  const result = await requestWithCapacityRetry(send, {sleep: async () => {}})
  assert.equal(result.ok, true)
  assert.equal(sent.length, 2)
})

// ── ocl_issues#2865: capacity limit vs rate limit ───────────────────────────

const capacityExceeded = retryAfter => throttled(retryAfter, {data: {error_code: 'capacity_exceeded', detail: 'Server at capacity'}})

test('getThrottleLimit: capacity_exceeded is the capacity limit; any other 429 is the rate limit', () => {
  assert.equal(getThrottleLimit(capacityExceeded(5).response), CAPACITY_LIMIT)
  assert.equal(getThrottleLimit(throttled(5, {data: {detail: 'Request was throttled.'}}).response), RATE_LIMIT)
  assert.equal(getThrottleLimit(throttled(5, {data: {error_code: 'rate_limited'}}).response), RATE_LIMIT)
  assert.equal(getThrottleLimit(throttled(undefined, {data: 'Too Many Requests'}).response), RATE_LIMIT)
  assert.equal(getThrottleLimit(undefined), RATE_LIMIT)
})

test('requestWithCapacityRetry: a capacity 429 waits its Retry-After, as the capacity limit', async () => {
  const clock = virtualClock()
  const waits = []
  const result = await requestWithCapacityRetry(scripted(capacityExceeded(20), ok()).send, {
    now: clock.now, sleep: clock.sleep, random: () => 0, onWait: info => waits.push(info),
  })

  assert.equal(result.ok, true)
  assert.equal(clock.t, 20000)
  assert.deepEqual(waits.map(({reason, limit, delayMs, retryAfterMs}) => ({reason, limit, delayMs, retryAfterMs})),
    [{reason: 'throttled', limit: CAPACITY_LIMIT, delayMs: 20000, retryAfterMs: 20000}])
})

test('requestWithCapacityRetry: a rate-limit 429 with Retry-After waits it just the same, as the rate limit', async () => {
  const clock = virtualClock()
  const waits = []
  const result = await requestWithCapacityRetry(scripted(throttled(20, {data: {detail: 'Request was throttled.'}}), ok()).send, {
    now: clock.now, sleep: clock.sleep, random: () => 0, onWait: info => waits.push(info),
  })

  assert.equal(result.ok, true)
  assert.equal(clock.t, 20000)
  assert.deepEqual(waits.map(({reason, limit, delayMs, retryAfterMs}) => ({reason, limit, delayMs, retryAfterMs})),
    [{reason: 'throttled', limit: RATE_LIMIT, delayMs: 20000, retryAfterMs: 20000}])
})

test('requestWithCapacityRetry: a rate-limit 429 without Retry-After backs off as before, as the rate limit, with its delay', async () => {
  const clock = virtualClock()
  const waits = []
  const result = await requestWithCapacityRetry(scripted(throttled(), throttled(), ok()).send, {
    now: clock.now, sleep: clock.sleep, random: () => 0, onWait: info => waits.push(info),
  })

  assert.equal(result.ok, true)
  assert.deepEqual(waits.map(({limit, delayMs, retryAfterMs}) => ({limit, delayMs, retryAfterMs})), [
    {limit: RATE_LIMIT, delayMs: 5000, retryAfterMs: null},
    {limit: RATE_LIMIT, delayMs: 10000, retryAfterMs: null},
  ])
})

test('requestWithCapacityRetry: a request held by the shared gate gets the limit of the 429 that paused it', async () => {
  const clock = virtualClock()
  const heldBy = async limit => {
    const gate = createCapacityGate({now: clock.now})
    gate.pause(10000, limit)
    const waits = []
    await requestWithCapacityRetry(scripted(ok()).send, {
      gate, now: clock.now, sleep: clock.sleep, random: () => 0, onWait: info => waits.push([info.reason, info.limit]),
    })
    return waits
  }

  assert.deepEqual(await heldBy(RATE_LIMIT), [['paused', RATE_LIMIT]])
  assert.deepEqual(await heldBy(CAPACITY_LIMIT), [['paused', CAPACITY_LIMIT]])
})

test('createCapacityGate: the limit is that of the 429 holding the gate longest', () => {
  const clock = virtualClock()
  const gate = createCapacityGate({now: clock.now})
  gate.pause(30000, CAPACITY_LIMIT)
  gate.pause(5000, RATE_LIMIT)
  assert.equal(gate.limit(), CAPACITY_LIMIT)
  gate.pause(60000, RATE_LIMIT)
  assert.equal(gate.limit(), RATE_LIMIT)
  gate.pause(120000)
  assert.equal(gate.limit(), CAPACITY_LIMIT)
})

test('requestWithCapacityRetry: an error backoff carries no limit', async () => {
  const clock = virtualClock()
  const waits = []
  await requestWithCapacityRetry(scripted(httpError(503), ok()).send, {
    now: clock.now, sleep: clock.sleep, random: () => 0, onWait: info => waits.push([info.reason, info.limit]),
  })
  assert.deepEqual(waits, [['error', null]])
})
