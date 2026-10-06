/**
 * The row panel's progress chip (Candidates.jsx).
 *
 * ocl_issues#2849: a row whose request is waiting out a busy server says so,
 * and a row the server stayed too busy for says "retry", never "failed".
 *
 * Run with: npm test
 */

import test from 'node:test'
import assert from 'node:assert/strict'

import { getCapacityWaitLabel, getRowProgressLabel, mergeCapacityWaits } from '../rowProgress.js'
import { CAPACITY_LIMIT, RATE_LIMIT } from '../../../services/capacity.js'

const ALGOS = [{id: 'ocl-semantic'}, {id: 'ocl-bridge'}]
const t = key => key

test('getRowProgressLabel: nothing for a row with no stages yet', () => {
  assert.deepEqual(getRowProgressLabel(undefined, ALGOS, {t}), {label: false})
})

test('getRowProgressLabel: not started, running, waiting and partial, as before', () => {
  assert.deepEqual(getRowProgressLabel({'ocl-semantic': -1, 'ocl-bridge': -1}, ALGOS, {t}), {label: 'Not started', status: 'idle'})
  assert.deepEqual(getRowProgressLabel({'ocl-semantic': 0, 'ocl-bridge': -1}, ALGOS, {t}), {label: 'Running: ocl-semantic...', status: 'running'})
  assert.deepEqual(getRowProgressLabel({'ocl-semantic': 1, 'ocl-bridge': -1}, ALGOS, {t}), {label: 'Waiting: ocl-bridge', status: 'waiting'})
  assert.deepEqual(getRowProgressLabel({'ocl-semantic': 1, 'ocl-bridge': -2}, ALGOS, {t}), {label: 'Partially completed', status: 'partial'})
})

test('getRowProgressLabel: all done gives no label', () => {
  assert.equal(getRowProgressLabel({'ocl-semantic': 1, 'ocl-bridge': 1}, ALGOS, {t}).label, undefined)
})

test('getRowProgressLabel: a row waiting for capacity says so, over "Running"', () => {
  assert.deepEqual(
    getRowProgressLabel({'ocl-semantic': 0, 'ocl-bridge': -1}, ALGOS, {t, capacityWait: true}),
    {label: 'map_project.waiting_for_capacity', status: 'capacity_wait'},
  )
})

test('getRowProgressLabel: a row waiting for capacity says so even once its algorithms are done (its rerank is waiting)', () => {
  assert.equal(getRowProgressLabel({'ocl-semantic': 1, 'ocl-bridge': 1}, ALGOS, {t, capacityWait: true}).status, 'capacity_wait')
})

test('getRowProgressLabel: a throttled row asks for a retry, not "failed" or "partial"', () => {
  assert.deepEqual(
    getRowProgressLabel({'ocl-semantic': -4, 'ocl-bridge': 1}, ALGOS, {t}),
    {label: 'map_project.row_throttled', status: 'throttled'},
  )
})

test('getRowProgressLabel: while other algorithms still run, the row shows them, not throttled', () => {
  assert.equal(getRowProgressLabel({'ocl-semantic': -4, 'ocl-bridge': 0}, ALGOS, {t}).status, 'running')
  assert.equal(getRowProgressLabel({'ocl-semantic': -4, 'ocl-bridge': -1}, ALGOS, {t}).status, 'waiting')
})

test('getRowProgressLabel: an algorithm that can\'t run for this user (-3, n/a) counts as done', () => {
  assert.equal(getRowProgressLabel({'ocl-semantic': 1, 'ocl-bridge': -3}, ALGOS, {t}).label, undefined)
  assert.equal(getRowProgressLabel({'ocl-semantic': -2, 'ocl-bridge': -3}, ALGOS, {t}).status, 'partial')
})

// Codex review, pass 1: the rerank's own stage counts too.
test('getRowProgressLabel: a throttled rerank asks for a retry once the algorithms are done', () => {
  assert.deepEqual(
    getRowProgressLabel({'ocl-semantic': 1, 'ocl-bridge': 1, rerank: -4}, ALGOS, {t}),
    {label: 'map_project.row_throttled', status: 'throttled'},
  )
  assert.equal(getRowProgressLabel({'ocl-semantic': 1, 'ocl-bridge': -3, rerank: -4}, ALGOS, {t}).status, 'throttled')
})

test('getRowProgressLabel: a done or failed rerank leaves the label as before', () => {
  assert.equal(getRowProgressLabel({'ocl-semantic': 1, 'ocl-bridge': 1, rerank: 1}, ALGOS, {t}).label, undefined)
  assert.equal(getRowProgressLabel({'ocl-semantic': 1, 'ocl-bridge': 1, rerank: -2}, ALGOS, {t}).label, undefined)
})

// ── ocl_issues#2865: capacity limit vs rate limit ───────────────────────────

const tWith = (key, values) => values ? `${key} ${JSON.stringify(values)}` : key
const formatTime = ms => `t+${ms}`
const capacityWait = {limit: CAPACITY_LIMIT, retryAt: 20000}
const rateLimitWait = {limit: RATE_LIMIT, retryAt: 20000}

test('getCapacityWaitLabel: a capacity 429 keeps today\'s wording', () => {
  assert.equal(getCapacityWaitLabel(capacityWait, {t: tWith, formatTime}), 'map_project.waiting_for_capacity')
  assert.equal(getCapacityWaitLabel(capacityWait, {t: tWith, formatTime, short: true}), 'map_project.waiting_for_capacity_short')
  assert.equal(getCapacityWaitLabel(true, {t: tWith, formatTime}), 'map_project.waiting_for_capacity')
})

test('getCapacityWaitLabel: a rate-limit 429 says the user is sending requests too quickly, and when it retries', () => {
  assert.equal(getCapacityWaitLabel(rateLimitWait, {t: tWith, formatTime}), 'map_project.rate_limited {"time":"t+20000"}')
  assert.equal(getCapacityWaitLabel(rateLimitWait, {t: tWith, formatTime, short: true}), 'map_project.rate_limited_short')
})

test('getRowProgressLabel: a row waiting out a rate-limit 429 says so, not "Waiting for capacity"', () => {
  assert.deepEqual(
    getRowProgressLabel({'ocl-semantic': 0, 'ocl-bridge': -1}, ALGOS, {t: tWith, capacityWait: rateLimitWait, formatTime}),
    {label: 'map_project.rate_limited {"time":"t+20000"}', status: 'capacity_wait'},
  )
  assert.deepEqual(
    getRowProgressLabel({'ocl-semantic': 0, 'ocl-bridge': -1}, ALGOS, {t: tWith, capacityWait, formatTime}),
    {label: 'map_project.waiting_for_capacity', status: 'capacity_wait'},
  )
})

test('mergeCapacityWaits: a capacity wait wins; between rate-limit waits, the later retry', () => {
  const later = {limit: RATE_LIMIT, retryAt: 50000}
  assert.equal(mergeCapacityWaits(null, rateLimitWait), rateLimitWait)
  assert.equal(mergeCapacityWaits(rateLimitWait, undefined), rateLimitWait)
  assert.equal(mergeCapacityWaits(rateLimitWait, capacityWait), capacityWait)
  assert.equal(mergeCapacityWaits(capacityWait, later), capacityWait)
  assert.equal(mergeCapacityWaits(rateLimitWait, later), later)
  assert.equal(mergeCapacityWaits(later, rateLimitWait), later)
})
