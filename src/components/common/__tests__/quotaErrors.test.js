import test from 'node:test'
import assert from 'node:assert/strict'

import { getQuotaError, isCapMeter, isQuotaError } from '../quotaErrors.js'

test('getQuotaError: maps quota and cap error codes to a meter and kind', () => {
  assert.deepEqual(getQuotaError({error_code: 'mapper_match_operations_limit_reached', limit: 6, used: 6}), {
    meter: 'match_operations', kind: 'quota', errorCode: 'mapper_match_operations_limit_reached', usage: {used: 6, limit: 6},
  })
  assert.equal(getQuotaError({error_code: 'ai_assistant_calls_limit_reached'}).meter, 'ai_assistant_calls')
  assert.equal(getQuotaError({error_code: 'ai_assistant_change_comments_limit_reached'}).meter, 'ai_assistant_change_comments')
  assert.equal(getQuotaError({error_code: 'mapper_projects_limit_reached'}).kind, 'cap')
  assert.equal(getQuotaError({error_code: 'mapper_rows_per_project_limit_reached'}).kind, 'cap')
})

test('getQuotaError: unwraps axios error responses', () => {
  const error = {response: {status: 403, data: {error_code: 'mapper_match_operations_limit_reached', limit: 3, used: 3}}}
  assert.deepEqual(getQuotaError(error).usage, {used: 3, limit: 3})
})

test('getQuotaError: ignores permission errors and unrelated payloads', () => {
  for (const error_code of ['mapper_access_denied', 'mapper_projects_not_entitled', 'ai_assistant_calls_not_entitled', 'validation_error'])
    assert.equal(isQuotaError({error_code}), false, error_code)
  assert.equal(getQuotaError(null), null)
  assert.equal(getQuotaError({detail: 'Nope'}), null)
})

test('isCapMeter: only projects and rows are caps', () => {
  assert.equal(isCapMeter('projects'), true)
  assert.equal(isCapMeter('rows'), true)
  assert.equal(isCapMeter('match_operations'), false)
})
