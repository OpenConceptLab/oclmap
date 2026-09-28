/**
 * How many rows go in one matching request, and how many requests an
 * algorithm keeps in flight, during Auto Match (ocl_online#274).
 *
 * $match is throttled per minute, not per request in flight, so a run at
 * batch 1 × 25 concurrent requests puts 25 semantic searches on the search
 * cluster at once. Core users and staff keep the form's full range; everyone
 * else gets at most 5 requests in flight of at most 10 rows each. Auto Match
 * applies the same limits to the settings a project saved earlier.
 */

export const DEFAULT_BATCH_SIZE = 10
export const DEFAULT_CONCURRENT_REQUESTS = 1

const FULL_LIMITS = { batchSize: 1000, concurrentRequests: 50 }
const CAPPED_LIMITS = { batchSize: 10, concurrentRequests: 5 }

const inAuthGroup = (user, group) => Boolean(user?.auth_groups?.some(name => name.includes(group)))

export const hasFullRequestLimits = user => Boolean(user?.is_staff || user?.is_superuser || inAuthGroup(user, 'core_user'))

// The most rows per request, and requests in flight, a user may set.
export const getRequestLimits = fullLimits => fullLimits ? FULL_LIMITS : CAPPED_LIMITS

const toCount = value => {
  const n = Number.parseInt(value, 10)
  return n >= 1 ? n : null
}

// The batch size and concurrency Auto Match runs an algorithm with: its saved
// values, or the defaults, within the limits.
export const getRequestSettings = (algo, limits) => ({
  batchSize: Math.min(toCount(algo?.batch_size) || DEFAULT_BATCH_SIZE, limits.batchSize),
  concurrentRequests: Math.min(toCount(algo?.concurrent_requests) || DEFAULT_CONCURRENT_REQUESTS, limits.concurrentRequests),
})
