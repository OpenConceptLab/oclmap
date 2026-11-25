/**
 * Replies to a pending request apply to the current algorithm list
 * (ocl_online#786).
 *
 * Run with: npm test
 */

import test from 'node:test'
import assert from 'node:assert/strict'

import { patchSelected, isStaleReply, customCheckReply } from '../selectedAlgos.js'

const custom = { __key: 'a', type: 'custom', url: 'https://algo.example/a', id: '', name: '' }
const search = { __key: 'b', type: 'ocl-search', id: 'ocl-search', name: 'Search' }

test('patchSelected: patches only the matching entry', () => {
  const next = patchSelected([custom, search], 'a', { id: 'x', name: 'X' })
  assert.deepEqual(next[0], { ...custom, id: 'x', name: 'X' })
  assert.equal(next[1], search)
})

test('patchSelected: an edit made while a check was pending is kept', () => {
  const edited = [{ ...custom, description: 'typed while waiting' }, search]
  const next = patchSelected(edited, 'a', { id: 'x', name: 'X' })
  assert.equal(next.length, 2)
  assert.equal(next[0].description, 'typed while waiting')
  assert.equal(next[0].id, 'x')
  assert.equal(next[1], search)
})

test('patchSelected: an empty or missing list stays empty', () => {
  assert.deepEqual(patchSelected(undefined, 'a', { id: 'x' }), [])
  assert.deepEqual(patchSelected([], 'a', { id: 'x' }), [])
})

const sent = { url: custom.url, token: undefined }

test('isStaleReply: the entry is still there with the same sent fields', () => {
  assert.equal(isStaleReply([custom, search], 'a', sent), false)
})

test('isStaleReply: the entry was removed', () => {
  assert.equal(isStaleReply([search], 'a', sent), true)
  assert.equal(isStaleReply(undefined, 'a', sent), true)
})

test('isStaleReply: the URL or token was changed', () => {
  assert.equal(isStaleReply([{ ...custom, url: 'https://algo.example/b' }], 'a', sent), true)
  assert.equal(isStaleReply([{ ...custom, token: 'new' }], 'a', sent), true)
})

test('isStaleReply: a bridge repo URL that was changed', () => {
  const bridge = { __key: 'c', type: 'ocl-bridge', target_repo_url: '/orgs/A/sources/A/' }
  assert.equal(isStaleReply([bridge], 'c', { target_repo_url: '/orgs/A/sources/A/' }), false)
  assert.equal(isStaleReply([{ ...bridge, target_repo_url: '/orgs/B/sources/B/' }], 'c', { target_repo_url: '/orgs/A/sources/A/' }), true)
})

test('customCheckReply: applies to the algorithm as it is now', () => {
  assert.equal(customCheckReply({ list: [custom], key: 'a', sent, checkId: 1, latestCheckId: 1 }), 'apply')
})

test('customCheckReply: a newer check owns the state', () => {
  assert.equal(customCheckReply({ list: [custom], key: 'a', sent, checkId: 1, latestCheckId: 2 }), 'ignore')
})

test('customCheckReply: the algorithm was removed', () => {
  assert.equal(customCheckReply({ list: [search], key: 'a', sent, checkId: 1, latestCheckId: undefined }), 'ignore')
  assert.equal(customCheckReply({ list: [search], key: 'a', sent, checkId: 1, latestCheckId: 1 }), 'ignore')
})

test('customCheckReply: the URL or token changed while pending only stops loading', () => {
  assert.equal(customCheckReply({ list: [{ ...custom, url: 'https://algo.example/b' }], key: 'a', sent, checkId: 1, latestCheckId: 1 }), 'clear')
  assert.equal(customCheckReply({ list: [{ ...custom, token: 'new' }], key: 'a', sent, checkId: 1, latestCheckId: 1 }), 'clear')
})
