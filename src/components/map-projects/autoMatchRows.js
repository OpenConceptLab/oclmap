export const getRowsToProcess = (rows, rowStatuses, autoMatchScope, selectedRowIndexes = []) => {
  if(!Array.isArray(rows))
    return []

  const unmappedIndexes = new Set(rowStatuses?.unmapped || [])
  const reviewedIndexes = new Set(rowStatuses?.reviewed || [])
  const selectedIndexSet = new Set(selectedRowIndexes || [])

  if(autoMatchScope === 'unmapped')
    return rows.filter(row => unmappedIndexes.has(row.__index))

  if(autoMatchScope === 'selected')
    return rows.filter(row => selectedIndexSet.has(row.__index))

  if(autoMatchScope === 'allIncludingApproved')
    return rows

  return rows.filter(row => !reviewedIndexes.has(row.__index))
}
