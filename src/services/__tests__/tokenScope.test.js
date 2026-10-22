/* eslint-env node */
/**
 * The signed-in user's token goes only to the OCL API host (ocl_online#522).
 * A lookup or custom-algorithm URL on another host gets its own configured
 * token, or none.
 */

import test from 'node:test'
import assert from 'node:assert/strict'

import { scopeToken, joinAPIPath, isAPIHost } from '../tokenScope.js'

const API = 'https://api.example.org'
const USER = 'USER-TOKEN'

test('the user token is kept for the OCL API host', () => {
  assert.equal(scopeToken(USER, `${API}/concepts/`, API, USER), USER)
})

test('a lookup URL on another host does not get the user token', () => {
  assert.equal(scopeToken(USER, 'https://evil.example.com/concepts/', API, USER), null)
})

test('a custom-algorithm URL on another host does not get the user token', () => {
  assert.equal(scopeToken(USER, 'https://match.evil.test/$match/', API, USER), null)
  assert.equal(scopeToken(USER, 'https://api.example.org.evil.test/$match/', API, USER), null)
  assert.equal(scopeToken(USER, 'http://api.example.org/$match/', API, USER), null)
})

test('a token configured for another host is still sent there', () => {
  assert.equal(scopeToken('PROJECT-TOKEN', 'https://lookup.other.org/concepts/', API, USER), 'PROJECT-TOKEN')
})

test('no token stays no token; an unparsable URL is not the API host', () => {
  assert.equal(scopeToken(null, 'https://evil.example.com/', API, USER), null)
  assert.equal(isAPIHost('not a url', API), false)
})

test('overrideURL cannot change the host', () => {
  const url = joinAPIPath(API, '@evil.example.com/orgs/')
  assert.equal(new URL(url).host, 'api.example.org')
  assert.equal(joinAPIPath(API, '/orgs/x/'), `${API}/orgs/x/`)
  assert.equal(new URL(joinAPIPath(API, ':80@evil.com/')).host, 'api.example.org')
})

test('a relative API URL resolves to the page origin', () => {
  global.window = { location: { href: 'https://app.example.org/map/' } }
  try {
    assert.equal(scopeToken(USER, '/api/concepts/', '/api', USER), USER)
    assert.equal(scopeToken(USER, 'https://app.example.org/api/x', '/api', USER), USER)
    assert.equal(scopeToken(USER, 'https://evil.example.com/api/x', '/api', USER), null)
  } finally {
    delete global.window
  }
})
