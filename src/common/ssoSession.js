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
