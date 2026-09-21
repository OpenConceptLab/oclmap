export const getPreviewEligibleRowIndexes = (rows, preview) => {
  if(!Array.isArray(rows))
    return []
  const rowsPerProject = preview?.rowsPerProject || {}
  if(rowsPerProject.unlimited || rowsPerProject.limit === null || rowsPerProject.limit === undefined)
    return null
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
