import test from 'node:test'
import assert from 'node:assert/strict'

import {
  getPreviewLimitError,
  isAIPreviewLimitError,
  isPreviewLimitError,
  PREVIEW_LIMIT_COPY_KEY,
} from '../previewLimits.js'

test('isPreviewLimitError: recognizes mapper match, rerank access, and AI preview errors', () => {
  const limitErrors = [
    'mapper_match_operations_limit_reached',
    'mapper_match_operations_not_entitled',
    'mapper_access_denied',
    'ai_assistant_calls_limit_reached',
    'ai_assistant_calls_not_entitled',
    'mapper_ai_assistant_denied',
    'mapper_scispacy_denied',
  ]

  for (const error_code of limitErrors)
    assert.equal(isPreviewLimitError({ error_code }), true, error_code)
})

test('getPreviewLimitError: unwraps axios error responses', () => {
  const error = {
    response: {
      data: {
        error_code: 'mapper_access_denied',
        limit: 100,
        used: 100,
      },
    },
  }

  assert.deepEqual(getPreviewLimitError(error), error.response.data)
})

test('preview limit helpers ignore unrelated errors', () => {
  assert.equal(isPreviewLimitError({ error_code: 'validation_error' }), false)
  assert.equal(getPreviewLimitError({ detail: 'Nope' }), null)
})

test('AI preview errors use AI Assistant dialog copy', () => {
  assert.equal(PREVIEW_LIMIT_COPY_KEY.ai_assistant_calls_limit_reached, 'ai_assistant')
  assert.equal(PREVIEW_LIMIT_COPY_KEY.ai_assistant_calls_not_entitled, 'ai_assistant')
  assert.equal(PREVIEW_LIMIT_COPY_KEY.mapper_ai_assistant_denied, 'ai_assistant')
  assert.equal(PREVIEW_LIMIT_COPY_KEY.mapper_scispacy_denied, 'scispacy')
  assert.equal(isAIPreviewLimitError('ai_assistant_calls_limit_reached'), true)
  assert.equal(isAIPreviewLimitError('mapper_match_operations_limit_reached'), false)
})
