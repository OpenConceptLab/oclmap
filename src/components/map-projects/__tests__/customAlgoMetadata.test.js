import test from 'node:test'
import assert from 'node:assert/strict'
import { metadataFields } from '../customAlgoMetadata.js'

test('metadata supplies the canonical URL alongside the other form fields', () => {
  assert.deepEqual(metadataFields({ ID: 'agent', name: 'Agent', canonical_url: 'http://example.test/system' }), {
    id: 'agent', name: 'Agent', description: '', canonical_url: 'http://example.test/system'
  })
})

test('missing or invalid canonical URL leaves the existing field untouched', () => {
  for (const canonical_url of [undefined, '', 'invalid', null]) {
    assert.deepEqual(metadataFields({ id: 'agent', name: 'Agent', canonical_url }), {
      id: 'agent', name: 'Agent', description: ''
    })
  }
})
