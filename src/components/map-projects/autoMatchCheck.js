// Checkpoints for AutoMatch (OpenConceptLab/ocl_online#465). The app imports
// them as '@openconceptlab/oclmap-extensions'; webpack resolves that name to an installed
// package when there is one, and to this file otherwise.
//
// useAutoMatchCheck receives what the user has selected in the dialog:
// {open, autoMatchScope, rowsToMatchCount, totalRows, retrieveCandidates,
//  matchAlgorithmCount, runAI, isAIOnly, aiRowsToAnalyse, inAIAssistantGroup}
// and returns {summary: ReactNode | null, notices: [{key, severity, text,
// confirm?, blocks?}]}: a summary shown next to Submit, and notices that can
// ask the user to confirm or block the run. Here it adds nothing and never
// blocks.
// eslint-disable-next-line no-unused-vars
const useAutoMatchCheck = selection => ({summary: null, notices: []})

// Whether the OCL AI Assistant may start ticked when the dialog opens.
export const aiOnByDefault = () => true

// The most rows a run may include, given {matchAlgorithmCount}, or null for
// all of the rows in its scope. A run takes its scope's first rows.
// eslint-disable-next-line no-unused-vars
export const getMaxRunRows = run => null

export default useAutoMatchCheck
