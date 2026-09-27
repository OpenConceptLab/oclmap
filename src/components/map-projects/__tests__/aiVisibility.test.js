import test from 'node:test'
import assert from 'node:assert/strict'

import { canSeeAIInternals, getAIAssistantChoices, getModelUsed, getPromptTemplateKey, createLatestRequestGate } from '../aiVisibility.js'

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

// Which prompt template runs and is saved (ocl_online#259 review: non-staff ran
// and saved the default template whenever the AI models loaded before the project).

test('getPromptTemplateKey: staff run and save the template they picked', () => {
  assert.equal(getPromptTemplateKey({ canSelect: true, selectedKey: 'custom-staff', configuredKey: 'custom', fallbackKey: 'default' }), 'custom-staff')
  assert.equal(getPromptTemplateKey({ canSelect: true, selectedKey: undefined, configuredKey: 'custom', fallbackKey: 'default' }), 'custom')
})

test('getPromptTemplateKey: non-staff get the project template, never a stale fetched one', () => {
  // A template fetched before the project loaded is still in state.
  assert.equal(getPromptTemplateKey({ canSelect: false, selectedKey: 'default', configuredKey: 'custom', fallbackKey: 'default' }), 'custom')
})

test('getPromptTemplateKey: with no project template, the fallback applies', () => {
  assert.equal(getPromptTemplateKey({ canSelect: false, selectedKey: undefined, configuredKey: '', fallbackKey: 'default' }), 'default')
  assert.equal(getPromptTemplateKey({ canSelect: false, selectedKey: undefined, configuredKey: '' }), '')
})

test('createLatestRequestGate: only the latest request is current', () => {
  const gate = createLatestRequestGate()
  const first = gate.next()
  const second = gate.next()
  assert.equal(gate.isCurrent(first), false)
  assert.equal(gate.isCurrent(second), true)
})

test('regression: AI models load before the project, and the late default response is dropped', async () => {
  // Mirrors MapProject for a non-staff user: fetch by the configured key, again
  // when it changes, and apply only the current response.
  const gate = createLatestRequestGate()
  let loaded = null
  const pending = []
  const fetchByKey = key => {
    const ticket = gate.next()
    let respond
    pending.push({ key, done: new Promise(resolve => { respond = resolve }).then(template => { if(gate.isCurrent(ticket)) loaded = template }), respond })
  }
  const keyFor = configuredKey => getPromptTemplateKey({ canSelect: false, selectedKey: loaded?.key, configuredKey, fallbackKey: 'default' })

  fetchByKey('default')   // models arrive first; the project has no key yet
  fetchByKey('custom')    // the project arrives with its configured template
  assert.equal(keyFor('custom'), 'custom', 'runs and saves use the project key even before its template arrives')

  pending[1].respond({ key: 'custom' })
  pending[0].respond({ key: 'default' })   // the older response lands last
  await Promise.all(pending.map(p => p.done))

  assert.deepEqual(loaded, { key: 'custom' }, 'the stale default response must not replace the project template')
  assert.equal(keyFor('custom'), 'custom')
})
