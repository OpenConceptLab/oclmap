/**
 * How many rows go in one matching request, and how many requests an
 * algorithm keeps in flight, during Auto Match (ocl_online#274, #517).
 *
 * The most a user can set in the form comes from the getMapperSettings
 * checkpoint ('@openconceptlab/oclmap-extensions'); the open build allows the
 * form's full range. Below that range, a project's earlier saved settings run
 * within it too. At run time the server can lower requests in flight further
 * (its suggested concurrency, services/capacity.js).
 */

export const DEFAULT_BATCH_SIZE = 10
export const DEFAULT_CONCURRENT_REQUESTS = 1

const FORM_RANGE = { batchSize: 1000, concurrentRequests: 50 }

const toCount = value => {
  const n = Number.parseInt(value, 10)
  return n >= 1 ? n : null
}

// The form's maximums from the checkpoint's {batchSize, concurrentRequests},
// within the form's range. capped: true when either is below the range, so the
// form shows its maximum and saved settings run within it; false runs saved
// settings as they are.
export const getRequestLimits = settings => {
  const batchSize = Math.min(toCount(settings?.batchSize) || FORM_RANGE.batchSize, FORM_RANGE.batchSize)
  const concurrentRequests = Math.min(toCount(settings?.concurrentRequests) || FORM_RANGE.concurrentRequests, FORM_RANGE.concurrentRequests)
  return {
    batchSize,
    concurrentRequests,
    capped: batchSize < FORM_RANGE.batchSize || concurrentRequests < FORM_RANGE.concurrentRequests,
  }
}

const OPEN_LIMITS = getRequestLimits()

// The batch size and concurrency an algorithm runs with: its saved values, or
// the defaults, within the user's limits (getRequestLimits).
export const getRequestSettings = (algo, limits = OPEN_LIMITS) => {
  const batchSize = toCount(algo?.batch_size) || DEFAULT_BATCH_SIZE
  const concurrentRequests = toCount(algo?.concurrent_requests) || DEFAULT_CONCURRENT_REQUESTS
  if(!limits.capped)
    return { batchSize, concurrentRequests }
  return {
    batchSize: Math.min(batchSize, limits.batchSize),
    concurrentRequests: Math.min(concurrentRequests, limits.concurrentRequests),
  }
}

// A copy of a run's algorithm carrying the settings it runs with, so the
// AutomatchRun record matches what ran. Uncapped, it comes back as is.
export const applyRequestSettings = (algo, limits = OPEN_LIMITS) => {
  if(!limits.capped)
    return algo
  const { batchSize, concurrentRequests } = getRequestSettings(algo, limits)
  return { ...algo, batch_size: batchSize, concurrent_requests: concurrentRequests }
}
