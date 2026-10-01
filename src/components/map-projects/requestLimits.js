/**
 * How many rows go in one matching request, and how many requests an
 * algorithm keeps in flight, during Auto Match (ocl_online#274).
 *
 * $match is throttled per minute, not per request in flight, so a run at
 * batch 1 × 25 concurrent requests puts 25 semantic searches on the search
 * cluster at once. Everyone but core users and staff gets at most 10 rows per
 * request, in the form and at run time, where the cap also holds a project's
 * earlier saved settings: early-access users up to 5 requests in flight,
 * preview users 2 (ocl_issues#2849), since many previews at once could fill
 * the server's matching capacity. Core users and staff are unchanged: the
 * form's range, and whatever the project saved at run time.
 */

export const DEFAULT_BATCH_SIZE = 10
export const DEFAULT_CONCURRENT_REQUESTS = 1

const FULL_LIMITS = { batchSize: 1000, concurrentRequests: 50, capped: false }
const EARLY_ACCESS_LIMITS = { batchSize: 10, concurrentRequests: 5, capped: true }
const PREVIEW_LIMITS = { batchSize: 10, concurrentRequests: 2, capped: true }

const inAuthGroup = (user, group) => Boolean(user?.auth_groups?.some(name => name.includes(group)))

export const hasFullRequestLimits = user => Boolean(user?.is_staff || user?.is_superuser || inAuthGroup(user, 'core_user'))

// The most rows per request, and requests in flight, a user may type in the
// form, by their highest tier. capped: false for core users and staff, whose
// saved settings run as they are.
export const getRequestLimits = user => {
  if(hasFullRequestLimits(user))
    return FULL_LIMITS
  if(inAuthGroup(user, 'early_access'))
    return EARLY_ACCESS_LIMITS
  return PREVIEW_LIMITS
}

const toCount = value => {
  const n = Number.parseInt(value, 10)
  return n >= 1 ? n : null
}

// The batch size and concurrency an algorithm runs with: its saved values, or
// the defaults, within the user's limits (getRequestLimits).
export const getRequestSettings = (algo, limits = PREVIEW_LIMITS) => {
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
// AutomatchRun record matches what ran. Core users and staff get it back as is.
export const applyRequestSettings = (algo, limits = PREVIEW_LIMITS) => {
  if(!limits.capped)
    return algo
  const { batchSize, concurrentRequests } = getRequestSettings(algo, limits)
  return { ...algo, batch_size: batchSize, concurrent_requests: concurrentRequests }
}
