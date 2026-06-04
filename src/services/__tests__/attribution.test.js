/**
 * Unit tests for the attribution header/config builders (ocl_online#105 Phase 5).
 *
 * Run with: npm test
 *
 * The contract under test is the server-side parser
 * (core/common/attribution.py, mirrored in ocl-ai-assistant + ocl-analytics-api)
 * and the vocabulary docs
 * (ocl-online-docs/conventions/{request-source,event-metadata}-vocabulary.md):
 * one discrete request_source header + one single-line, string-valued JSON bag,
 * with row_indices the sole array value.
 */

import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildAttributionHeaders,
  buildConfigSnapshot,
  REQUEST_SOURCE,
  REQUEST_SOURCE_HEADER,
  EVENT_METADATA_HEADER,
} from '../attribution.js'

const meta = headers => JSON.parse(headers[EVENT_METADATA_HEADER])

test('scalar run: automatch source + string-valued bag', () => {
  const h = buildAttributionHeaders({ runId: 4827, projectId: 139, rowIndex: 141, algorithmId: 'ocl-semantic' })
  assert.equal(h[REQUEST_SOURCE_HEADER], REQUEST_SOURCE.AUTOMATCH)
  assert.deepEqual(meta(h), {
    automatch_run_id: '4827',
    map_project_id: '139',
    row_index: '141',
    algorithm_id: 'ocl-semantic',
  })
})

test('every scalar value is a JSON string, not a number', () => {
  const m = meta(buildAttributionHeaders({ runId: 1, projectId: 2, rowIndex: 3, algorithmId: 'x', clientAttemptN: 2 }))
  Object.entries(m).forEach(([key, value]) => {
    assert.equal(typeof value, 'string', `${key} should be a string`)
  })
})

test('batch>1: row_indices int array + string batch_size, no scalar row_index', () => {
  const m = meta(buildAttributionHeaders({ runId: 9, projectId: 5, rowIndices: [1, 2, 3], batchSize: 3, algorithmId: 'ocl-search' }))
  assert.deepEqual(m.row_indices, [1, 2, 3])
  assert.equal(m.batch_size, '3')
  assert.ok(!('row_index' in m), 'batched call must NOT carry a scalar row_index')
})

test('batch_size defaults to rowIndices length when omitted', () => {
  const m = meta(buildAttributionHeaders({ runId: 9, projectId: 5, rowIndices: [4, 5] }))
  assert.equal(m.batch_size, '2')
})

test('single-element rowIndices collapses to a scalar row_index (batch=1 rule)', () => {
  const m = meta(buildAttributionHeaders({ runId: 9, projectId: 5, rowIndices: [7], algorithmId: 'ocl-ciel-bridge' }))
  assert.equal(m.row_index, '7')
  assert.ok(!('row_indices' in m))
  assert.ok(!('batch_size' in m))
})

test('manual call (no runId): mapper-ui-manual + no automatch_run_id', () => {
  const h = buildAttributionHeaders({ projectId: 139, rowIndex: 12 })
  assert.equal(h[REQUEST_SOURCE_HEADER], REQUEST_SOURCE.MANUAL)
  const m = meta(h)
  assert.ok(!('automatch_run_id' in m))
  assert.equal(m.map_project_id, '139')
  assert.equal(m.row_index, '12')
})

test('null/undefined fields are omitted from the bag', () => {
  const m = meta(buildAttributionHeaders({ runId: 1, projectId: 2, rowIndex: null, algorithmId: undefined }))
  assert.deepEqual(Object.keys(m).sort(), ['automatch_run_id', 'map_project_id'])
})

test('event metadata is single-line and round-trips through JSON.parse', () => {
  const raw = buildAttributionHeaders({ runId: 1, projectId: 2, rowIndices: [1, 2], batchSize: 2 })[EVENT_METADATA_HEADER]
  assert.ok(!raw.includes('\n'), 'bag must be single-line')
  assert.doesNotThrow(() => JSON.parse(raw))
})

test('explicit source overrides the runId-derived value', () => {
  const h = buildAttributionHeaders({ runId: 5, projectId: 2, rowIndex: 1, source: REQUEST_SOURCE.MANUAL })
  assert.equal(h[REQUEST_SOURCE_HEADER], REQUEST_SOURCE.MANUAL)
  // the run id is still recorded in the bag even when the source is overridden
  assert.equal(meta(h).automatch_run_id, '5')
})

test('client_attempt_n is recorded as a string when provided', () => {
  const m = meta(buildAttributionHeaders({ runId: 1, projectId: 2, rowIndex: 0, clientAttemptN: 3 }))
  assert.equal(m.client_attempt_n, '3')
})

test('empty input is valid: manual source + empty bag', () => {
  const h = buildAttributionHeaders()
  assert.equal(h[REQUEST_SOURCE_HEADER], REQUEST_SOURCE.MANUAL)
  assert.deepEqual(meta(h), {})
})

test('buildConfigSnapshot strips function-valued algo fields and is JSON-serializable', () => {
  const snapshot = buildConfigSnapshot({
    selectedAlgos: [{ id: 'ocl-semantic', name: 'Semantic', batch_size: 10, getIcon: () => 'icon' }],
    encoderModel: 'enc-1',
    scoreConfig: { recommended: 99, available: 70 },
    filters: { source: 'CIEL' },
    template: { key: 't', version: '1' },
    aiModel: 'claude-haiku',
  })
  assert.deepEqual(snapshot.algorithms, [{ id: 'ocl-semantic', name: 'Semantic', batch_size: 10 }])
  assert.equal(snapshot.encoder, 'enc-1')
  assert.deepEqual(snapshot.score_config, { recommended: 99, available: 70 })
  assert.equal(snapshot.ai_model, 'claude-haiku')
  assert.doesNotThrow(() => JSON.stringify(snapshot))
})

test('buildConfigSnapshot tolerates empty input', () => {
  const snapshot = buildConfigSnapshot()
  assert.deepEqual(snapshot.algorithms, [])
  assert.equal(snapshot.encoder, null)
})
