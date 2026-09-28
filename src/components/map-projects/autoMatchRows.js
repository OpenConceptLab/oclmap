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

// A fingerprint of the candidate pool an AI analysis saw (ocl_online#258):
// each recommendable concept with the algorithms that surfaced it. Scores are
// left out; they move between runs while the pool stays the same.
export const getCandidatePoolFingerprint = recommendableConcepts => {
  if(!Array.isArray(recommendableConcepts))
    return null
  const parts = recommendableConcepts.map(concept => {
    const algorithmIds = [...new Set((concept?.evidence || []).map(e => e?.algorithm_id))].sort()
    return `${concept?.concept_key}:${algorithmIds.join(',')}`
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
