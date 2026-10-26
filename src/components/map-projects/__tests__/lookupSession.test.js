import test from 'node:test'
import assert from 'node:assert/strict'

import { createLookupSession, LOOKUP_NOT_FOUND } from '../lookupSession.js'
import { restoreBridgeTargets } from '../normalizers.js'

const notFound = () => Object.assign(new Error('Not Found'), {response: {status: 404}})

const deferred = () => {
  let resolve, reject
  const promise = new Promise((res, rej) => { resolve = res; reject = rej })
  return {promise, resolve, reject}
}

const bridgeRow = () => ({
  algorithm_responses: {},
  candidates: {
    p: {id: 'p', type: 'bridge', concept_key: 'ciel|1'},
    a: {id: 'a', type: 'bridge_child', concept_key: 'loinc|missing', parent_candidate_id: 'p'},
    b: {id: 'b', type: 'bridge_child', concept_key: 'loinc|present', parent_candidate_id: 'p'}
  },
  concept_rows: {'ciel|1': {}, 'loinc|missing': {concept_key: 'loinc|missing'}, 'loinc|present': {}}
})

test('fetchOnce fetches a URL once and keeps a final 404', async () => {
  const session = createLookupSession()
  let calls = 0
  const fetcher = () => { calls += 1; return Promise.reject(notFound()) }
  assert.equal(await session.fetchOnce('/c/1/', fetcher), LOOKUP_NOT_FOUND)
  assert.equal(await session.fetchOnce('/c/1/', fetcher), LOOKUP_NOT_FOUND)
  assert.equal(calls, 1)
})

test('fetchOnce keeps other failures retryable', async () => {
  const session = createLookupSession()
  let calls = 0
  const fetcher = () => { calls += 1; return Promise.reject(new Error('boom')) }
  assert.equal(await session.fetchOnce('/c/1/', fetcher), null)
  assert.equal(await session.fetchOnce('/c/1/', fetcher), null)
  assert.equal(calls, 2)
})

test('reset fetches a URL found missing for the previous version again', async () => {
  const session = createLookupSession()
  let calls = 0
  const fetcher = () => { calls += 1; return calls === 1 ? Promise.reject(notFound()) : Promise.resolve({id: '1'}) }
  assert.equal(await session.fetchOnce('/c/1/', fetcher), LOOKUP_NOT_FOUND)
  session.reset({})
  assert.deepEqual(await session.fetchOnce('/c/1/', fetcher), {id: '1'})
})

test('a 404 still retrying when the target version changes marks nothing missing in the new one', async () => {
  const session = createLookupSession()
  const lookup = deferred()
  const generation = session.generation
  const pending = session.fetchOnce('/c/missing/', () => lookup.promise)

  session.reset({})
  lookup.reject(notFound())

  assert.equal(await pending, LOOKUP_NOT_FOUND)
  assert.equal(session.isCurrent(generation), false)
  assert.equal(session.markMissing(generation, 'loinc|missing'), false)
  assert.equal(session.isMissing('loinc|missing'), false)
  const row = bridgeRow()
  assert.equal(session.dropMissing(0, row), row)
})

test('reset restores the bridge candidates dropped under the previous version', () => {
  const session = createLookupSession()
  assert.equal(session.markMissing(session.generation, 'loinc|missing'), true)
  const dropped = session.dropMissing(0, bridgeRow())
  assert.deepEqual(Object.keys(dropped.candidates), ['p', 'b'])

  const {rowMatchState, restored} = session.reset({0: dropped})
  assert.deepEqual(Object.keys(rowMatchState[0].candidates).sort(), ['a', 'b', 'p'])
  assert.deepEqual(rowMatchState[0].concept_rows['loinc|missing'], {concept_key: 'loinc|missing'})
  assert.deepEqual(restored, {0: ['loinc|missing']})
  assert.equal(session.isMissing('loinc|missing'), false)
  assert.deepEqual(session.reset(rowMatchState).restored, {})
})

test('reset leaves rows unchanged when nothing was dropped', () => {
  const session = createLookupSession()
  const state = {0: bridgeRow()}
  const result = session.reset(state)
  assert.equal(result.rowMatchState, state)
  assert.deepEqual(result.restored, {})
})

test('restoreBridgeTargets skips candidates whose bridge parent is gone', () => {
  const row = {candidates: {q: {id: 'q', type: 'bridge', concept_key: 'ciel|2'}}, concept_rows: {'ciel|2': {}}}
  const dropped = {candidates: {a: {id: 'a', type: 'bridge_child', concept_key: 'loinc|x', parent_candidate_id: 'p'}}, concept_rows: {}}
  assert.equal(restoreBridgeTargets(row, dropped), row)
})
