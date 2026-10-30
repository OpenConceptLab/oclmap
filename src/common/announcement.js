// The deployment's announcement banner, from its optional ANNOUNCEMENT setting
// (README, "Announcement banner"). start-prod.sh writes the setting into
// env-config.js as a string, and it's parsed and checked here, so a malformed
// setting shows no banner instead of breaking the page. text and each link
// label need an "en" entry, the fallback for other languages.

const DISMISSED_KEY = 'announcementDismissed'

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

// What the banner shows in language at now: {id, text, links: [{label, url}]},
// or null when the setting is unset, malformed or past its until.
export const getAnnouncement = (raw, language, now = Date.now()) => {
  if(typeof raw !== 'string' || !raw.trim())
    return null
  let setting
  try {
    setting = JSON.parse(raw)
  } catch {
    return null
  }
  if(!isObject(setting) || typeof setting.id !== 'string' || !setting.id.trim())
    return null

  const text = localize(setting.text, language)
  const links = setting.links === undefined ? [] : setting.links
  if(!text || !Array.isArray(links))
    return null

  const shown = []
  for(const link of links) {
    const label = isObject(link) ? localize(link.label, language) : null
    const url = isObject(link) ? httpsURL(link.url) : null
    if(!label || !url)
      return null
    shown.push({label, url})
  }

  if(setting.until !== undefined) {
    const until = typeof setting.until === 'string' ? Date.parse(setting.until) : NaN
    if(Number.isNaN(until) || now >= until)
      return null
  }

  return {id: setting.id, text, links: shown}
}

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
