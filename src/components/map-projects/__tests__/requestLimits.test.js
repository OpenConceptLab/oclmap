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

import { hasFullRequestLimits, getRequestLimits, getRequestSettings } from '../requestLimits.js'

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
  const capped = getRequestLimits(false)
  // the ticket's case: batch 1 × 25 concurrent semantic requests
  assert.deepEqual(getRequestSettings({ batch_size: 1, concurrent_requests: 25 }, capped), { batchSize: 1, concurrentRequests: 5 })
  assert.deepEqual(getRequestSettings({ batch_size: 1000, concurrent_requests: 50 }, capped), { batchSize: 10, concurrentRequests: 5 })
  // ocl-search's shipped default is 50 rows per batch
  assert.deepEqual(getRequestSettings({ batch_size: 50, concurrent_requests: 2 }, capped), { batchSize: 10, concurrentRequests: 2 })
})

test('getRequestSettings: values within the cap are kept', () => {
  const capped = getRequestLimits(false)
  assert.deepEqual(getRequestSettings({ batch_size: 10, concurrent_requests: 2 }, capped), { batchSize: 10, concurrentRequests: 2 })
  assert.deepEqual(getRequestSettings({ batch_size: 3, concurrent_requests: 5 }, capped), { batchSize: 3, concurrentRequests: 5 })
})

test('getRequestSettings: core users and staff are unchanged', () => {
  const full = getRequestLimits(true)
  assert.deepEqual(getRequestSettings({ batch_size: 1, concurrent_requests: 25 }, full), { batchSize: 1, concurrentRequests: 25 })
  assert.deepEqual(getRequestSettings({ batch_size: 50, concurrent_requests: 2 }, full), { batchSize: 50, concurrentRequests: 2 })
})

test('getRequestSettings: missing or invalid values fall back to 10 rows × 1 request, as before', () => {
  for (const limits of [getRequestLimits(true), getRequestLimits(false)]) {
    assert.deepEqual(getRequestSettings({}, limits), { batchSize: 10, concurrentRequests: 1 })
    assert.deepEqual(getRequestSettings(undefined, limits), { batchSize: 10, concurrentRequests: 1 })
    assert.deepEqual(getRequestSettings({ batch_size: 0, concurrent_requests: 0 }, limits), { batchSize: 10, concurrentRequests: 1 })
    assert.deepEqual(getRequestSettings({ batch_size: 'abc', concurrent_requests: -3 }, limits), { batchSize: 10, concurrentRequests: 1 })
  }
})

test('getRequestSettings: numeric strings are read as numbers', () => {
  assert.deepEqual(getRequestSettings({ batch_size: '8', concurrent_requests: '9' }, getRequestLimits(false)), { batchSize: 8, concurrentRequests: 5 })
})
