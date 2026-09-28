/**
 * How many rows go in one matching request, and how many requests an
 * algorithm keeps in flight, during Auto Match (ocl_online#274).
 *
 * $match is throttled per minute, not per request in flight, so a run at
 * batch 1 × 25 concurrent requests puts 25 semantic searches on the search
 * cluster at once. Everyone but core users and staff gets at most 5 requests
 * in flight of at most 10 rows each, in the form and at run time, where the
 * cap also holds a project's earlier saved settings. Core users and staff are
 * unchanged: the form's range, and whatever the project saved at run time.
 */

export const DEFAULT_BATCH_SIZE = 10
export const DEFAULT_CONCURRENT_REQUESTS = 1

const FORM_LIMITS = { batchSize: 1000, concurrentRequests: 50 }
const CAPPED_LIMITS = { batchSize: 10, concurrentRequests: 5 }

const inAuthGroup = (user, group) => Boolean(user?.auth_groups?.some(name => name.includes(group)))

export const hasFullRequestLimits = user => Boolean(user?.is_staff || user?.is_superuser || inAuthGroup(user, 'core_user'))

// The most rows per request, and requests in flight, a user may type in the form.
export const getRequestLimits = fullLimits => fullLimits ? FORM_LIMITS : CAPPED_LIMITS

const toCount = value => {
  const n = Number.parseInt(value, 10)
  return n >= 1 ? n : null
}

// The batch size and concurrency an algorithm runs with: its saved values, or
// the defaults, capped for everyone but core users and staff.
export const getRequestSettings = (algo, fullLimits) => {
  const batchSize = toCount(algo?.batch_size) || DEFAULT_BATCH_SIZE
  const concurrentRequests = toCount(algo?.concurrent_requests) || DEFAULT_CONCURRENT_REQUESTS
  if(fullLimits)
    return { batchSize, concurrentRequests }
  return {
    batchSize: Math.min(batchSize, CAPPED_LIMITS.batchSize),
    concurrentRequests: Math.min(concurrentRequests, CAPPED_LIMITS.concurrentRequests),
  }
}

// A copy of a run's algorithm carrying the settings it runs with, so the
// AutomatchRun record matches what ran. Core users and staff get it back as is.
export const applyRequestSettings = (algo, fullLimits) => {
  if(fullLimits)
    return algo
  const { batchSize, concurrentRequests } = getRequestSettings(algo, fullLimits)
  return { ...algo, batch_size: batchSize, concurrent_requests: concurrentRequests }
}
