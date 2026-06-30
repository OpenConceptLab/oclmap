import React from 'react'

import Checkbox from '@mui/material/Checkbox'
import { useGridApiContext } from '@mui/x-data-grid'
import { useGridVisibleRows } from '@mui/x-data-grid/internals'

const DataGridPageSelectionHeaderCheckbox = React.memo(({ selectedRowIds, onSelectionChange }) => {
  const apiRef = useGridApiContext()
  const visibleRows = useGridVisibleRows(apiRef)
  const pageRowIds = React.useMemo(
    () => (visibleRows?.rows || []).map(row => row.id),
    [visibleRows]
  )
  const selectedRowIdSet = React.useMemo(() => new Set(selectedRowIds.map(id => id?.toString())), [selectedRowIds])
  const selectablePageRowIds = React.useMemo(
    () => pageRowIds.filter(id => apiRef.current.getRow(id) && apiRef.current.isRowSelectable(id)),
    [apiRef, pageRowIds]
  )

  const selectedPageCount = React.useMemo(
    () => selectablePageRowIds.filter(id => selectedRowIdSet.has(id?.toString())).length,
    [selectablePageRowIds, selectedRowIdSet]
  )

  const isChecked = selectablePageRowIds.length > 0 && selectedPageCount === selectablePageRowIds.length
  const isIndeterminate = selectedPageCount > 0 && selectedPageCount < selectablePageRowIds.length

  const handleChange = React.useCallback((event) => {
    const checked = event.target.checked
    const nextSelectedIds = new Set(selectedRowIds)

    selectablePageRowIds.forEach((id) => {
      if(checked)
        nextSelectedIds.add(id)
      else
        nextSelectedIds.delete(id)
    })

    onSelectionChange({
      type: 'include',
      ids: nextSelectedIds,
    })
  }, [onSelectionChange, selectablePageRowIds, selectedRowIds])

  return (
    <Checkbox
      size='small'
      indeterminate={isIndeterminate}
      checked={isChecked}
      onChange={handleChange}
      inputProps={{ 'aria-label': 'Select current page rows' }}
    />
  )
})

export default DataGridPageSelectionHeaderCheckbox
