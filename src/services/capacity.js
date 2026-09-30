// Waiting out a busy server (OpenConceptLab/ocl_issues#2849). Dependency-free
// so node's test runner can load it.
//
// A 429 means "slow down", not "failed": the request waits for the server's
// Retry-After, plus 0-50% at random so held-back requests don't all resend at
// once, and tries again until it has waited CAPACITY_WAIT_CAP_MS in all. Then
// it ends "throttled", which callers show as "not run, retry", never as a
// failure. A 502/503/504 or a network error is retried a bounded number of
// times, then ends "error". Stop ends any wait.

import { isTransientNetworkError } from './retry.js'

export const CAPACITY_WAIT_CAP_MS = 30 * 60 * 1000

const THROTTLE_JITTER = 0.5
// A 429 with Retry-After: 0 must not turn into a tight resend loop.
const MIN_THROTTLE_WAIT_MS = 1000
// A 429 without Retry-After waits 5 s, doubling up to a minute.
const DEFAULT_THROTTLE_WAIT_MS = 5000
const MAX_DEFAULT_THROTTLE_WAIT_MS = 60000
// A 503's Retry-After is honoured, but it's an error retry: keep it short.
const MAX_ERROR_RETRY_AFTER_MS = 60000
// How often a wait checks for Stop. Stop sets a flag (abortRef), with no event
// to listen to.
const POLL_MS = 250

// The gateway answers these while the API rolls out or a task restarts. A 500
// comes from the API itself, and retrying it only adds load.
const RETRYABLE_STATUSES = new Set([502, 503, 504])

export const isRetryableError = err =>
  isTransientNetworkError(err) || RETRYABLE_STATUSES.has(err?.response?.status)

const defaultSleep = ms => new Promise(resolve => setTimeout(resolve, ms))

const getHeader = (headers, name) => {
  if(!headers)
    return undefined
  if(typeof headers.get === 'function') {
    const value = headers.get(name)
    if(value !== undefined && value !== null)
      return value
  }
  const key = Object.keys(headers).find(k => k.toLowerCase() === name)
  return key === undefined ? undefined : headers[key]
}

/**
 * How long a response asks the client to wait, in ms: the Retry-After header
 * (seconds, or an HTTP date), else the body's retry_after (seconds). null when
 * it gives none.
 */
export const getRetryAfterMs = (response, { now = Date.now } = {}) => {
  const header = getHeader(response?.headers, 'retry-after')
  if(header !== undefined && header !== null && `${header}`.trim() !== '') {
    const text = `${header}`.trim()
    if(/^-?\d+(\.\d+)?$/.test(text)) {
      const seconds = Number(text)
      return seconds >= 0 ? seconds * 1000 : null
    }
    if(/[a-z]/i.test(text)) {
      const at = Date.parse(text)
      if(Number.isFinite(at))
        return Math.max(at - now(), 0)
    }
    return null
  }
  const seconds = response?.data?.retry_after
  return typeof seconds === 'number' && Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : null
}

const CAPACITY_HEADERS = {
  decision: ['x-ocl-capacity-decision', String],
  limit: ['x-ocl-capacity-limit', Number],
  inFlight: ['x-ocl-capacity-in-flight', Number],
  tier: ['x-ocl-capacity-tier', String],
  tierLimit: ['x-ocl-capacity-tier-limit', Number],
  tierInFlight: ['x-ocl-capacity-tier-in-flight', Number],
  suggestedConcurrency: ['x-ocl-capacity-suggested-concurrency', Number],
  suggestedSpacingMs: ['x-ocl-capacity-suggested-spacing-ms', Number],
}

/**
 * The server's X-OCL-Capacity-* headers (OpenConceptLab/ocl_online#275), or
 * null when the response carries none. Read and logged only for now; adapting
 * to the suggested concurrency is OpenConceptLab/ocl_online#340.
 */
export const getCapacityHeaders = response => {
  const capacity = {}
  Object.entries(CAPACITY_HEADERS).forEach(([field, [name, parse]]) => {
    const value = getHeader(response?.headers, name)
    if(value === undefined || value === null || value === '')
      return
    const parsed = parse(value)
    if(parse === Number && !Number.isFinite(parsed))
      return
    capacity[field] = parsed
  })
  return Object.keys(capacity).length ? capacity : null
}

/**
 * Sleeps ms, checking isCancelled every pollMs. Resolves true after the full
 * sleep, false as soon as it is cancelled.
 */
export const sleepUnlessCancelled = async (ms, isCancelled = () => false, { sleep = defaultSleep, pollMs = POLL_MS } = {}) => {
  let remaining = ms
  while(remaining > 0) {
    if(isCancelled())
      return false
    const step = Math.min(remaining, pollMs)
    await sleep(step)
    remaining -= step
  }
  return !isCancelled()
}

/**
 * One per server, shared by the requests a tab sends it. A 429 on any of them
 * pauses the gate for its Retry-After, and the others (and the Auto Match
 * scheduler) hold back until it reopens.
 */
export const createCapacityGate = ({ now = Date.now } = {}) => {
  let resumeAt = 0
  const pausedForMs = () => Math.max(resumeAt - now(), 0)
  return {
    pause: ms => { resumeAt = Math.max(resumeAt, now() + ms) },
    pausedForMs,
    isPaused: () => pausedForMs() > 0,
    // Resolves true once the gate is open, false if cancelled first.
    wait: async (isCancelled = () => false, { sleep, pollMs } = {}) => {
      while(pausedForMs() > 0) {
        if(!(await sleepUnlessCancelled(pausedForMs(), isCancelled, { sleep, pollMs })))
          return false
      }
      return true
    },
  }
}

/**
 * Sends a request, waiting out 429s and retrying transient failures. Never
 * rejects.
 *
 * @param {function} send  attempt => Promise<axios response>; must reject on a non-2xx (service.request does)
 * @param {object}   [opts]
 * @param {object}   [opts.gate]        a createCapacityGate() shared with other requests to the same server
 * @param {function} [opts.isCancelled] () => boolean; Stop. Checked before each send and during every wait
 * @param {number}   [opts.maxWaitMs]   how long to wait in all before ending "throttled"
 * @param {number}   [opts.maxRetries]  retries for a network error or 502/503/504 (429s don't count)
 * @param {function} [opts.isRetryable] err => boolean; replaces the network-or-gateway check
 * @param {function} [opts.onWait]      ({reason: 'throttled'|'paused'|'error', delayMs, status, retryAfterMs, capacity}) => void
 * @param {function} [opts.onWaitEnd]   () => void, after each wait, however it ended
 * @param {function} [opts.onCapacity]  capacityHeaders => void, for each response that carries them
 * @returns {Promise<{ok: true, response, attempts, waitedMs}|{ok: false, reason: 'throttled'|'cancelled'|'error', error, attempts, waitedMs}>}
 */
export const requestWithCapacityRetry = async (send, {
  gate = null,
  isCancelled = () => false,
  maxWaitMs = CAPACITY_WAIT_CAP_MS,
  maxRetries = 2,
  baseDelayMs = 3000,
  backoffFactor = 4,
  jitterFactor = 0.25,
  isRetryable = isRetryableError,
  onWait,
  onWaitEnd,
  onCapacity,
  now = Date.now,
  random = Math.random,
  sleep = defaultSleep,
  pollMs = POLL_MS,
} = {}) => {
  let attempts = 0
  let errorRetries = 0
  let throttles = 0
  let waitedMs = 0
  let lastError
  const end = fields => ({ ...fields, attempts, waitedMs })
  const cancelled = () => end({ ok: false, reason: 'cancelled', error: lastError })
  const reportCapacity = response => {
    const capacity = onCapacity ? getCapacityHeaders(response) : null
    if(capacity)
      onCapacity(capacity)
  }
  const waitFor = async (delayMs, info) => {
    onWait?.({ ...info, delayMs })
    const startedAt = now()
    const slept = await sleepUnlessCancelled(delayMs, isCancelled, { sleep, pollMs })
    waitedMs += now() - startedAt
    onWaitEnd?.()
    return slept
  }

  for(;;) {
    if(isCancelled())
      return cancelled()

    if(gate?.isPaused()) {
      const pauseMs = gate.pausedForMs()
      if(waitedMs + pauseMs > maxWaitMs)
        return end({ ok: false, reason: 'throttled', error: lastError })
      onWait?.({ reason: 'paused', delayMs: pauseMs, status: null, retryAfterMs: pauseMs })
      const startedAt = now()
      let open = await gate.wait(isCancelled, { sleep, pollMs })
      // Spread out the requests the pause held back.
      if(open)
        open = await sleepUnlessCancelled(pauseMs * THROTTLE_JITTER * random(), isCancelled, { sleep, pollMs })
      waitedMs += now() - startedAt
      onWaitEnd?.()
      if(!open)
        return cancelled()
      continue
    }

    attempts += 1
    let response
    try {
      response = await send(attempts - 1)
    } catch (err) {
      lastError = err
      reportCapacity(err?.response)
      if(err?.response?.status === 429) {
        const retryAfterMs = getRetryAfterMs(err.response, { now })
        const baseMs = retryAfterMs === null ?
          Math.min(DEFAULT_THROTTLE_WAIT_MS * 2 ** throttles, MAX_DEFAULT_THROTTLE_WAIT_MS) :
          Math.max(retryAfterMs, MIN_THROTTLE_WAIT_MS)
        throttles += 1
        const delayMs = baseMs * (1 + random() * THROTTLE_JITTER)
        if(waitedMs + delayMs > maxWaitMs)
          return end({ ok: false, reason: 'throttled', error: err })
        gate?.pause(baseMs)
        if(!(await waitFor(delayMs, { reason: 'throttled', status: 429, retryAfterMs, capacity: getCapacityHeaders(err.response) })))
          return cancelled()
        continue
      }
      if(errorRetries < maxRetries && isRetryable(err)) {
        const retryAfterMs = getRetryAfterMs(err?.response, { now })
        const delayMs = retryAfterMs === null ?
          baseDelayMs * backoffFactor ** errorRetries * (1 - jitterFactor + random() * jitterFactor * 2) :
          Math.min(retryAfterMs, MAX_ERROR_RETRY_AFTER_MS) * (1 + random() * THROTTLE_JITTER)
        errorRetries += 1
        if(!(await waitFor(delayMs, { reason: 'error', status: err?.response?.status ?? null, retryAfterMs })))
          return cancelled()
        continue
      }
      return end({ ok: false, reason: 'error', error: err })
    }
    reportCapacity(response)
    return end({ ok: true, response })
  }
}

/**
 * At most max callers hold a slot at once; the rest queue in order. acquire
 * resolves a release function, or null when isCancelled turned true before
 * the caller's turn.
 */
export const createLimiter = max => {
  let active = 0
  const waiting = []
  const makeRelease = () => {
    let released = false
    return () => {
      if(released)
        return
      released = true
      active -= 1
      grantNext()
    }
  }
  const grantNext = () => {
    while(active < max && waiting.length) {
      const next = waiting.shift()
      if(next.isCancelled()) {
        next.resolve(null)
        continue
      }
      active += 1
      next.resolve(makeRelease())
    }
  }
  const acquire = ({ isCancelled, pollMs = POLL_MS } = {}) => {
    const cancelledNow = isCancelled || (() => false)
    if(cancelledNow())
      return Promise.resolve(null)
    if(active < max && !waiting.length) {
      active += 1
      return Promise.resolve(makeRelease())
    }
    return new Promise(resolve => {
      let timer = null
      const entry = {
        isCancelled: cancelledNow,
        resolve: value => {
          if(timer)
            clearInterval(timer)
          resolve(value)
        },
      }
      if(isCancelled)
        timer = setInterval(() => {
          if(!cancelledNow())
            return
          const at = waiting.indexOf(entry)
          if(at !== -1)
            waiting.splice(at, 1)
          entry.resolve(null)
        }, pollMs)
      waiting.push(entry)
    })
  }
  return { acquire, active: () => active, waiting: () => waiting.length }
}
