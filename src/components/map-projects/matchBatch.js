/**
 * One bulk Auto Match $match batch (ocl_online#257).
 *
 * APIService.post resolves on a network error (with error.message) and on a
 * 5xx, so a batch that got no answer used to look like a success with no
 * candidates. The caller's `send` must reject instead (service.request does),
 * so a failure is caught here, retried when it's transient, and reported per
 * row.
 *
 * A 429 waits for the server's Retry-After and resumes (ocl_issues#2849): a
 * busy server makes a run slower, not broken.
 */
import { isPreviewLimitError } from './previewLimits.js'
import { isRetryableError, requestWithCapacityRetry, untilCancelled } from '../../services/capacity.js'

// How long the row panel waits out a 429 before showing the row as throttled.
// A person is watching it, so less than a run's 30 minutes.
export const INTERACTIVE_WAIT_CAP_MS = 5 * 60 * 1000

export const MATCH_RETRY_OPTIONS = {maxRetries: 2, baseDelayMs: 3000, backoffFactor: 4, jitterFactor: 0.25}

// Network errors and 502/503/504. A 429 isn't an error to retry: it's waited
// out, however many times it comes.
export const isRetryableMatchError = isRetryableError

const getFailure = (err, attempts) => ({
  error: err?.response?.data?.detail || err?.message || 'unknown',
  status: err?.response?.status || null,
  attempts,
  previewLimit: isPreviewLimitError(err),
})

/**
 * Mark the batch's rows running, send it, then mark each row done (1), failed
 * (-2) or throttled (-4). Never rejects.
 *
 * A network error or a 502/503/504 is retried a bounded number of times, then
 * fails the rows. A 429 waits for Retry-After, however often it comes, until
 * the long cap; a batch still refused then is throttled (-4): "not run, retry",
 * never failed. Waits on a gate shared with the run's other requests hold them
 * all back together.
 *
 * shouldStop is checked before every send and during every wait. A batch
 * stopped there (the run was cancelled, or another batch hit the match quota)
 * sends nothing more and puts its rows back to not run (-1), like the rows the
 * run never reached.
 *
 * @param {object}   opts
 * @param {number[]} opts.rowIndexes       the batch's row __index values
 * @param {function} opts.send             attempt => Promise<axios response>; must reject on failure
 * @param {function} opts.setStage         (rowIndex, stage) => void
 * @param {function} opts.onRowFinished    rowIndex => void
 * @param {function} opts.onRowFailed      (rowIndex, {error, status, attempts, previewLimit}) => void
 * @param {function} [opts.onRowThrottled] (rowIndex, {attempts, waitedMs}) => void
 * @param {function} [opts.onPreviewLimit] err => void, for a preview-limit 403 (never retried)
 * @param {function} [opts.onWait]         info => void, as each wait starts (see requestWithCapacityRetry)
 * @param {function} [opts.onWaitEnd]      () => void, as each wait ends
 * @param {function} [opts.shouldStop]     () => boolean; true skips any further send
 * @param {object}   [opts.retryOptions]   overrides MATCH_RETRY_OPTIONS; also takes gate, onCapacity and maxWaitMs
 * @returns {Promise<object[]>} the batch's $match results, or [] when it failed, was throttled or stopped
 */
export const runMatchBatch = async ({
  rowIndexes, send, setStage, onRowFinished, onRowFailed, onRowThrottled, onPreviewLimit, onWait, onWaitEnd,
  shouldStop = () => false, retryOptions = {},
}) => {
  rowIndexes.forEach(index => setStage(index, 0))
  const result = await requestWithCapacityRetry(send, {
    ...MATCH_RETRY_OPTIONS,
    ...retryOptions,
    isCancelled: shouldStop,
    onWait,
    onWaitEnd,
  })
  if(result.ok) {
    rowIndexes.forEach(index => {
      setStage(index, 1)
      onRowFinished(index)
    })
    return result.response?.data || []
  }
  if(result.reason === 'cancelled') {
    rowIndexes.forEach(index => setStage(index, -1))
    return []
  }
  if(result.reason === 'throttled') {
    rowIndexes.forEach(index => {
      setStage(index, -4)
      onRowThrottled?.(index, {attempts: result.attempts, waitedMs: result.waitedMs})
    })
    return []
  }
  const failure = getFailure(result.error, result.attempts)
  rowIndexes.forEach(index => {
    setStage(index, -2)
    onRowFailed(index, failure)
  })
  if(failure.previewLimit)
    onPreviewLimit?.(result.error)
  return []
}

/**
 * The bulk Auto Match scheduler: runs each item through run(item) with at most
 * concurrency in flight. While the gate is paused (a request got a 429) it
 * sends nothing new, and waits for the gate to reopen or a request in flight
 * to settle, so a throttled run doesn't drain its queue into more refusals.
 * It holds the queue for at most maxHoldMs in all, however often the pause is
 * extended; after that, and for a pause longer than what's left of it, the
 * items go out and wait (or end throttled) as requests of their own.
 *
 * shouldAbort stops it at once, even while a request in flight never answers
 * (those are left to finish on their own), and returns false. shouldSkipRest
 * drops the rest of the queue, handing it to onSkipped, but waits for the
 * requests in flight. Otherwise returns true once every item ran.
 */
export const runWithConcurrency = async (items, {
  concurrency, run, shouldAbort = () => false, shouldSkipRest = () => false, onSkipped, gate = null, maxHoldMs = Infinity, pollMs,
}) => {
  const queue = items.slice()
  const active = new Set()
  let heldMs = 0
  const isHeld = () => Boolean(gate?.isPaused() && gate.pausedForMs() <= maxHoldMs - heldMs)
  while(queue.length || active.size) {
    while(queue.length && active.size < concurrency) {
      if(shouldAbort())
        return false
      if(shouldSkipRest()) {
        // Empty the queue before the optional call: onSkipped?.() skips
        // evaluating its argument when there's no callback.
        const skipped = queue.splice(0)
        onSkipped?.(skipped)
        break
      }
      if(isHeld())
        break
      const item = queue.shift()
      const promise = run(item).finally(() => active.delete(promise))
      active.add(promise)
    }
    const waitingOn = [...active]
    const holding = queue.length && active.size < concurrency && isHeld()
    if(holding)
      waitingOn.push(gate.wait(shouldAbort, {pollMs, maxMs: maxHoldMs - heldMs}))
    if(!waitingOn.length)
      continue
    const waitStartedAt = Date.now()
    const { settled } = await untilCancelled(Promise.race(waitingOn), shouldAbort, {pollMs})
    if(holding)
      heldMs += Date.now() - waitStartedAt
    if(!settled)
      return false
  }
  return true
}

/**
 * Row __index values as the 1-based row numbers a user sees in their file,
 * with runs collapsed: [60, 61, 62, 110] → '61–63, 111'.
 */
export const formatRowNumbers = (rowIndexes, {maxRanges = 10} = {}) => {
  const numbers = [...new Set(rowIndexes)].sort((a, b) => a - b).map(index => index + 1)
  const ranges = []
  numbers.forEach(number => {
    const last = ranges[ranges.length - 1]
    if(last && number === last[1] + 1)
      last[1] = number
    else
      ranges.push([number, number])
  })
  const shown = ranges.slice(0, maxRanges).map(([from, to]) => from === to ? `${from}` : `${from}–${to}`)
  if(ranges.length > maxRanges)
    shown.push('…')
  return shown.join(', ')
}

/**
 * Send one single-row $match (the row panel's match and "load more"),
 * retrying transient failures like a bulk batch (ocl_online#283) and waiting
 * out 429s for up to INTERACTIVE_WAIT_CAP_MS (ocl_issues#2849). Never rejects.
 * After the retries it gives an errorBody for the row's existing failure
 * path: the server's JSON when it carries a detail or an error_code (so a
 * preview limit still opens its dialog), else {detail, status}. throttled is
 * true when the server was still busy at the cap.
 *
 * @param {function} send  attempt => Promise<axios response>; must reject on failure
 * @param {object}   [opts.retryOptions] overrides MATCH_RETRY_OPTIONS; also takes gate, onWait, onWaitEnd, onCapacity
 * @returns {Promise<{ok: true, response: object}|{ok: false, errorBody: object, previewLimit: boolean, throttled: boolean}>}
 */
export const requestSingleMatch = async (send, { retryOptions = {} } = {}) => {
  const result = await requestWithCapacityRetry(send, {maxWaitMs: INTERACTIVE_WAIT_CAP_MS, ...MATCH_RETRY_OPTIONS, ...retryOptions})
  if(result.ok)
    return { ok: true, response: result.response }
  const err = result.error
  const data = err?.response?.data
  const hasServerBody = data && typeof data === 'object' && !Array.isArray(data) && (data.detail || data.error_code)
  const { error, status } = getFailure(err, 0)
  return {
    ok: false,
    errorBody: hasServerBody ? data : { detail: error, status },
    previewLimit: isPreviewLimitError(err),
    throttled: result.reason === 'throttled',
  }
}
