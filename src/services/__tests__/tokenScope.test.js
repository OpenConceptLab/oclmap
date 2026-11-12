/* eslint-env node */
/**
 * Which token a request gets (ocl_online#522).
 */

import test from 'node:test'
import assert from 'node:assert/strict'

import {
  isAPIHost, matchToken, lookupToken, joinAPIPath, isOCLAPILookupURL, needsSessionToken, withoutTokens,
  isAbsoluteURL, needsSessionLookupToken, withSavedTokenURL, getTokenFlag, tokenInputValue, removeSavedToken,
  withoutLocalKeys, TOKEN_URL_KEY,
} from '../tokenScope.js'

const API = 'https://api.example.org'
const USER = 'USER-TOKEN'

test('matchToken: OCL algorithms use the default, the user token', () => {
  assert.equal(matchToken(undefined), null)
  assert.equal(matchToken({type: 'ocl', id: 'a'}), null)
  for (const type of ['ocl-bridge', 'ocl-ciel-bridge', 'ocl-scispacy', 'ai'])
    assert.equal(matchToken({type, url: 'https://ai.example.org/x/'}), null)
  assert.equal(matchToken({type: 'custom'}), null) // no url: served by OCL's $match
})

test('matchToken: a custom algorithm uses only its own token, or none', () => {
  assert.equal(matchToken({type: 'custom', url: 'https://evil.test/$match/', token: 'T'}), 'T')
  assert.equal(matchToken({type: 'custom', url: 'https://evil.test/$match/'}), false)
  assert.equal(matchToken({type: 'custom', url: 'https://evil.test/$match/', token: ''}), false)
  assert.equal(matchToken({type: 'custom', url: `${API}/concepts/$match/`}), false)
})

test('lookupToken: the configured token wins, on any host', () => {
  assert.equal(lookupToken('CFG', `${API}/concepts/`, API, USER), 'CFG')
  assert.equal(lookupToken('CFG', 'https://other.org/concepts/', API, USER), 'CFG')
})

test('lookupToken: no configured token, an OCL URL gets the user token', () => {
  assert.equal(lookupToken(undefined, `${API}/orgs/o/sources/s/concepts/`, API, USER), USER)
  assert.equal(lookupToken('', `${API}/concepts/`, API, USER), USER)
})

test('lookupToken: no configured token, any other host gets none', () => {
  assert.equal(lookupToken(undefined, 'https://evil.example.com/concepts/', API, USER), false)
  assert.equal(lookupToken(undefined, 'https://api.example.org.evil.test/concepts/', API, USER), false)
  assert.equal(lookupToken(undefined, 'http://api.example.org/concepts/', API, USER), false)
  assert.equal(lookupToken(undefined, 'https://api.example.org@evil.com/concepts/', API, USER), false)
})

test('a relative API URL resolves to the page origin', () => {
  global.window = { location: { href: 'https://app.example.org/map/' } }
  try {
    assert.equal(isAPIHost('/api/concepts/', '/api'), true)
    assert.equal(isAPIHost('https://app.example.org/api/x', '/api'), true)
    assert.equal(isAPIHost('https://evil.example.com/api/x', '/api'), false)
  } finally {
    delete global.window
  }
})

test('isAPIHost: an unparsable URL is not the API host', () => {
  assert.equal(isAPIHost('http://', API), false)
})

test('overrideURL cannot change the host', () => {
  assert.equal(new URL(joinAPIPath(API, '@evil.example.com/orgs/')).host, 'api.example.org')
  assert.equal(new URL(joinAPIPath(API, ':80@evil.com/')).host, 'api.example.org')
  assert.equal(joinAPIPath(API, '/orgs/x/'), `${API}/orgs/x/`)
})

test('isOCLAPILookupURL: no URL, a path, or the API origin', () => {
  assert.equal(isOCLAPILookupURL(undefined, API), true)
  assert.equal(isOCLAPILookupURL('', API), true)
  assert.equal(isOCLAPILookupURL('/orgs/CIEL/sources/CIEL/', API), true)
  assert.equal(isOCLAPILookupURL(`${API}/orgs/CIEL/`, API), true)
  assert.equal(isOCLAPILookupURL('https://terms.example.com/orgs/X/', API), false)
  assert.equal(isOCLAPILookupURL('HTTPS://terms.example.com/orgs/X/', API), false)
  assert.equal(isOCLAPILookupURL('//terms.example.com/orgs/X/', API), true)
})

test('isAbsoluteURL: only http(s)://, in any case', () => {
  assert.equal(isAbsoluteURL('HTTPS://x.org/'), true)
  assert.equal(isAbsoluteURL('http://x.org/'), true)
  assert.equal(isAbsoluteURL('//x.org/'), false)
  assert.equal(isAbsoluteURL('/orgs/X/'), false)
  assert.equal(isAbsoluteURL(undefined), false)
})

test('needsSessionLookupToken: a saved token on another host, not entered this session', () => {
  const url = 'https://terms.example.com/orgs/X/'
  assert.equal(needsSessionLookupToken({url, has_token: true}, API), true)
  assert.equal(needsSessionLookupToken({url, has_token: true, token: 'T'}, API), false)
  assert.equal(needsSessionLookupToken({url: '/orgs/X/', has_token: true}, API), false)
  assert.equal(needsSessionLookupToken({url}, API), false)
})

test('saved token URL: has_token comes back on the original URL, and is never sent', () => {
  const url = 'https://match.example.com/'
  const loaded = withSavedTokenURL({__key: 'k', url, has_token: true})
  assert.equal(getTokenFlag(loaded, 'https://other.example.com/'), undefined)
  assert.equal(getTokenFlag(loaded, url), true)
  assert.equal(getTokenFlag({url}, url), undefined)
  assert.deepEqual(withoutLocalKeys(loaded), {url, has_token: true})
  assert.deepEqual(withSavedTokenURL({url}), {url})
  assert.equal(withoutTokens(loaded)[TOKEN_URL_KEY], undefined)
})

test('an emptied token field keeps a saved token; removing it clears it', () => {
  const loaded = withSavedTokenURL({url: 'u', has_token: true})
  assert.equal(tokenInputValue(loaded, ''), undefined)
  assert.equal(tokenInputValue(loaded, 'T'), 'T')
  assert.equal(tokenInputValue({url: 'u'}, ''), '')
  const removed = removeSavedToken(loaded)
  assert.equal(removed.token, '')
  assert.equal(removed.has_token, undefined)
  assert.equal(tokenInputValue(removed, ''), '')
  assert.equal(JSON.parse(JSON.stringify(withoutLocalKeys(removed))).token, '')
})

test('needsSessionToken: a custom algorithm with a saved key not entered this session', () => {
  const url = 'https://match.example.com/'
  assert.equal(needsSessionToken({type: 'custom', url, has_token: true}), true)
  assert.equal(needsSessionToken({type: 'custom', url, has_token: true, token: 'T'}), false)
  assert.equal(needsSessionToken({type: 'custom', url}), false)
  assert.equal(needsSessionToken({type: 'custom', has_token: true}), false)
  assert.equal(needsSessionToken({type: 'ocl-semantic', url, has_token: true}), false)
  assert.equal(needsSessionToken(undefined), false)
})

test('withoutTokens: removes token and has_token at any depth', () => {
  assert.deepEqual(
    withoutTokens([{url: 'u', token: 'T', has_token: true, nested: {token: 'N', keep: 1}}, 'x']),
    [{url: 'u', nested: {keep: 1}}, 'x']
  )
  assert.deepEqual(withoutTokens({url: 'u', has_token: true}), {url: 'u'})
  assert.equal(withoutTokens(null), null)
})
