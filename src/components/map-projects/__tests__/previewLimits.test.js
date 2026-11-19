import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  getPreviewLimitCopyKey,
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

// OpenConceptLab/ocl_online#641
test('a refusal with a code the Mapper does not know counts when it names its capability', () => {
  const refusal = {error_code: 'example_service_limit_reached', capability: 'example.capability', detail: 'Refused.'}
  assert.deepEqual(getPreviewLimitError({response: {status: 403, data: refusal}}), refusal)
  assert.equal(isPreviewLimitError({error_code: 'example_service_limit_reached'}), false)
  assert.equal(isPreviewLimitError({error_code: 'example_service_limit_reached', capability: 7}), false)
  assert.equal(isPreviewLimitError({capability: 'example.capability', detail: 'No code.'}), false)
})

test('a refusal with a code the Mapper does not know gets the copy of the step it refused', () => {
  assert.equal(getPreviewLimitCopyKey('mapper_scispacy_denied', 'ai'), 'scispacy')
  assert.equal(getPreviewLimitCopyKey('example_service_not_entitled', 'ai'), 'ai_assistant')
  assert.equal(getPreviewLimitCopyKey('example_service_not_entitled', 'match'), 'generic')
  assert.equal(getPreviewLimitCopyKey(undefined, undefined), 'generic')
})

// Limits reached go to QuotaDialog; PreviewLimitDialog shows the rest.
test('every refusal PreviewLimitDialog shows has its own message in each language', () => {
  for (const locale of ['en', 'es', 'pt-BR', 'zh']) {
    const catalog = JSON.parse(readFileSync(new URL(`../../../i18n/locales/${locale}/translations.json`, import.meta.url), 'utf8')).map_project
    const missing = Object.entries(PREVIEW_LIMIT_COPY_KEY)
      .filter(([errorCode]) => !errorCode.endsWith('_limit_reached'))
      .map(([, kind]) => `limit_unavailable_body_${kind}`)
      .filter(key => !catalog[key])
    assert.deepEqual(missing, [], locale)
  }
})
