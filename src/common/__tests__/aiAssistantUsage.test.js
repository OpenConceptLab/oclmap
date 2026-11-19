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
  // nothing but the unit and the count
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

test('a refresh sent before another tab kept a report doesn\'t overwrite it', async () => {
  const storage = memoryStorage({'ai_assistant_usage:someone': JSON.stringify({meter: 'tokens', used: 100})})
  let answer
  const get = () => new Promise(resolve => { answer = resolve })
  const refreshed = refreshAIAssistantUsage({...REQUEST, get, storage})
  // the other tab shares the storage, not this module
  storage.setItem('ai_assistant_usage:someone', JSON.stringify({meter: 'tokens', used: 300}))
  answer({status: 200, data: {meter: 'tokens', used: 100}})
  assert.equal(await refreshed, false)
  assert.deepEqual(getAIAssistantUsage(storage, 'someone'), {meter: 'tokens', used: 300})
})

test('a storage that refuses to keep a report throws nothing', async () => {
  const storage = {...memoryStorage(), setItem: () => { throw new Error('QuotaExceededError') }, removeItem: () => { throw new Error('SecurityError') }}
  assert.equal(keepAIAssistantUsage(storage, 'someone', {metadata: {usage: {meter: 'tokens', used: 7}}}), true)
  assert.equal(await refreshAIAssistantUsage({...REQUEST, get: () => Promise.resolve({status: 200, data: {}}), storage}), true)
})

test('a refresh asked for while one is in flight runs after it, and keeps its newer count', async () => {
  const storage = memoryStorage({'ai_assistant_usage:someone': JSON.stringify({meter: 'tokens', used: 100})})
  const answers = []
  let inFlight = 0
  const get = () => {
    inFlight += 1
    assert.equal(inFlight, 1, 'one request at a time')
    return new Promise(resolve => answers.push(data => { inFlight -= 1; resolve({status: 200, data}) }))
  }
  const first = refreshAIAssistantUsage({...REQUEST, get, storage})
  const second = refreshAIAssistantUsage({...REQUEST, get, storage})
  const third = refreshAIAssistantUsage({...REQUEST, get, storage})
  assert.equal(second, third, 'requests made meanwhile share one more')
  assert.equal(answers.length, 1)
  answers[0]({meter: 'tokens', used: 200})
  assert.equal(await first, true)
  await new Promise(resolve => setTimeout(resolve, 0))
  assert.equal(answers.length, 2)
  answers[1]({meter: 'tokens', used: 300})
  assert.equal(await second, true)
  assert.deepEqual(getAIAssistantUsage(storage, 'someone'), {meter: 'tokens', used: 300})
})

test('any username, even one an object has as a property, is refreshed', async () => {
  const storage = memoryStorage()
  const get = () => Promise.resolve({status: 200, data: {meter: 'tokens', used: 9}})
  assert.equal(await refreshAIAssistantUsage({...REQUEST, username: 'constructor', get, storage}), true)
  assert.deepEqual(getAIAssistantUsage(storage, 'constructor'), {meter: 'tokens', used: 9})
})

test('each map project keeps its own report, apart from the one for calls that name none', () => {
  const storage = memoryStorage()
  assert.equal(keepAIAssistantUsage(storage, 'someone', {metadata: {usage: {meter: 'tokens', used: 600}}}, '139'), true)
  assert.equal(keepAIAssistantUsage(storage, 'someone', {metadata: {usage: {meter: 'calls', used: 4}}}), true)
  assert.deepEqual(getAIAssistantUsage(storage, 'someone', '139'), {meter: 'tokens', used: 600})
  assert.deepEqual(getAIAssistantUsage(storage, 'someone', 139), {meter: 'tokens', used: 600})
  assert.deepEqual(getAIAssistantUsage(storage, 'someone'), {meter: 'calls', used: 4})
  assert.deepEqual(getAIAssistantUsage(storage, 'someone', ''), {meter: 'calls', used: 4})
  assert.equal(getAIAssistantUsage(storage, 'someone', '140'), null)
  assert.equal(getAIAssistantUsage(storage, 'someone-else', '139'), null)
})

test('a refresh for a map project names it as the calls on it do, and keeps the report for it', async () => {
  const storage = memoryStorage({'ai_assistant_usage:someone': JSON.stringify({meter: 'calls', used: 4})})
  const calls = []
  const get = (url, config) => {
    calls.push({url, config})
    return Promise.resolve({status: 200, data: {meter: 'tokens', used: 600}})
  }
  assert.equal(await refreshAIAssistantUsage({...REQUEST, project: '139', get, storage}), true)
  assert.deepEqual(calls[0].config.headers, {'X-OCL-Request-Source': 'mapper-ui-manual', 'X-OCL-Event-Metadata': '{"map_project_id":"139"}', Authorization: 'Token personal-token'})
  assert.deepEqual(getAIAssistantUsage(storage, 'someone', '139'), {meter: 'tokens', used: 600})
  assert.deepEqual(getAIAssistantUsage(storage, 'someone'), {meter: 'calls', used: 4})
})

test('refreshes for different map projects don\'t wait on each other', async () => {
  const storage = memoryStorage()
  const answers = []
  const get = (url, config) => new Promise(resolve => answers.push({project: config.headers['X-OCL-Event-Metadata'], answer: data => resolve({status: 200, data})}))
  const first = refreshAIAssistantUsage({...REQUEST, project: '1', get, storage})
  const second = refreshAIAssistantUsage({...REQUEST, project: '2', get, storage})
  assert.deepEqual(answers.map(({project}) => project), ['{"map_project_id":"1"}', '{"map_project_id":"2"}'])
  answers[1].answer({meter: 'tokens', used: 20})
  answers[0].answer({meter: 'calls', used: 1})
  assert.deepEqual([await first, await second], [true, true])
  assert.deepEqual(getAIAssistantUsage(storage, 'someone', '1'), {meter: 'calls', used: 1})
  assert.deepEqual(getAIAssistantUsage(storage, 'someone', '2'), {meter: 'tokens', used: 20})
})
