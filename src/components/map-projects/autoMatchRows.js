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
