import test from 'node:test'
import assert from 'node:assert/strict'

import { lookupTokenHasSpaces, normalizeLookupConfig } from '../lookupConfigFields.js'

test('normalizeLookupConfig trims the ends of the url and token', () => {
  assert.deepEqual(
    normalizeLookupConfig({url: ' /orgs/X/sources/Y/ ', token: ' abc\n'}),
    {url: '/orgs/X/sources/Y/', token: 'abc'}
  )
})

test('normalizeLookupConfig keeps a space inside the token', () => {
  assert.equal(normalizeLookupConfig({url: '/orgs/X/', token: ' Token abc '}).token, 'Token abc')
})

test('normalizeLookupConfig keeps other keys and leaves missing values alone', () => {
  assert.deepEqual(normalizeLookupConfig({other: 1}), {other: 1, url: undefined, token: undefined})
  assert.equal(normalizeLookupConfig(undefined), undefined)
  assert.equal(normalizeLookupConfig(null), null)
})

test('lookupTokenHasSpaces flags whitespace inside the token only', () => {
  assert.equal(lookupTokenHasSpaces('Token abc'), true)
  assert.equal(lookupTokenHasSpaces('Bearer\tabc'), true)
  assert.equal(lookupTokenHasSpaces(' abc '), false)
  assert.equal(lookupTokenHasSpaces(''), false)
  assert.equal(lookupTokenHasSpaces(undefined), false)
})
