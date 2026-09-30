/**
 * Auto Match request limits per algorithm (ocl_online#274).
 *
 * Non-core users can't run batches of more than 10 rows, whether they type it
 * in the form or a project saved it earlier. Early-access users keep up to 5
 * requests in flight; preview users 2 (ocl_issues#2849), as many previews at
 * once could fill the server's matching capacity. A preview project has at
 * most 25 rows (3 batches of 10), so 2 costs one more batch's time. Core users
 * and staff keep the form's full range.
 *
 * Run with: npm test
 */

import test from 'node:test'
import assert from 'node:assert/strict'

import { hasFullRequestLimits, getRequestLimits, getRequestSettings, applyRequestSettings } from '../requestLimits.js'

const FULL = getRequestLimits({ is_staff: true })
const EARLY_ACCESS = getRequestLimits({ auth_groups: ['early_access'] })
const PREVIEW = getRequestLimits({ auth_groups: ['preview'] })

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

test('getRequestLimits: the form range for core users and staff', () => {
  assert.deepEqual(getRequestLimits({ auth_groups: ['core_user'] }), { batchSize: 1000, concurrentRequests: 50, capped: false })
  assert.deepEqual(FULL, { batchSize: 1000, concurrentRequests: 50, capped: false })
})

test('getRequestLimits: early access, 10 rows × 5 requests', () => {
  assert.deepEqual(EARLY_ACCESS, { batchSize: 10, concurrentRequests: 5, capped: true })
})

test('getRequestLimits: preview, 10 rows × 2 requests', () => {
  assert.deepEqual(PREVIEW, { batchSize: 10, concurrentRequests: 2, capped: true })
})

test('getRequestLimits: a user in no tier, or signed out, gets the preview limits', () => {
  assert.deepEqual(getRequestLimits({ auth_groups: [] }), PREVIEW)
  assert.deepEqual(getRequestLimits({ auth_groups: ['mapper_ai_assistant'] }), PREVIEW)
  assert.deepEqual(getRequestLimits(null), PREVIEW)
})

test('getRequestLimits: the highest tier wins', () => {
  assert.deepEqual(getRequestLimits({ auth_groups: ['preview', 'early_access'] }), EARLY_ACCESS)
  assert.deepEqual(getRequestLimits({ auth_groups: ['early_access', 'core_user'] }), FULL)
})

test('getRequestSettings: a capped user\'s saved project runs within the cap', () => {
  // the ticket's case: batch 1 × 25 concurrent semantic requests
  assert.deepEqual(getRequestSettings({ batch_size: 1, concurrent_requests: 25 }, EARLY_ACCESS), { batchSize: 1, concurrentRequests: 5 })
  assert.deepEqual(getRequestSettings({ batch_size: 1, concurrent_requests: 25 }, PREVIEW), { batchSize: 1, concurrentRequests: 2 })
  assert.deepEqual(getRequestSettings({ batch_size: 1000, concurrent_requests: 50 }, EARLY_ACCESS), { batchSize: 10, concurrentRequests: 5 })
  assert.deepEqual(getRequestSettings({ batch_size: 1000, concurrent_requests: 50 }, PREVIEW), { batchSize: 10, concurrentRequests: 2 })
  // ocl-search's shipped default is 50 rows per batch
  assert.deepEqual(getRequestSettings({ batch_size: 50, concurrent_requests: 2 }, EARLY_ACCESS), { batchSize: 10, concurrentRequests: 2 })
})

test('getRequestSettings: values within the cap are kept', () => {
  assert.deepEqual(getRequestSettings({ batch_size: 10, concurrent_requests: 2 }, EARLY_ACCESS), { batchSize: 10, concurrentRequests: 2 })
  assert.deepEqual(getRequestSettings({ batch_size: 3, concurrent_requests: 5 }, EARLY_ACCESS), { batchSize: 3, concurrentRequests: 5 })
  assert.deepEqual(getRequestSettings({ batch_size: 3, concurrent_requests: 1 }, PREVIEW), { batchSize: 3, concurrentRequests: 1 })
})

test('getRequestSettings: core users and staff run what the project saved, even past the form\'s range', () => {
  assert.deepEqual(getRequestSettings({ batch_size: 1, concurrent_requests: 25 }, FULL), { batchSize: 1, concurrentRequests: 25 })
  assert.deepEqual(getRequestSettings({ batch_size: 50, concurrent_requests: 2 }, FULL), { batchSize: 50, concurrentRequests: 2 })
  assert.deepEqual(getRequestSettings({ batch_size: 2000, concurrent_requests: 75 }, FULL), { batchSize: 2000, concurrentRequests: 75 })
})

test('getRequestSettings: missing or invalid values fall back to 10 rows × 1 request, as before', () => {
  for (const limits of [FULL, EARLY_ACCESS, PREVIEW]) {
    assert.deepEqual(getRequestSettings({}, limits), { batchSize: 10, concurrentRequests: 1 })
    assert.deepEqual(getRequestSettings(undefined, limits), { batchSize: 10, concurrentRequests: 1 })
    assert.deepEqual(getRequestSettings({ batch_size: 0, concurrent_requests: 0 }, limits), { batchSize: 10, concurrentRequests: 1 })
    assert.deepEqual(getRequestSettings({ batch_size: 'abc', concurrent_requests: -3 }, limits), { batchSize: 10, concurrentRequests: 1 })
  }
})

test('getRequestSettings: without limits, the preview cap applies', () => {
  assert.deepEqual(getRequestSettings({ batch_size: 50, concurrent_requests: 25 }), { batchSize: 10, concurrentRequests: 2 })
})

test('getRequestSettings: numeric strings are read as numbers', () => {
  assert.deepEqual(getRequestSettings({ batch_size: '8', concurrent_requests: '9' }, EARLY_ACCESS), { batchSize: 8, concurrentRequests: 5 })
})

test('applyRequestSettings: a capped user\'s algorithm carries the settings the run uses, for the run and its record', () => {
  const algo = { id: 'ocl-semantic', type: 'ocl-semantic', batch_size: 1, concurrent_requests: 25, query_params: { semantic: true } }
  assert.deepEqual(applyRequestSettings(algo, EARLY_ACCESS), { ...algo, batch_size: 1, concurrent_requests: 5 })
  assert.deepEqual(applyRequestSettings(algo, PREVIEW), { ...algo, batch_size: 1, concurrent_requests: 2 })
  assert.deepEqual(applyRequestSettings({ id: 'ocl-search' }, EARLY_ACCESS), { id: 'ocl-search', batch_size: 10, concurrent_requests: 1 })
  // the saved project is not changed
  assert.equal(algo.concurrent_requests, 25)
})

test('applyRequestSettings: core users and staff get the algorithm back untouched', () => {
  const algo = { id: 'ocl-semantic', batch_size: 2000, concurrent_requests: 75 }
  assert.equal(applyRequestSettings(algo, FULL), algo)
})
