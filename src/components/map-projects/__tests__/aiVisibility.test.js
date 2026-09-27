import test from 'node:test'
import assert from 'node:assert/strict'

import { canSeeAIInternals } from '../aiVisibility.js'

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
