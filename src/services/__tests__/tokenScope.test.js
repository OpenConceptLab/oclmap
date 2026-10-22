/* eslint-env node */
/**
 * Which token a request gets (ocl_online#522).
 */

import test from 'node:test'
import assert from 'node:assert/strict'

import { isAPIHost, matchToken, lookupToken, joinAPIPath } from '../tokenScope.js'

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
