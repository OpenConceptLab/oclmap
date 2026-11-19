import test from 'node:test'
import assert from 'node:assert/strict'

import { getAIAssistantUsage, getUsageChipReport, keepAIAssistantUsage, refreshAIAssistantUsage, toAIAssistantUsage, withoutAIAssistantUsage } from '../aiAssistantUsage.js'

const memoryStorage = (initial = {}) => {
  const store = {...initial}
  return {
    store,
    getItem: key => (key in store ? store[key] : null),
    setItem: (key, value) => { store[key] = String(value) },
    removeItem: key => { delete store[key] },
  }
}

const REQUEST = {baseURL: 'https://ai.example.org/', token: 'personal-token', username: 'someone'}

// OpenConceptLab/ocl_online#641
test('the usage the service reports is read as sent: a unit and a count', () => {
  assert.deepEqual(toAIAssistantUsage({meter: 'tokens', used: 1234}), {meter: 'tokens', used: 1234})
  assert.deepEqual(toAIAssistantUsage({meter: 'calls', used: 0}), {meter: 'calls', used: 0})
})

test('nothing but the unit and the count is read', () => {
  assert.deepEqual(toAIAssistantUsage({meter: 'tokens', used: 5, limit: 3000, remaining: 2995}), {meter: 'tokens', used: 5})
})

test('a report without a unit and a count is no report', () => {
  for (const data of [undefined, null, {}, 'Not found.', {detail: 'Nope'}, {meter: 'tokens'}, {used: 5}, {meter: 'tokens', used: '5'}, {meter: 7, used: 5}, {meter: 'tokens', used: NaN}])
    assert.equal(toAIAssistantUsage(data), null, JSON.stringify(data))
})

test('a kept report is only for the person it was asked for', () => {
  const storage = memoryStorage({'ai_assistant_usage:someone': JSON.stringify({meter: 'tokens', used: 5})})
  assert.deepEqual(getAIAssistantUsage(storage, 'someone'), {meter: 'tokens', used: 5})
  assert.equal(getAIAssistantUsage(storage, 'someone-else'), null)
  assert.equal(getAIAssistantUsage(storage, undefined), null)
  assert.equal(getAIAssistantUsage(memoryStorage(), 'someone'), null)
  assert.equal(getAIAssistantUsage(memoryStorage({'ai_assistant_usage:someone': '{not json'}), 'someone'), null)
})

test('asks the service with the person\'s token and keeps its report', async () => {
  const storage = memoryStorage()
  const calls = []
  const get = (url, config) => {
    calls.push({url, config})
    return Promise.resolve({status: 200, data: {meter: 'tokens', used: 42}})
  }
  assert.equal(await refreshAIAssistantUsage({...REQUEST, get, storage}), true)
  assert.deepEqual(calls, [{url: 'https://ai.example.org/match/usage/', config: {headers: {Authorization: 'Token personal-token'}, timeout: 10000}}])
  assert.deepEqual(getAIAssistantUsage(storage, 'someone'), {meter: 'tokens', used: 42})
})

test('a failed or throttled request keeps the last report', async () => {
  for (const status of [429, 404, 500]) {
    const storage = memoryStorage({'ai_assistant_usage:someone': JSON.stringify({meter: 'tokens', used: 5})})
    const get = () => Promise.reject({response: {status, headers: {'retry-after': '30'}}})
    assert.equal(await refreshAIAssistantUsage({...REQUEST, get, storage}), false, String(status))
    assert.deepEqual(getAIAssistantUsage(storage, 'someone'), {meter: 'tokens', used: 5}, String(status))
  }
})

test('a report without a unit and a count clears the kept one', async () => {
  const storage = memoryStorage({'ai_assistant_usage:someone': JSON.stringify({meter: 'tokens', used: 5})})
  assert.equal(await refreshAIAssistantUsage({...REQUEST, get: () => Promise.resolve({status: 200, data: {}}), storage}), true)
  assert.equal(getAIAssistantUsage(storage, 'someone'), null)
})

test('no service URL, token or person: nothing is asked', async () => {
  const get = () => assert.fail('asked')
  for (const missing of ['baseURL', 'token', 'username'])
    assert.equal(await refreshAIAssistantUsage({...REQUEST, [missing]: undefined, get, storage: memoryStorage()}), false, missing)
})

// OpenConceptLab/ocl_online#641
test('a reply\'s usage is kept for the person, as a refresh keeps it', () => {
  const storage = memoryStorage()
  assert.equal(keepAIAssistantUsage(storage, 'someone', {output: {}, metadata: {provider: 'x', usage: {meter: 'tokens', used: 7}}}), true)
  assert.deepEqual(getAIAssistantUsage(storage, 'someone'), {meter: 'tokens', used: 7})
  assert.equal(getAIAssistantUsage(storage, 'someone-else'), null)
})

test('a reply without a usage report keeps the last one', () => {
  const storage = memoryStorage({'ai_assistant_usage:someone': JSON.stringify({meter: 'tokens', used: 5})})
  for (const reply of [undefined, null, {}, {metadata: {}}, {metadata: {usage: {meter: 'tokens'}}}, {metadata: {usage: {meter: 'tokens', used: '9'}}}])
    assert.equal(keepAIAssistantUsage(storage, 'someone', reply), false, JSON.stringify(reply))
  assert.equal(keepAIAssistantUsage(storage, undefined, {metadata: {usage: {meter: 'tokens', used: 9}}}), false)
  assert.deepEqual(getAIAssistantUsage(storage, 'someone'), {meter: 'tokens', used: 5})
})

test('what a project stores of a reply leaves out the usage, and only that', () => {
  const reply = {output: {rationale: 'r'}, metadata: {provider: 'openrouter', tokens: {total: 150}, usage: {meter: 'tokens', used: 7}}}
  assert.deepEqual(withoutAIAssistantUsage(reply), {output: {rationale: 'r'}, metadata: {provider: 'openrouter', tokens: {total: 150}}})
  assert.deepEqual(reply.metadata.usage, {meter: 'tokens', used: 7})
  const noUsage = {output: {}, metadata: {provider: 'x'}}
  assert.equal(withoutAIAssistantUsage(noUsage), noUsage)
  for (const value of [undefined, null, {output: {}}])
    assert.equal(withoutAIAssistantUsage(value), value)
})

test('the usage chip shows a report in a unit it knows, and nothing else', () => {
  assert.deepEqual(getUsageChipReport({meter: 'tokens', used: 7}), {meter: 'tokens', used: 7})
  assert.deepEqual(getUsageChipReport({meter: 'calls', used: 3}), {meter: 'calls', used: 3})
  for (const usage of [null, undefined, {meter: 'credits', used: 1}])
    assert.equal(getUsageChipReport(usage), null, JSON.stringify(usage))
})

test('each person keeps their own report', async () => {
  const storage = memoryStorage()
  keepAIAssistantUsage(storage, 'someone', {metadata: {usage: {meter: 'tokens', used: 5}}})
  keepAIAssistantUsage(storage, 'someone-else', {metadata: {usage: {meter: 'calls', used: 2}}})
  const get = () => Promise.reject({response: {status: 429}})
  assert.equal(await refreshAIAssistantUsage({...REQUEST, get, storage}), false)
  assert.deepEqual(getAIAssistantUsage(storage, 'someone'), {meter: 'tokens', used: 5})
  assert.deepEqual(getAIAssistantUsage(storage, 'someone-else'), {meter: 'calls', used: 2})
})

test('a refresh sent before a reply\'s report doesn\'t overwrite it', async () => {
  const storage = memoryStorage()
  let answer
  const get = () => new Promise(resolve => { answer = resolve })
  const refreshed = refreshAIAssistantUsage({...REQUEST, get, storage})
  keepAIAssistantUsage(storage, 'someone', {metadata: {usage: {meter: 'tokens', used: 300}}})
  answer({status: 200, data: {meter: 'tokens', used: 100}})
  assert.equal(await refreshed, false)
  assert.deepEqual(getAIAssistantUsage(storage, 'someone'), {meter: 'tokens', used: 300})
})

test('a storage that refuses to keep a report throws nothing', async () => {
  const storage = {...memoryStorage(), setItem: () => { throw new Error('QuotaExceededError') }, removeItem: () => { throw new Error('SecurityError') }}
  assert.equal(keepAIAssistantUsage(storage, 'someone', {metadata: {usage: {meter: 'tokens', used: 7}}}), true)
  assert.equal(await refreshAIAssistantUsage({...REQUEST, get: () => Promise.resolve({status: 200, data: {}}), storage}), true)
})
