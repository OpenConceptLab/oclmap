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

// Without a leading '/', a value like '@host/x' would change the request's host.
export const joinAPIPath = (apiURL, path) => {
  const value = String(path ?? '')
  return `${apiURL}${value.startsWith('/') ? '' : '/'}${value}`
}
