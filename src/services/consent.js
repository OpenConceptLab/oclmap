// The person's choice about optional tracking in the Mapper
// (OpenConceptLab/ocl_online#533). Nothing optional loads until they choose:
// no choice, an unreadable one, or one saved under another CONSENT_VERSION all
// grant nothing.
//
// The choice is kept in this browser only. Another device, or clearing site data,
// asks again. Bump CONSENT_VERSION when a category is added, or when what one
// covers changes, so everyone is asked again.
//
// Essential storage (sign-in, language, this choice) needs no consent and is not
// a category. GA4 (GAService) is not gated yet: see
// docs/ocl_online-533-hotjar-heatmaps-plan.md, "Open decisions".

export const CONSENT_KEY = 'privacyConsent'
export const CONSENT_VERSION = 1

// heatmaps: Hotjar heatmaps and the session capture they are built from (HotjarService)
export const CATEGORIES = ['heatmaps']

const defaultStorage = () => {
  try {
    return localStorage
  } catch {
    return undefined
  }
}

export const getConsent = (storage = defaultStorage()) => {
  try {
    const consent = JSON.parse(storage?.getItem(CONSENT_KEY) || 'null')
    return consent?.version === CONSENT_VERSION ? consent : null
  } catch {
    return null
  }
}

export const hasDecided = (storage = defaultStorage()) => Boolean(getConsent(storage))

export const isGranted = (category, storage = defaultStorage()) => getConsent(storage)?.[category] === true

const listeners = new Set()

// listener(consent, previous) after every save; returns the unsubscribe function
export const onConsentChange = listener => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export const saveConsent = (choices, { storage = defaultStorage(), now = () => new Date() } = {}) => {
  const previous = getConsent(storage)
  const consent = { version: CONSENT_VERSION, decidedAt: now().toISOString() }
  CATEGORIES.forEach(category => { consent[category] = choices?.[category] === true })
  try {
    storage?.setItem(CONSENT_KEY, JSON.stringify(consent))
  } catch {
    // storage unavailable (private mode, blocked cookies): the choice holds for this page only
  }
  listeners.forEach(listener => listener(consent, previous))
  return consent
}

const allCategories = granted => Object.fromEntries(CATEGORIES.map(category => [category, granted]))

export const acceptAll = options => saveConsent(allCategories(true), options)
export const rejectAll = options => saveConsent(allCategories(false), options)
