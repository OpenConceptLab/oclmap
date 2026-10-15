/* global globalThis */
import test from 'node:test'
import assert from 'node:assert/strict'

const listeners = {}
const appended = []
const makeIframe = () => {
  const iframe = {
    style: {}, contentWindow: {}, removed: false,
    setAttribute() {}, remove() { this.removed = true },
  }
  return iframe
}
globalThis.window = {
  location: { origin: 'http://localhost:4004' },
  OIDC_SERVER_URL: 'https://sso.example.org/auth/',
  OIDC_REALM: 'ocl',
  OIDC_RP_CLIENT_ID: 'oclmap',
  addEventListener: (type, fn) => { listeners[type] = fn },
  removeEventListener: type => { delete listeners[type] },
}
globalThis.document = {
  createElement: () => makeIframe(),
  body: { appendChild: el => appended.push(el) },
}

const { isSSOSessionEnabled, buildSilentAuthURL, silentSignIn, ensureIdToken } = await import('../ssoSession.js')

const reset = () => { appended.length = 0 }
const answer = (data, overrides = {}) => listeners.message({
  origin: 'http://localhost:4004', source: appended[0].contentWindow, data: { type: 'ocl-silent-sso', ...data }, ...overrides,
})
const stateOf = () => new URL(appended[0].src).searchParams.get('state')
const tick = async () => {
  for(let i = 0; i < 200 && !appended.length; i++)
    await new Promise(resolve => setTimeout(resolve, 5))
}

test('is enabled only when server, realm and client id are set', () => {
  assert.equal(isSSOSessionEnabled(), true)
  const realm = window.OIDC_REALM
  window.OIDC_REALM = ''
  assert.equal(isSSOSessionEnabled(), false)
  window.OIDC_REALM = realm
})

test('builds a prompt=none PKCE auth URL against Keycloak', () => {
  const url = new URL(buildSilentAuthURL({
    serverURL: 'https://sso.example.org/auth', realm: 'ocl', clientId: 'oclmap',
    redirectURI: 'http://localhost:4004/silent-sso.html', state: 's', nonce: 'n', codeChallenge: 'c',
  }))
  assert.equal(url.pathname, '/auth/realms/ocl/protocol/openid-connect/auth')
  assert.equal(url.searchParams.get('prompt'), 'none')
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256')
  assert.equal(url.searchParams.get('response_type'), 'code')
})

test('exchanges the code and removes the iframe when Keycloak has a session', async () => {
  reset()
  let sent
  const promise = silentSignIn(async body => { sent = body; return { access_token: 't', id_token: 'i' } })
  await tick()
  answer({ code: 'abc', state: stateOf() })
  const tokens = await promise
  assert.equal(tokens.access_token, 't')
  assert.equal(sent.code, 'abc')
  assert.equal(sent.redirect_uri, 'http://localhost:4004/silent-sso.html')
  assert.equal(sent.client_id, 'oclmap')
  assert.ok(sent.code_verifier.length >= 43)
  assert.equal(appended[0].removed, true)
})

test('resolves null on login_required without exchanging', async () => {
  reset()
  let called = false
  const promise = silentSignIn(async () => { called = true })
  await tick()
  answer({ error: 'login_required', state: stateOf() })
  assert.equal(await promise, null)
  assert.equal(called, false)
})

test('ignores messages from another origin, another frame or another state', async () => {
  reset()
  const promise = silentSignIn(async () => ({ access_token: 't' }), 100)
  await tick()
  answer({ code: 'x', state: stateOf() }, { origin: 'https://evil.example' })
  answer({ code: 'x', state: stateOf() }, { source: {} })
  answer({ code: 'x', state: 'other' })
  assert.equal(await promise, null)
})

test('resolves null on timeout and removes the iframe', async () => {
  reset()
  assert.equal(await silentSignIn(async () => ({ access_token: 't' }), 30), null)
  assert.equal(appended[0].removed, true)
})

test('resolves null when the exchange fails', async () => {
  reset()
  const promise = silentSignIn(async () => { throw new Error('boom') })
  await tick()
  answer({ code: 'abc', state: stateOf() })
  assert.equal(await promise, null)
})

test('does nothing when disabled', async () => {
  reset()
  window.OIDC_SERVER_URL = ''
  assert.equal(await silentSignIn(async () => ({})), null)
  assert.equal(appended.length, 0)
})

test('resolves null instead of throwing when crypto is unavailable', async () => {
  reset()
  window.OIDC_SERVER_URL = 'https://sso.example.org/auth'
  const original = Object.getOwnPropertyDescriptor(globalThis, 'crypto')
  Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true })
  try {
    assert.equal(await silentSignIn(async () => ({ access_token: 't' })), null)
  } finally {
    Object.defineProperty(globalThis, 'crypto', original)
  }
})

test('ensureIdToken fetches a fresh id token only when one is missing', async () => {
  reset()
  window.OIDC_SERVER_URL = 'https://sso.example.org/auth'
  const store = {}
  globalThis.localStorage = { getItem: key => store[key] || null, setItem: (key, value) => { store[key] = value } }
  const exchange = async () => ({ access_token: 't', id_token: 'fresh' })

  store.id_token = 'existing'
  await ensureIdToken(exchange)
  assert.equal(appended.length, 0)
  assert.equal(store.id_token, 'existing')

  delete store.id_token
  const promise = ensureIdToken(exchange)
  await tick()
  answer({ code: 'abc', state: stateOf() })
  await promise
  assert.equal(store.id_token, 'fresh')
})

test('ensureIdToken leaves storage alone when there is no Keycloak session or SSO is off', async () => {
  reset()
  const store = {}
  globalThis.localStorage = { getItem: key => store[key] || null, setItem: (key, value) => { store[key] = value } }
  const promise = ensureIdToken(async () => ({ access_token: 't', id_token: 'fresh' }))
  await tick()
  answer({ error: 'login_required', state: stateOf() })
  await promise
  assert.equal(store.id_token, undefined)

  reset()
  window.OIDC_SERVER_URL = ''
  await ensureIdToken(async () => ({}))
  assert.equal(appended.length, 0)
})
