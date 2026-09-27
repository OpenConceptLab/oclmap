// An AI recommendation's internals are staff-only (ocl_online#254): the model,
// the prompt template and its URI, and the raw JSON that carries them. Core,
// early-access and preview users see the assessment and the candidates only.
export const canSeeAIInternals = user => Boolean(user?.is_staff || user?.is_superuser)
