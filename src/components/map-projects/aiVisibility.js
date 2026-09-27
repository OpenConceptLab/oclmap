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
