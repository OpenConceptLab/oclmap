// Which token a request gets (ocl_online#522). `false` means no token: APIService
// sends no Authorization header for it, where null or undefined falls back to
// the signed-in user's token.

// A relative URL (such as an API_URL of '/api') is on the page's own origin.
const originOf = url => {
  try {
    return new URL(url, typeof window === 'undefined' ? undefined : window.location?.href).origin
  } catch {
    return null
  }
}

// Exact origin match (scheme, host and port).
export const isAPIHost = (url, apiURL) => {
  const origin = originOf(url)
  return Boolean(origin) && origin === originOf(apiURL)
}

// A custom algorithm uses only the token provided with it, or none. Any other
// algorithm returns null, the default: the user's token, to an OCL service.
export const matchToken = algo =>
  (algo?.type === 'custom' && algo?.url) ? (algo.token || false) : null

// A lookup uses the configured token if there is one. Otherwise the user's
// token goes to the OCL API, and nothing goes to any other host.
export const lookupToken = (configToken, url, apiURL, userToken) =>
  configToken || (isAPIHost(url, apiURL) ? userToken : false)

// The configured lookup token goes only to the lookup's own origin: its URL's, or
// the API's for a path. Elsewhere, such as an OCL concept's own URL, lookupToken
// decides without it.
export const lookupTokenFor = (config, url, apiURL, userToken) =>
  lookupToken(isAPIHost(url, isAbsoluteURL(config?.url) ? config.url : apiURL) ? config?.token : undefined, url, apiURL, userToken)

// Without a leading '/', a value like '@host/x' would change the request's host.
export const joinAPIPath = (apiURL, path) => {
  const value = String(path ?? '')
  return `${apiURL}${value.startsWith('/') ? '' : '/'}${value}`
}

// Only an http(s):// URL, in any case, is absolute; anything else is a path on the OCL API.
export const isAbsoluteURL = url => /^https?:\/\//i.test(String(url ?? ''))

// A lookup the Mapper sends to the OCL API: none (the target repo), a path, or
// a URL on the API's origin. The API doesn't save a token for one.
export const isOCLAPILookupURL = (url, apiURL) =>
  !url || !isAbsoluteURL(url) || isAPIHost(url, apiURL)

// The API never returns a saved token, only has_token. A custom algorithm with
// a saved key needs it entered again before it can run in this session.
export const needsSessionToken = algo =>
  Boolean(algo?.type === 'custom' && algo?.url && algo?.has_token && !algo?.token)

// The same for a lookup on another host.
export const needsSessionLookupToken = (config, apiURL) =>
  Boolean(config?.has_token && !config?.token && !isOCLAPILookupURL(config?.url, apiURL))

// The URL a loaded entry's token was saved with, kept locally so has_token
// comes back if the URL is edited back to it. Never sent to the API.
export const TOKEN_URL_KEY = '__token_url'

export const withSavedTokenURL = entry =>
  entry?.has_token ? {...entry, [TOKEN_URL_KEY]: entry.url} : entry

export const getTokenFlag = (entry, url) =>
  (entry?.[TOKEN_URL_KEY] && url === entry[TOKEN_URL_KEY]) ? true : undefined

// An emptied field keeps a saved token (the key is left out); '' clears one
// only once removeSavedToken has been used.
export const tokenInputValue = (entry, value) =>
  value?.trim() ? value : (entry?.[TOKEN_URL_KEY] ? undefined : '')

export const removeSavedToken = entry =>
  ({...entry, token: '', has_token: undefined, [TOKEN_URL_KEY]: undefined})

// The entry as sent to the API: without the Mapper's own local keys.
export const withoutLocalKeys = entry => {
  if(!entry || typeof entry !== 'object')
    return entry
  return Object.fromEntries(Object.entries(entry).filter(([key]) => key !== '__key' && key !== TOKEN_URL_KEY))
}

const TOKEN_KEYS = ['token', 'has_token', TOKEN_URL_KEY]

// Removes tokens and their flags, at any depth: for copies and run snapshots.
export const withoutTokens = value => {
  if(Array.isArray(value))
    return value.map(withoutTokens)
  if(value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).filter(([key]) => !TOKEN_KEYS.includes(key)).map(([key, val]) => [key, withoutTokens(val)])
    )
  return value
}
