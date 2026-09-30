export const getPreviewEligibleRowIndexes = (rows, preview) => {
  if(!Array.isArray(rows))
    return []
  const rowsPerProject = preview?.rowsPerProject || {}
  if(rowsPerProject.unlimited)
    return null
  if(rowsPerProject.limit === null || rowsPerProject.limit === undefined)
    return []
  return rows.slice(0, Math.max(rowsPerProject.limit, 0)).map(row => row.__index)
}

export const getRowsToProcess = (rows, rowStatuses, autoMatchScope, selectedRowIndexes = [], eligibleRowIndexes = null) => {
  if(!Array.isArray(rows))
    return []

  const unmappedIndexes = new Set(rowStatuses?.unmapped || [])
  const reviewedIndexes = new Set(rowStatuses?.reviewed || [])
  const selectedIndexSet = new Set(selectedRowIndexes || [])
  const eligibleIndexSet = Array.isArray(eligibleRowIndexes) ? new Set(eligibleRowIndexes) : null
  const eligibleRows = eligibleIndexSet ? rows.filter(row => eligibleIndexSet.has(row.__index)) : rows

  if(autoMatchScope === 'unmapped')
    return eligibleRows.filter(row => unmappedIndexes.has(row.__index))

  if(autoMatchScope === 'selected')
    return eligibleRows.filter(row => selectedIndexSet.has(row.__index))

  if(autoMatchScope === 'allIncludingApproved')
    return eligibleRows

  return eligibleRows.filter(row => !reviewedIndexes.has(row.__index))
}

// Whether a run of this algorithm calls OCL's $match and so spends
// mapper.match_operations. scispacy and custom algorithms with their own url
// hit other services; a bridge the user can't run is skipped entirely.
export const spendsMatchQuota = (algo, { canBridge = false } = {}) => {
  if(!algo?.type)
    return false
  if(algo.type === 'ocl-scispacy')
    return false
  if(algo.type === 'custom')
    return !algo.url
  if(['ocl-bridge', 'ocl-ciel-bridge'].includes(algo.type))
    return Boolean(canBridge)
  return true
}

// Rows a run can match before it runs out of match operations: each row costs
// one operation per $match-spending algorithm. null when there is no cap.
export const getRowCapByMatchOperations = (matchOperations, matchAlgorithmCount) => {
  if(!matchOperations || matchOperations.unlimited || !matchAlgorithmCount)
    return null
  return Math.floor(Math.max(matchOperations.remaining || 0, 0) / matchAlgorithmCount)
}

// How many consecutive rows may fail, for a reason other than AI quota, before
// a run's AI step gives up. The AI Assistant charges each call before the model
// runs, so while the AI service is down every further call would spend the
// user's quota for nothing. A single bad row doesn't stop the step.
const AI_FAILURES_BEFORE_STOP = 2

export const shouldStopAIStep = ({ quotaExhausted = false, failuresInARow = 0 } = {}) =>
  quotaExhausted || failuresInARow >= AI_FAILURES_BEFORE_STOP

// The same key for every retry of one AI request: the AI Assistant charges a
// key once, and serves a call that already succeeded again for free.
export const getAIRequestIdempotencyKey = (projectId, rowIndex, requestedAt) => `${projectId}-${rowIndex}-${requestedAt}`

// FNV-1a, 32-bit: short and stable, for comparing candidate pools only.
const hashString = text => {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

// JSON with object keys sorted, so the same content always gives the same text.
const stableStringify = value => {
  if(Array.isArray(value))
    return `[${value.map(stableStringify).join(',')}]`
  if(value && typeof value === 'object')
    return `{${Object.keys(value).sort().filter(key => value[key] !== undefined).map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`
  return JSON.stringify(value) ?? 'null'
}

// A fingerprint of the candidate pool an AI analysis saw (ocl_online#258):
// each recommendable concept as sent to the AI (names, properties and so on,
// so a concept a later lookup filled in counts as changed), with the evidence
// of which algorithms surfaced it and through which bridge. Scores and search
// highlights are left out; they move between runs while the pool stays the same.
export const getCandidatePoolFingerprint = recommendableConcepts => {
  if(!Array.isArray(recommendableConcepts))
    return null
  const parts = recommendableConcepts.map(concept => {
    const content = {}
    Object.keys(concept || {}).forEach(key => {
      if(key !== 'rerank_score' && key !== 'evidence')
        content[key] = concept[key]
    })
    const evidenceParts = [...new Set((concept?.evidence || []).map(e => stableStringify({
      algorithm_id: e?.algorithm_id,
      candidate_type: e?.candidate_type,
      via: e?.via,
    })))].sort()
    return stableStringify({ ...content, evidence: evidenceParts })
  }).sort()
  return `${parts.length}-${hashString(parts.join('\n'))}`
}

// Whether a row's latest AI analysis saw this same candidate pool, so an Auto
// Match run can skip its AI step. An analysis saved before fingerprints
// existed can't be compared, so it's redone.
export const hasCurrentAnalysis = (analyses, fingerprint) => {
  const latest = Array.isArray(analyses) && analyses.length ? analyses[analyses.length - 1] : null
  return Boolean(fingerprint && latest?.candidate_pool_fingerprint === fingerprint)
}

// The ScispaCy service keys each row's results by the itemid sent, which is
// the row's index, not its position in the run (ocl_online#258).
export const getScispacyRowResults = (responseData, rowIndex) => responseData?.[rowIndex] || []

// Whether a failed ScispaCy call means the service is still starting: it
// answers 503 {status: 'warming_up'} while its host boots, then a 502 until
// the app is up. The row waits for it rather than failing.
export const isScispacyWarmingUp = (err, seenWarmingUp = false) => {
  const data = err?.response?.data
  if(data?.status === 'warming_up')
    return true
  return Boolean(seenWarmingUp && err?.response?.status === 502)
}

// The in-flight $lookups for a row's concepts. Rerank waits for them, and so
// does a bulk run's AI step, which can reach a row whose rerank was skipped
// (after a rerank quota stop), so the AI sees the looked-up concepts.
export const getPendingRowLookups = (rowState, inFlightLookups) =>
  Object.keys(rowState?.concept_rows || {})
    .filter(key => inFlightLookups.has(key))
    .map(key => inFlightLookups.get(key))

// How long a bulk run's AI step waits for a row's lookups before going ahead.
export const AI_LOOKUP_WAIT_MS = 15000

// $rerank calls in flight at once, per tab, whatever fired them: the rerank
// sweep, or the per-row reranks as batches finish (ocl_issues#2849). Each ties
// up an API worker for seconds, and a finished 10-row batch used to fire ten.
export const RERANK_MAX_IN_FLIGHT = 2

// How long rerank waits for a row's lookups before going ahead without them
// (ocl_online#283). A guard against a lookup that never settles, longer than
// the AI step's wait: a rerank that goes ahead early drops the concepts still
// being looked up, which a later rerank then scores.
export const RERANK_LOOKUP_WAIT_MS = 60000

// Resolves true once every lookup settles, or false after ms, whichever comes
// first. A lookup can stay pending for good (APIService.post answers a 429 with
// a promise that never settles), and a run must not wait on it forever. Pass a
// WeakSet as stuck to remember lookups that timed out, so later rows sharing
// them don't each wait the full timeout again.
export const waitForLookups = (lookups, ms, stuck) => {
  const waiting = (lookups || []).filter(lookup => !stuck?.has(lookup))
  if(!waiting.length)
    return Promise.resolve(true)
  const pending = new Set(waiting)
  let timer
  const timeout = new Promise(resolve => {
    timer = setTimeout(() => {
      pending.forEach(lookup => stuck?.add(lookup))
      resolve(false)
    }, ms)
  })
  const settled = Promise.all(waiting.map(lookup =>
    Promise.resolve(lookup).catch(() => null).finally(() => pending.delete(lookup))
  )).then(() => true)
  return Promise.race([settled, timeout]).finally(() => clearTimeout(timer))
}
