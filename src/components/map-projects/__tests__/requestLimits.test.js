/**
 * Auto Match request limits per algorithm (ocl_online#274).
 *
 * Non-core users can't run more than 5 concurrent requests or batches of
 * more than 10 rows, whether they type it in the form or a project saved it
 * earlier. Core users and staff keep the form's full range.
 *
 * Run with: npm test
 */

import test from 'node:test'
import assert from 'node:assert/strict'

import { hasFullRequestLimits, getRequestLimits, getRequestSettings, applyRequestSettings } from '../requestLimits.js'

test('hasFullRequestLimits: core users, staff and superusers', () => {
  assert.equal(hasFullRequestLimits({ auth_groups: ['core_user'] }), true)
  assert.equal(hasFullRequestLimits({ is_staff: true }), true)
  assert.equal(hasFullRequestLimits({ is_superuser: true }), true)
})

test('hasFullRequestLimits: preview, early-access and signed-out users are capped', () => {
  assert.equal(hasFullRequestLimits({ auth_groups: ['early_access'] }), false)
  assert.equal(hasFullRequestLimits({ auth_groups: [] }), false)
  assert.equal(hasFullRequestLimits({ is_staff: false, auth_groups: ['preview'] }), false)
  assert.equal(hasFullRequestLimits(null), false)
  assert.equal(hasFullRequestLimits(undefined), false)
})

test('getRequestLimits: the form range for core users and staff, 10 rows × 5 requests for everyone else', () => {
  assert.deepEqual(getRequestLimits(true), { batchSize: 1000, concurrentRequests: 50 })
  assert.deepEqual(getRequestLimits(false), { batchSize: 10, concurrentRequests: 5 })
})

test('getRequestSettings: a capped user\'s saved project runs within the cap', () => {
  // the ticket's case: batch 1 × 25 concurrent semantic requests
  assert.deepEqual(getRequestSettings({ batch_size: 1, concurrent_requests: 25 }, false), { batchSize: 1, concurrentRequests: 5 })
  assert.deepEqual(getRequestSettings({ batch_size: 1000, concurrent_requests: 50 }, false), { batchSize: 10, concurrentRequests: 5 })
  // ocl-search's shipped default is 50 rows per batch
  assert.deepEqual(getRequestSettings({ batch_size: 50, concurrent_requests: 2 }, false), { batchSize: 10, concurrentRequests: 2 })
})

test('getRequestSettings: values within the cap are kept', () => {
  assert.deepEqual(getRequestSettings({ batch_size: 10, concurrent_requests: 2 }, false), { batchSize: 10, concurrentRequests: 2 })
  assert.deepEqual(getRequestSettings({ batch_size: 3, concurrent_requests: 5 }, false), { batchSize: 3, concurrentRequests: 5 })
})

test('getRequestSettings: core users and staff run what the project saved, even past the form\'s range', () => {
  assert.deepEqual(getRequestSettings({ batch_size: 1, concurrent_requests: 25 }, true), { batchSize: 1, concurrentRequests: 25 })
  assert.deepEqual(getRequestSettings({ batch_size: 50, concurrent_requests: 2 }, true), { batchSize: 50, concurrentRequests: 2 })
  assert.deepEqual(getRequestSettings({ batch_size: 2000, concurrent_requests: 75 }, true), { batchSize: 2000, concurrentRequests: 75 })
})

test('getRequestSettings: missing or invalid values fall back to 10 rows × 1 request, as before', () => {
  for (const fullLimits of [true, false]) {
    assert.deepEqual(getRequestSettings({}, fullLimits), { batchSize: 10, concurrentRequests: 1 })
    assert.deepEqual(getRequestSettings(undefined, fullLimits), { batchSize: 10, concurrentRequests: 1 })
    assert.deepEqual(getRequestSettings({ batch_size: 0, concurrent_requests: 0 }, fullLimits), { batchSize: 10, concurrentRequests: 1 })
    assert.deepEqual(getRequestSettings({ batch_size: 'abc', concurrent_requests: -3 }, fullLimits), { batchSize: 10, concurrentRequests: 1 })
  }
})

test('getRequestSettings: numeric strings are read as numbers', () => {
  assert.deepEqual(getRequestSettings({ batch_size: '8', concurrent_requests: '9' }, false), { batchSize: 8, concurrentRequests: 5 })
})

test('applyRequestSettings: a capped user\'s algorithm carries the settings the run uses, for the run and its record', () => {
  const algo = { id: 'ocl-semantic', type: 'ocl-semantic', batch_size: 1, concurrent_requests: 25, query_params: { semantic: true } }
  assert.deepEqual(applyRequestSettings(algo, false), { ...algo, batch_size: 1, concurrent_requests: 5 })
  assert.deepEqual(applyRequestSettings({ id: 'ocl-search' }, false), { id: 'ocl-search', batch_size: 10, concurrent_requests: 1 })
  // the saved project is not changed
  assert.equal(algo.concurrent_requests, 25)
})

test('applyRequestSettings: core users and staff get the algorithm back untouched', () => {
  const algo = { id: 'ocl-semantic', batch_size: 2000, concurrent_requests: 75 }
  assert.equal(applyRequestSettings(algo, true), algo)
})
