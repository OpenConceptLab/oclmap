// An AI recommendation's internals are staff-only (ocl_online#254): the model,
// the prompt template and its URI, and the raw JSON that carries them. Core,
// early-access and preview users see the assessment and the candidates only.
export const canSeeAIInternals = user => Boolean(user?.is_staff || user?.is_superuser)

const inAuthGroup = (user, group) => Boolean(user?.auth_groups?.some(name => name.includes(group)))

// What a user can choose for the OCL AI Assistant (ocl_online#259):
// - the model and the prompt template: staff only, like seeing them. The AI
//   Assistant honours a model override from staff only, so everyone else runs
//   the project's template on that template's default model.
// - the output language: staff, core, early-access and unlimited-AI users.
export const getAIAssistantChoices = (user, { unlimitedAICalls = false } = {}) => ({
  canSelectAIModel: canSeeAIInternals(user),
  canSetAIOutputLocale: Boolean(
    canSeeAIInternals(user) || unlimitedAICalls ||
    inAuthGroup(user, 'core_user') || inAuthGroup(user, 'early_access')
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

// Numbers requests so that only the latest one's response is applied. A slow
// response for a key that's no longer configured is dropped.
export const createLatestRequestGate = () => {
  let latest = 0
  return {
    next: () => ++latest,
    isCurrent: ticket => ticket === latest,
  }
}
