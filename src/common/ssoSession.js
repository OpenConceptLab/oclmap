/*eslint no-process-env: 0*/
/*eslint no-undef: 0*/
const SILENT_PAGE = '/silent-sso.html'
const MESSAGE_TYPE = 'ocl-silent-sso'
const DEFAULT_TIMEOUT_MS = 3000

const runtime = () => typeof window !== 'undefined' ? window : {}

const buildTimeSettings = () => {
  try {
    return {
      serverURL: process.env.OIDC_SERVER_URL,
      realm: process.env.OIDC_REALM,
      clientId: process.env.OIDC_RP_CLIENT_ID,
    }
  } catch {
    return {}
  }
}

export const getSSOConfig = () => {
  const built = buildTimeSettings()
  return {
    serverURL: (runtime().OIDC_SERVER_URL || built.serverURL || '').replace(/\/+$/, ''),
    realm: runtime().OIDC_REALM || built.realm || '',
    clientId: runtime().OIDC_RP_CLIENT_ID || built.clientId || '',
  }
}

export const isSSOSessionEnabled = () => {
  const { serverURL, realm, clientId } = getSSOConfig()
  return Boolean(serverURL && realm && clientId)
}

const base64UrlEncode = buffer => {
  let binary = ''
  new Uint8Array(buffer).forEach(byte => { binary += String.fromCharCode(byte) })
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

const randomString = length => {
  const bytes = new Uint8Array(length)
  globalThis.crypto.getRandomValues(bytes)
  return base64UrlEncode(bytes.buffer).slice(0, length)
}

const codeChallengeFor = async verifier => {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return base64UrlEncode(digest)
}

export const getSilentRedirectURI = () => window.location.origin + SILENT_PAGE

export const buildSilentAuthURL = ({ serverURL, realm, clientId, redirectURI, state, nonce, codeChallenge }) => {
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    scope: 'openid',
    prompt: 'none',
    redirect_uri: redirectURI,
    state,
    nonce,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  })
  return `${serverURL}/realms/${encodeURIComponent(realm)}/protocol/openid-connect/auth?${params.toString()}`
}

const waitForSilentAnswer = (url, state, timeoutMs) => new Promise(resolve => {
  const iframe = document.createElement('iframe')
  iframe.setAttribute('aria-hidden', 'true')
  iframe.tabIndex = -1
  iframe.style.display = 'none'

  let timer
  const finish = result => {
    clearTimeout(timer)
    window.removeEventListener('message', onMessage)
    iframe.remove()
    resolve(result)
  }
  const onMessage = event => {
    const data = event.data
    if(event.origin !== window.location.origin || event.source !== iframe.contentWindow)
      return
    if(!data || data.type !== MESSAGE_TYPE || data.state !== state)
      return
    finish(data.code ? { code: data.code } : { error: data.error || 'unknown_error' })
  }

  window.addEventListener('message', onMessage)
  timer = setTimeout(() => finish({ error: 'timeout' }), timeoutMs)
  iframe.src = url
  document.body.appendChild(iframe)
})

const runSilentSignIn = async (exchangeCode, timeoutMs = DEFAULT_TIMEOUT_MS) => {
  if(!isSSOSessionEnabled())
    return null
  const { serverURL, realm, clientId } = getSSOConfig()
  const redirectURI = getSilentRedirectURI()
  const codeVerifier = randomString(64)
  const state = randomString(32)
  const url = buildSilentAuthURL({
    serverURL, realm, clientId, redirectURI, state,
    nonce: randomString(32),
    codeChallenge: await codeChallengeFor(codeVerifier),
  })

  const answer = await waitForSilentAnswer(url, state, timeoutMs)
  if(!answer.code)
    return null

  try {
    const tokens = await exchangeCode({
      code: answer.code,
      redirect_uri: redirectURI,
      client_id: clientId,
      code_verifier: codeVerifier,
    })
    return tokens?.access_token ? tokens : null
  } catch {
    return null
  }
}

export const silentSignIn = async (exchangeCode, timeoutMs = DEFAULT_TIMEOUT_MS) => {
  try {
    return await runSilentSignIn(exchangeCode, timeoutMs)
  } catch {
    return null
  }
}

export const ensureIdToken = async exchangeCode => {
  if(!isSSOSessionEnabled() || localStorage.getItem('id_token'))
    return
  const tokens = await silentSignIn(exchangeCode)
  if(tokens?.id_token)
    localStorage.setItem('id_token', tokens.id_token)
}

export const buildSSOLogoutURL = (apiURL, idToken, redirectURL) => {
  if(idToken && redirectURL)
    return `${apiURL}/users/logout/?id_token_hint=${encodeURIComponent(idToken)}&post_logout_redirect_uri=${encodeURIComponent(redirectURL)}`
}

// Keycloak's logout only returns to an address registered for the client (LOGIN_REDIRECT_URL), so after a
// forced sign-out the page to sign back in to waits here, in this tab, until the app loads again. The record
// outlives the sign-in for a while, so a token the API keeps turning down stops after one retry, not a loop.
const FORCED_SIGN_OUT_KEY = 'forced_sign_out'
const SILENT_RENEWAL_KEY = 'silent_renewal_at'
export const FORCED_SIGN_OUT_WINDOW_MS = 10 * 60 * 1000

const readSession = key => {
  try {
    return JSON.parse(sessionStorage.getItem(key))
  } catch {
    return null
  }
}

const writeSession = (key, value) => {
  try {
    if(value === null)
      sessionStorage.removeItem(key)
    else
      sessionStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

const isRecent = (at, now) => Number.isFinite(at) && now - at < FORCED_SIGN_OUT_WINDOW_MS

export const prepareSignOut = ({ forced, apiURL, idToken, loginRedirectURL, returnTo, now = Date.now() }) => {
  const logoutURL = buildSSOLogoutURL(apiURL, idToken, loginRedirectURL)
  if(!forced) {
    writeSession(FORCED_SIGN_OUT_KEY, null)
    return { logoutURL, signInAgain: false }
  }
  const signInAgain = !isRecent(readSession(FORCED_SIGN_OUT_KEY)?.at, now)
  writeSession(FORCED_SIGN_OUT_KEY, { returnTo, at: now, resume: Boolean(logoutURL) && signInAgain })
  return { logoutURL, signInAgain }
}

const isSignInCallback = ({ pathname, search }) => /^\/oidc\/login(\/|$)/i.test(pathname) || /[?&]code=/.test(search)

export const takeSigninToResume = (location, now = Date.now()) => {
  const record = readSession(FORCED_SIGN_OUT_KEY)
  if(!record?.resume || isSignInCallback(location))
    return null
  writeSession(FORCED_SIGN_OUT_KEY, { ...record, resume: false })
  return isRecent(record.at, now) && record.returnTo ? record.returnTo : null
}

export const settleForcedSignOut = () => {
  const record = readSession(FORCED_SIGN_OUT_KEY)
  if(record?.resume)
    writeSession(FORCED_SIGN_OUT_KEY, { ...record, resume: false })
}

// A token the API turns down may only have expired while the Keycloak session lives on: renew it without a
// prompt, at most once a window, so a token the API keeps rejecting can't reload the page forever.
export const renewSessionSilently = async (exchangeCode, now = Date.now()) => {
  if(isRecent(readSession(SILENT_RENEWAL_KEY), now) || !writeSession(SILENT_RENEWAL_KEY, now))
    return null
  return silentSignIn(exchangeCode)
}
