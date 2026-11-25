/**
 * Replies to a pending request apply to the current algorithm list
 * (ocl_online#786).
 *
 * Run with: npm test
 */

import test from 'node:test'
import assert from 'node:assert/strict'

import { patchSelected, isStaleReply } from '../selectedAlgos.js'

const custom = { __key: 'a', type: 'custom', url: 'https://algo.example/a', id: '', name: '' }
const search = { __key: 'b', type: 'ocl-search', id: 'ocl-search', name: 'Search' }

test('patchSelected: patches only the matching entry', () => {
  const next = patchSelected([custom, search], 'a', { id: 'x', name: 'X' })
  assert.deepEqual(next[0], { ...custom, id: 'x', name: 'X' })
  assert.equal(next[1], search)
})

test('patchSelected: an edit made while a check was pending is kept', () => {
  const atRequest = [custom]
  const edited = [{ ...custom, description: 'typed while waiting' }, search]
  const next = patchSelected(edited, 'a', { id: 'x', name: 'X' })
  assert.equal(next.length, 2)
  assert.equal(next[0].description, 'typed while waiting')
  assert.equal(next[0].id, 'x')
  assert.equal(next[1], search)
  assert.notEqual(next, atRequest)
})

test('patchSelected: an empty or missing list stays empty', () => {
  assert.deepEqual(patchSelected(undefined, 'a', { id: 'x' }), [])
  assert.deepEqual(patchSelected([], 'a', { id: 'x' }), [])
})

test('isStaleReply: the entry is still there with the same URL', () => {
  assert.equal(isStaleReply([custom, search], 'a', custom.url), false)
})

test('isStaleReply: the entry was removed', () => {
  assert.equal(isStaleReply([search], 'a', custom.url), true)
  assert.equal(isStaleReply(undefined, 'a', custom.url), true)
})

test('isStaleReply: the URL was changed', () => {
  assert.equal(isStaleReply([{ ...custom, url: 'https://algo.example/b' }], 'a', custom.url), true)
})
