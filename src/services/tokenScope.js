// The signed-in user's token belongs to the OCL API only (ocl_online#522).

// A relative URL (such as an API_URL of '/api') is on the page's own origin.
const originOf = url => {
  try {
    return new URL(url, typeof window === 'undefined' ? undefined : window.location?.href).origin
  } catch {
    return null
  }
}

export const isAPIHost = (url, apiURL) => {
  const origin = originOf(url)
  return Boolean(origin) && origin === originOf(apiURL)
}

// The token to send: the user's own token only to the API host; any other
// token (such as one configured on a project) goes where it was given.
export const scopeToken = (token, url, apiURL, userToken) =>
  token && token === userToken && !isAPIHost(url, apiURL) ? null : token

// Without a leading '/', a value like '@host/x' would change the request's host.
export const joinAPIPath = (apiURL, path) => {
  const value = String(path ?? '')
  return `${apiURL}${value.startsWith('/') ? '' : '/'}${value}`
}
