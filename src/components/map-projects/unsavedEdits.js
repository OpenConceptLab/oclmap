// Edits the Mapper must see as unsaved (ocl_online#786).

// A proposal's fields are saved with the project, like a review note, so an
// edit schedules an autosave. Without one, leaving right after the edit (the
// save on leave, the beforeunload prompt) would miss it.
export const PROPOSAL_CHANGE = 'proposal_change'

export const editProposed = ({ rowIndex, state, setProposed, scheduleAutoSave }) => {
  setProposed(prev => ({ ...prev, [rowIndex]: { ...state } }))
  scheduleAutoSave(PROPOSAL_CHANGE)
}

// Configure's snapshot of the columns: what the mapping controls write (the
// column's label, its target source, cleared on purpose) and how it shows.
// A mapping-only change then saves when Configure closes and counts as
// unsaved before that.
export const getColumnsSnapshot = (columns, { columnVisibilityModel = {}, columnWidth = {}, AIAssistantColumns = {} } = {}) =>
  (columns || []).map(col => ({
    dataKey: col.dataKey,
    label: col.label || '',
    targetSource: col.targetSource || null,
    unmapped: Boolean(col.unmapped),
    hidden: columnVisibilityModel[col.dataKey] === false,
    width: columnWidth[col.dataKey] || undefined,
    ai_assistant_hidden: AIAssistantColumns[col.dataKey] === false,
  }))
