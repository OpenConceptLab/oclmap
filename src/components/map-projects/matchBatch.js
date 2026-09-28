/**
 * One bulk Auto Match $match batch (ocl_online#257).
 *
 * APIService.post resolves on a network error (with error.message) and on a
 * 5xx, so a batch that got no answer used to look like a success with no
 * candidates. The caller's `send` must reject instead (service.request does),
 * so a failure is caught here, retried when it's transient, and reported per
 * row.
 */
import { isPreviewLimitError } from './previewLimits.js'
import { isTransientNetworkError, retryWithBackoff } from '../../services/retry.js'

// The gateway answers these while the API rolls out or a task restarts. A 500
// comes from the API itself, and retrying it only adds load.
const RETRYABLE_STATUSES = new Set([502, 503, 504])

export const MATCH_RETRY_OPTIONS = {maxRetries: 2, baseDelayMs: 3000, backoffFactor: 4, jitterFactor: 0.25}

export const isRetryableMatchError = err =>
  isTransientNetworkError(err) || RETRYABLE_STATUSES.has(err?.response?.status)

const getFailure = (err, attempts) => ({
  error: err?.response?.data?.detail || err?.message || 'unknown',
  status: err?.response?.status || null,
  attempts,
  previewLimit: isPreviewLimitError(err),
})

/**
 * Mark the batch's rows running, send it (retrying transient failures), then
 * mark each row done (1) or failed (-2). Never rejects.
 *
 * @param {object}   opts
 * @param {number[]} opts.rowIndexes       the batch's row __index values
 * @param {function} opts.send             attempt => Promise<axios response>; must reject on failure
 * @param {function} opts.setStage         (rowIndex, stage) => void
 * @param {function} opts.onRowFinished    rowIndex => void
 * @param {function} opts.onRowFailed      (rowIndex, {error, status, attempts, previewLimit}) => void
 * @param {function} [opts.onPreviewLimit] err => void, for a preview-limit 403 (never retried)
 * @param {function} [opts.isCancelled]    stops further retries once true
 * @param {object}   [opts.retryOptions]   overrides MATCH_RETRY_OPTIONS
 * @returns {Promise<object[]>} the batch's $match results, or [] when it failed
 */
export const runMatchBatch = async ({
  rowIndexes, send, setStage, onRowFinished, onRowFailed, onPreviewLimit, isCancelled = () => false, retryOptions = {},
}) => {
  rowIndexes.forEach(index => setStage(index, 0))
  let attempts = 0
  let response
  try {
    response = await retryWithBackoff(attempt => {
      attempts = attempt + 1
      return send(attempt)
    }, {...MATCH_RETRY_OPTIONS, ...retryOptions, isCancelled, isRetryable: isRetryableMatchError})
  } catch (err) {
    const failure = getFailure(err, attempts)
    rowIndexes.forEach(index => {
      setStage(index, -2)
      onRowFailed(index, failure)
    })
    if(failure.previewLimit)
      onPreviewLimit?.(err)
    return []
  }
  rowIndexes.forEach(index => {
    setStage(index, 1)
    onRowFinished(index)
  })
  return response?.data || []
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
