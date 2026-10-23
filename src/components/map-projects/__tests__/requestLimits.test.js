/**
 * Auto Match request settings per algorithm (ocl_online#274, #517).
 *
 * The getMapperSettings checkpoint sets the most rows per request and
 * requests in flight a user can choose. The open build allows the form's full
 * range, and a project's saved settings run as they are. Below that range,
 * saved settings run within it.
 *
 * Run with: npm test
 */

import test from 'node:test'
import assert from 'node:assert/strict'

import { getRequestLimits, getRequestSettings, applyRequestSettings } from '../requestLimits.js'
import { getMapperSettings } from '../autoMatchCheck.js'

const OPEN = getRequestLimits(getMapperSettings(null))
const NARROW = getRequestLimits({ batchSize: 10, concurrentRequests: 5 })

test('getRequestLimits: the open build allows the form\'s full range', () => {
  assert.deepEqual(OPEN, { batchSize: 1000, concurrentRequests: 50, capped: false })
  assert.deepEqual(getRequestLimits(), OPEN)
  assert.deepEqual(getRequestLimits(null), OPEN)
})

test('getRequestLimits: settings below the form\'s range cap it', () => {
  assert.deepEqual(NARROW, { batchSize: 10, concurrentRequests: 5, capped: true })
  assert.deepEqual(getRequestLimits({ batchSize: 1000, concurrentRequests: 2 }), { batchSize: 1000, concurrentRequests: 2, capped: true })
})

test('getRequestLimits: settings stay within the form\'s range', () => {
  assert.deepEqual(getRequestLimits({ batchSize: 5000, concurrentRequests: 80 }), OPEN)
})

test('getRequestLimits: missing or invalid settings fall back to the form\'s range', () => {
  assert.deepEqual(getRequestLimits({ batchSize: 0, concurrentRequests: 'abc' }), OPEN)
  assert.deepEqual(getRequestLimits({ batchSize: '10' }), { batchSize: 10, concurrentRequests: 50, capped: true })
})

test('getRequestSettings: a saved project runs within capped settings', () => {
  // the ticket's case: batch 1 × 25 concurrent semantic requests
  assert.deepEqual(getRequestSettings({ batch_size: 1, concurrent_requests: 25 }, NARROW), { batchSize: 1, concurrentRequests: 5 })
  assert.deepEqual(getRequestSettings({ batch_size: 1000, concurrent_requests: 50 }, NARROW), { batchSize: 10, concurrentRequests: 5 })
  // ocl-search's shipped default is 50 rows per batch
  assert.deepEqual(getRequestSettings({ batch_size: 50, concurrent_requests: 2 }, NARROW), { batchSize: 10, concurrentRequests: 2 })
})

test('getRequestSettings: values within capped settings are kept', () => {
  assert.deepEqual(getRequestSettings({ batch_size: 3, concurrent_requests: 5 }, NARROW), { batchSize: 3, concurrentRequests: 5 })
})

test('getRequestSettings: uncapped, a project runs what it saved, even past the form\'s range', () => {
  assert.deepEqual(getRequestSettings({ batch_size: 1, concurrent_requests: 25 }, OPEN), { batchSize: 1, concurrentRequests: 25 })
  assert.deepEqual(getRequestSettings({ batch_size: 2000, concurrent_requests: 75 }, OPEN), { batchSize: 2000, concurrentRequests: 75 })
  assert.deepEqual(getRequestSettings({ batch_size: 2000, concurrent_requests: 75 }), { batchSize: 2000, concurrentRequests: 75 })
})

test('getRequestSettings: missing or invalid values fall back to 10 rows × 1 request, as before', () => {
  for (const limits of [OPEN, NARROW]) {
    assert.deepEqual(getRequestSettings({}, limits), { batchSize: 10, concurrentRequests: 1 })
    assert.deepEqual(getRequestSettings(undefined, limits), { batchSize: 10, concurrentRequests: 1 })
    assert.deepEqual(getRequestSettings({ batch_size: 0, concurrent_requests: 0 }, limits), { batchSize: 10, concurrentRequests: 1 })
    assert.deepEqual(getRequestSettings({ batch_size: 'abc', concurrent_requests: -3 }, limits), { batchSize: 10, concurrentRequests: 1 })
  }
})

test('getRequestSettings: numeric strings are read as numbers', () => {
  assert.deepEqual(getRequestSettings({ batch_size: '8', concurrent_requests: '9' }, NARROW), { batchSize: 8, concurrentRequests: 5 })
})

test('applyRequestSettings: capped, the algorithm carries the settings the run uses, for the run and its record', () => {
  const algo = { id: 'ocl-semantic', type: 'ocl-semantic', batch_size: 1, concurrent_requests: 25, query_params: { semantic: true } }
  assert.deepEqual(applyRequestSettings(algo, NARROW), { ...algo, batch_size: 1, concurrent_requests: 5 })
  assert.deepEqual(applyRequestSettings({ id: 'ocl-search' }, NARROW), { id: 'ocl-search', batch_size: 10, concurrent_requests: 1 })
  // the saved project is not changed
  assert.equal(algo.concurrent_requests, 25)
})

test('applyRequestSettings: uncapped, the algorithm comes back untouched', () => {
  const algo = { id: 'ocl-semantic', batch_size: 2000, concurrent_requests: 75 }
  assert.equal(applyRequestSettings(algo, OPEN), algo)
  assert.equal(applyRequestSettings(algo), algo)
})
