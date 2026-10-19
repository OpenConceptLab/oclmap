// Checkpoint for the AutoMatch dialog (OpenConceptLab/ocl_online#465). The
// dialog imports it as 'ocl-online-mapper'; webpack resolves that name to an
// installed private package when there is one, and to this file otherwise.
//
// useAutoMatchCheck receives what the user has selected:
// {open, autoMatchScope, rowsToMatchCount, totalRows, retrieveCandidates,
//  matchAlgorithmCount, runAI, isAIOnly, aiRowsToAnalyse, inAIAssistantGroup}
// and returns {summary: ReactNode | null, notices: [{key, severity, text,
// confirm?, blocks?}]}: a summary shown next to Submit, and notices that can
// ask the user to confirm or block the run. Here it adds nothing and never
// blocks.
// eslint-disable-next-line no-unused-vars
const useAutoMatchCheck = selection => ({summary: null, notices: []})

// Whether the OCL AI Assistant starts ticked on a project's first AutoMatch.
export const aiOnByDefault = () => true

export default useAutoMatchCheck
