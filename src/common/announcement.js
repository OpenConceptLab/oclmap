// The deployment's announcement banner, from its optional ANNOUNCEMENT setting
// (README, "Announcement banner"). start-prod.sh writes the setting into
// env-config.js as a string, and it's parsed and checked here, so a malformed
// setting shows no banner instead of breaking the page. text and each link
// label need an "en" entry, the fallback for other languages.

const DISMISSED_KEY = 'announcementDismissed'

// The longest wait between checks of until, so a timer that a sleeping laptop
// or a clock change delays can't keep an ended banner up for long.
const MAX_DELAY = 60 * 1000

const isObject = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const has = (object, key) => Object.prototype.hasOwnProperty.call(object, key)

// The entry for language, then for its base language (es for es-MX), then en.
const localize = (strings, language) => {
  if(!isObject(strings) || !Object.values(strings).every(value => typeof value === 'string') || !has(strings, 'en') || !strings.en.trim())
    return null
  const code = [language, language?.split('-')[0]].find(tag => tag && has(strings, tag) && strings[tag].trim())
  return strings[code || 'en']
}

const httpsURL = url => {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' ? parsed.href : null
  } catch {
    return null
  }
}

// What the banner shows in language at now: {id, text, links: [{label, url}],
// until} (until in ms, or null), or null when the setting is unset, malformed
// or past its until.
export const getAnnouncement = (raw, language, now) => {
  let setting
  try {
    setting = JSON.parse(raw)
  } catch {
    return null
  }
  if(!isObject(setting) || typeof setting.id !== 'string' || !setting.id.trim())
    return null

  const text = localize(setting.text, language)
  if(!text || !Array.isArray(setting.links))
    return null

  const links = setting.links.map(link => ({label: localize(link?.label, language), url: httpsURL(link?.url)}))
  if(links.some(link => !link.label || !link.url))
    return null

  let until = null
  if(setting.until !== undefined) {
    until = typeof setting.until === 'string' ? Date.parse(setting.until) : NaN
    if(Number.isNaN(until) || now >= until)
      return null
  }

  return {id: setting.id, text, links, until}
}

// How long until a shown banner must be checked again, so that it hides at its
// until while the page stays open: null when it has no until.
export const msUntilExpiry = (announcement, now) =>
  announcement.until ? Math.min(announcement.until - now, MAX_DELAY) : null

export const isDismissed = id => {
  try {
    return localStorage.getItem(DISMISSED_KEY) === id
  } catch {
    return false
  }
}

export const rememberDismissal = id => {
  try {
    localStorage.setItem(DISMISSED_KEY, id)
  } catch {
    // storage unavailable (private mode, blocked cookies); the banner simply reappears
  }
}
