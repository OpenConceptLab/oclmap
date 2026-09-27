import test from 'node:test'
import assert from 'node:assert/strict'

import { canSeeAIInternals, getAIAssistantChoices, getModelUsed } from '../aiVisibility.js'

test('canSeeAIInternals: staff and superusers see the model, prompt template, URI and raw JSON', () => {
  assert.equal(canSeeAIInternals({ is_staff: true }), true)
  assert.equal(canSeeAIInternals({ is_superuser: true }), true)
  assert.equal(canSeeAIInternals({ is_staff: true, auth_groups: ['staff_user'] }), true)
})

test('canSeeAIInternals: a non-staff core user does not', () => {
  assert.equal(canSeeAIInternals({ is_staff: false, is_superuser: false, auth_groups: ['core_user'] }), false)
})

test('canSeeAIInternals: early-access, preview and signed-out users do not', () => {
  assert.equal(canSeeAIInternals({ auth_groups: ['early_access'] }), false)
  assert.equal(canSeeAIInternals({ auth_groups: ['preview'] }), false)
  assert.equal(canSeeAIInternals(null), false)
  assert.equal(canSeeAIInternals(undefined), false)
})

test('getAIAssistantChoices: staff and superusers choose the model, the prompt template and the output language', () => {
  const both = { canSelectAIModel: true, canSetAIOutputLocale: true }
  assert.deepEqual(getAIAssistantChoices({ is_staff: true }), both)
  assert.deepEqual(getAIAssistantChoices({ is_superuser: true }), both)
})

test('getAIAssistantChoices: non-staff core, early-access and unlimited-AI users choose the output language only', () => {
  const localeOnly = { canSelectAIModel: false, canSetAIOutputLocale: true }
  assert.deepEqual(getAIAssistantChoices({ is_staff: false, auth_groups: ['core_user'] }), localeOnly)
  assert.deepEqual(getAIAssistantChoices({ auth_groups: ['early_access'] }), localeOnly)
  assert.deepEqual(getAIAssistantChoices({ auth_groups: ['preview'] }, { unlimitedAICalls: true }), localeOnly)
})

test('getAIAssistantChoices: preview and signed-out users choose nothing', () => {
  const none = { canSelectAIModel: false, canSetAIOutputLocale: false }
  assert.deepEqual(getAIAssistantChoices({ auth_groups: ['preview'] }), none)
  assert.deepEqual(getAIAssistantChoices({ auth_groups: ['preview'] }, { unlimitedAICalls: false }), none)
  assert.deepEqual(getAIAssistantChoices(null), none)
  assert.deepEqual(getAIAssistantChoices(undefined), none)
})

test('getModelUsed: reads the model that answered from the reply metadata', () => {
  assert.equal(getModelUsed({ output: {}, metadata: { model_used: 'anthropic/claude-sonnet-5' } }), 'anthropic/claude-sonnet-5')
  assert.equal(getModelUsed({ output: {} }), null)
  assert.equal(getModelUsed(undefined), null)
})
