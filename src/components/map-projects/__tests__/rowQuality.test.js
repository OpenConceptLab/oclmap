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

import { getRowQuality, getRowQualities, countQualityBuckets, filterRowsByQualityBucket, createBestCandidateScoreCache } from '../rowQuality.js'

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
  getBestCandidateScore: index => ({ 0: 71, 1: 64.2, 2: 55, 3: 31, 4: 12 })[index],
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
    getBestCandidateScore: index => ({ 0: 92, 1: 88, 2: 85, 3: 81, 4: 45 })[index],
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
  const qualities = getRowQualities({ rowIndexes: [0, 1], mapSelected: { 0: {} }, decisions: { 0: 'map' }, getBestCandidateScore: index => ({ 1: 30 })[index] }, candidatesScore)
  assert.deepEqual(filterRowsByQualityBucket(rows, qualities, 'low_ranked', 'asc').map(r => r.__index), [0, 1])
})

test('getRowQualities: only asks for a best candidate where it is used', () => {
  const asked = []
  getRowQualities({
    rowIndexes: [0, 1, 2],
    mapSelected: { 0: proposed(90) },
    decisions: { 0: 'map', 1: 'rejected' },
    getBestCandidateScore: index => { asked.push(index); return 70 },
  }, candidatesScore)
  assert.deepEqual(asked, [2])
})

test('filterRowsByQualityBucket: no bucket, or a bucket with no rows in the whole project, leaves the rows as they are', () => {
  const rows = run.rowIndexes.map(__index => ({ __index }))
  const qualities = getRowQualities(run, candidatesScore)
  assert.equal(filterRowsByQualityBucket(rows, qualities, false, 'desc'), rows)
  assert.equal(filterRowsByQualityBucket(rows, qualities, 'recommended', 'desc'), rows)
})

test('filterRowsByQualityBucket: combined with a search or status filter, a bucket with no rows among them shows none', () => {
  const qualities = getRowQualities(run, candidatesScore)
  // the search left only row 3 (Low Ranked); the user picks Available
  assert.deepEqual(filterRowsByQualityBucket([{ __index: 3 }], qualities, 'available', 'desc'), [])
})

test('createBestCandidateScoreCache: recomputes only the rows whose candidates or concepts changed', () => {
  const computed = []
  const computeScore = index => { computed.push(index); return 50 + index }
  const cache = createBestCandidateScoreCache()
  const concepts = { a: { key: 'a' }, b: { key: 'b' }, c: { key: 'c' } }
  const rows = { 0: { concept_rows: { a: {} } }, 1: { concept_rows: { b: {} } }, 2: { concept_rows: { c: {} } } }

  let get = cache.getter({ rows, concepts, targetKey: 't', computeScore })
  assert.deepEqual([0, 1, 2].map(get), [50, 51, 52])
  assert.deepEqual(computed, [0, 1, 2])

  // nothing changed: nothing recomputed, even across renders
  computed.length = 0
  get = cache.getter({ rows, concepts, targetKey: 't', computeScore })
  ;[0, 1, 2].forEach(get)
  assert.deepEqual(computed, [])

  // one row's candidates changed (a rerank replaced its state)
  const rows2 = { ...rows, 1: { concept_rows: { b: { rerank_score: 80 } } } }
  get = cache.getter({ rows: rows2, concepts, targetKey: 't', computeScore })
  ;[0, 1, 2].forEach(get)
  assert.deepEqual(computed, [1])

  // a lookup filled in concept c, used only by row 2
  computed.length = 0
  const concepts2 = { ...concepts, c: { key: 'c', display_name: 'C' } }
  get = cache.getter({ rows: rows2, concepts: concepts2, targetKey: 't', computeScore })
  ;[0, 1, 2].forEach(get)
  assert.deepEqual(computed, [2])

  // the target repo changed: every row again
  computed.length = 0
  get = cache.getter({ rows: rows2, concepts: concepts2, targetKey: 'u', computeScore })
  ;[0, 1, 2].forEach(get)
  assert.deepEqual(computed, [0, 1, 2])
})

test('createBestCandidateScoreCache: a row with no candidates has no score and is not computed', () => {
  const computed = []
  const cache = createBestCandidateScoreCache()
  const get = cache.getter({ rows: {}, concepts: {}, targetKey: 't', computeScore: index => { computed.push(index); return 1 } })
  assert.equal(get(7), undefined)
  assert.deepEqual(computed, [])
})

test('createBestCandidateScoreCache: uses each render\'s own computeScore, not the first one it saw', () => {
  // MapProject's first render has no target repo yet, so its pickTopRowView
  // scores nothing; a later render's must be the one used.
  const cache = createBestCandidateScoreCache()
  const rows = { 0: { concept_rows: { a: {} } } }
  const concepts = { a: { key: 'a' } }
  assert.equal(cache.getter({ rows, concepts, targetKey: '|', computeScore: () => undefined })(0), undefined)
  assert.equal(cache.getter({ rows, concepts, targetKey: 'loinc|/orgs/Regenstrief/sources/LOINC/', computeScore: () => 72 })(0), 72)
})
