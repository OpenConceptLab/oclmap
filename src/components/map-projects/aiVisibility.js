// An AI recommendation's internals are staff-only (ocl_online#254): the model,
// the prompt template and its URI, and the raw JSON that carries them.
// Everyone else sees the assessment and the candidates only.
export const canSeeAIInternals = user => Boolean(user?.is_staff || user?.is_superuser)

// What a user can choose for the OCL AI Assistant (ocl_online#259):
// - the model and the prompt template: staff only, like seeing them. The AI
//   Assistant honours a model override from staff only, so everyone else runs
//   the project's template on that template's default model.
// - the output language: staff, and users an admin has granted it to
//   (OpenConceptLab/ocl_online#517).
export const AI_OUTPUT_LOCALE_PERMISSION = 'users.mapper_ai_output_locale'

export const getAIAssistantChoices = user => ({
  canSelectAIModel: canSeeAIInternals(user),
  canSetAIOutputLocale: Boolean(
    canSeeAIInternals(user) || user?.permissions?.includes(AI_OUTPUT_LOCALE_PERMISSION)
  ),
})

// The model that actually answered, from the AI Assistant's reply. Record this
// rather than the UI's selection, which the AI Assistant ignores for non-staff.
export const getModelUsed = response => response?.metadata?.model_used || null

// The prompt template key a run uses and a save records. Staff pick a template,
// so theirs wins. Everyone else can't pick, so the project's configured key
// stands. A template fetched before the project loaded may still be in state,
// and must not replace the project's key in the run or the save.
export const getPromptTemplateKey = ({ canSelect, selectedKey, configuredKey, fallbackKey = '' }) =>
  (canSelect && selectedKey) || configuredKey || fallbackKey || ''

// Which template a user runs when the project names none. Generative calls keep
// the chat default; a user entitled to decision calls but not to generative
// ones gets the decision default. The server enforces the allowance either way
// (and never falls back from one to the other), so this only avoids offering a
// template the user can't run. -1 is the kill switch, a blocked allowance.
export const AI_CALLS_CAPABILITY = 'ai_assistant.calls'
export const AI_DECISION_CALLS_CAPABILITY = 'ai_assistant.decision_calls'

const isEntitled = (user, capability) =>
  (user?.capabilities || []).some(entry => entry?.name === capability && entry.limit !== -1)

export const getDefaultPromptTemplateKey = ({ user, chatKey, decisionKey }) =>
  !isEntitled(user, AI_CALLS_CAPABILITY) && isEntitled(user, AI_DECISION_CALLS_CAPABILITY) ? decisionKey : chatKey

// What the log says about an analysis: the rationale when the model wrote one,
// else the recommendation and primary code. A decision model returns no
// rationale; the log must still read as a sentence, never "undefined".
export const getAIRecommendationDescription = data => {
  const output = data?.output || data
  if(output?.rationale?.narrative || output?.rationale)
    return output.rationale
  return [output?.recommendation, output?.primary_candidate?.canonical_reference?.code].filter(Boolean).join(' ')
}

// Numbers requests so that only the latest one's response is applied. A slow
// response for a key that's no longer configured is dropped.
export const createLatestRequestGate = () => {
  let latest = 0
  return {
    next: () => ++latest,
    isCurrent: ticket => ticket === latest,
  }
}
