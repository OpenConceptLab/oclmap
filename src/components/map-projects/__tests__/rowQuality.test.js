/**
 * Match quality per row, for the grid's Match Quality column and its
 * Recommended / Available / Low Ranked counters (ocl_issues#2837).
 *
 * After an Auto Match without the AI Assistant, only rows whose best
 * candidate reaches Recommended get a proposed match. The counters counted
 * proposed matches only, so a run whose candidates all scored below
 * Recommended showed 0 everywhere.
 *
 * Run with: npm test
 */

import test from 'node:test'
import assert from 'node:assert/strict'

import { getRowQuality, getRowQualities, countQualityBuckets, filterRowsByQualityBucket } from '../rowQuality.js'

const candidatesScore = { recommended: 80, available: 50 }
const proposed = score => ({ search_meta: { search_normalized_score: score } })

test('getRowQuality: a proposed match is ranked by its own score, as before', () => {
  assert.deepEqual(getRowQuality({ proposedMatch: proposed(91), bestCandidateScore: 95 }, candidatesScore), { source: 'proposed', score: 91, bucket: 'recommended' })
  assert.deepEqual(getRowQuality({ proposedMatch: proposed(60) }, candidatesScore), { source: 'proposed', score: 60, bucket: 'available' })
  assert.deepEqual(getRowQuality({ proposedMatch: proposed(12) }, candidatesScore), { source: 'proposed', score: 12, bucket: 'low_ranked' })
  // saved projects can carry the score as a string
  assert.deepEqual(getRowQuality({ proposedMatch: proposed('80') }, candidatesScore), { source: 'proposed', score: 80, bucket: 'recommended' })
})

test('getRowQuality: a proposed match with no score counts as Low Ranked, as before', () => {
  assert.deepEqual(getRowQuality({ proposedMatch: {} }, candidatesScore), { source: 'proposed', score: null, bucket: 'low_ranked' })
  assert.deepEqual(getRowQuality({ proposedMatch: proposed(0) }, candidatesScore), { source: 'proposed', score: 0, bucket: 'low_ranked' })
})

test('getRowQuality: a row with candidates and no decision is ranked by its best candidate', () => {
  assert.deepEqual(getRowQuality({ bestCandidateScore: 72.5 }, candidatesScore), { source: 'candidate', score: 72.5, bucket: 'available' })
  assert.deepEqual(getRowQuality({ bestCandidateScore: 20 }, candidatesScore), { source: 'candidate', score: 20, bucket: 'low_ranked' })
  assert.deepEqual(getRowQuality({ bestCandidateScore: 0 }, candidatesScore), { source: 'candidate', score: 0, bucket: 'low_ranked' })
})

test('getRowQuality: no candidates, a candidate still waiting for its score, or a decision without a match is unranked', () => {
  assert.equal(getRowQuality({}, candidatesScore), null)
  assert.equal(getRowQuality({ bestCandidateScore: undefined }, candidatesScore), null)
  assert.equal(getRowQuality({ bestCandidateScore: 72, hasDecision: true }, candidatesScore), null)
})

// The case from the ticket: 5 rows, OCL Semantic only, AI off, every row
// with 15 candidates, none reaching Recommended.
const run = {
  rowIndexes: [0, 1, 2, 3, 4],
  mapSelected: {},
  decisions: {},
  bestCandidateScores: { 0: 71, 1: 64.2, 2: 55, 3: 31, 4: 12 },
}

test('countQualityBuckets: a candidates-only run no longer shows 0 everywhere', () => {
  const qualities = getRowQualities(run, candidatesScore)
  assert.deepEqual(countQualityBuckets(qualities), { recommended: 0, available: 3, low_ranked: 2 })
})

test('countQualityBuckets: proposed matches and candidate-only rows are counted together, once per row', () => {
  const qualities = getRowQualities({
    rowIndexes: [0, 1, 2, 3, 4, 5],
    mapSelected: { 0: proposed(92), 1: proposed(40) },
    decisions: { 0: 'map', 1: 'map', 2: 'rejected' },
    bestCandidateScores: { 0: 92, 1: 88, 2: 85, 3: 81, 4: 45 },
  }, candidatesScore)
  // 0 proposed 92 → recommended; 1 proposed 40 → low (its own score, not the
  // better candidate); 2 rejected → unranked; 3 best 81 → recommended;
  // 4 best 45 → low; 5 no candidates → unranked
  assert.deepEqual(countQualityBuckets(qualities), { recommended: 2, available: 0, low_ranked: 2 })
  assert.equal(qualities[2], null)
  assert.equal(qualities[5], null)
})

test('filterRowsByQualityBucket: keeps the bucket\'s rows, sorted by score', () => {
  const rows = run.rowIndexes.map(__index => ({ __index }))
  const qualities = getRowQualities(run, candidatesScore)
  assert.deepEqual(filterRowsByQualityBucket(rows, qualities, 'available', 'desc').map(r => r.__index), [0, 1, 2])
  assert.deepEqual(filterRowsByQualityBucket(rows, qualities, 'available', 'asc').map(r => r.__index), [2, 1, 0])
  assert.deepEqual(filterRowsByQualityBucket(rows, qualities, 'low_ranked', 'desc').map(r => r.__index), [3, 4])
})

test('filterRowsByQualityBucket: a proposed match with no score sorts as 0 in Low Ranked', () => {
  const rows = [0, 1].map(__index => ({ __index }))
  const qualities = getRowQualities({ rowIndexes: [0, 1], mapSelected: { 0: {} }, decisions: { 0: 'map' }, bestCandidateScores: { 1: 30 } }, candidatesScore)
  assert.deepEqual(filterRowsByQualityBucket(rows, qualities, 'low_ranked', 'asc').map(r => r.__index), [0, 1])
})

test('filterRowsByQualityBucket: no bucket, or a bucket with no rows, leaves the rows as they are', () => {
  const rows = run.rowIndexes.map(__index => ({ __index }))
  const qualities = getRowQualities(run, candidatesScore)
  assert.equal(filterRowsByQualityBucket(rows, qualities, false, 'desc'), rows)
  assert.equal(filterRowsByQualityBucket(rows, qualities, 'recommended', 'desc'), rows)
})
