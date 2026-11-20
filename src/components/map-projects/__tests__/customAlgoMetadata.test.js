import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { metadataFields, fetchAlgorithmMetadata, conflictingFields } from '../customAlgoMetadata.js'

test('an algorithm never conflicts with itself when its own id and name are re-applied', () => {
  const items = [{__key: 'a', id: 'icd-agent', name: 'ICD Agent'}]
  assert.deepEqual(conflictingFields(items, 'a', {id: 'icd-agent', name: 'ICD Agent', description: ''}), {id: false, name: false})
})

test('id and name conflicts are reported independently against the other algorithms only', () => {
  const items = [{__key: 'a', id: 'icd-agent', name: 'ICD Agent'}, {__key: 'b', id: 'other', name: 'ICD Agent'}]
  assert.deepEqual(conflictingFields(items, 'a', {id: 'other', name: 'Fresh'}), {id: true, name: false})
  assert.deepEqual(conflictingFields(items, 'a', {id: 'fresh', name: 'ICD Agent'}), {id: false, name: true})
})

test('fields absent from the patch are not evaluated', () => {
  const items = [{__key: 'a', id: 'x', name: 'X'}, {__key: 'b', id: 'y', name: 'Y'}]
  assert.deepEqual(conflictingFields(items, 'a', {description: 'd'}), {})
  assert.deepEqual(conflictingFields(items, 'a', {id: 'y'}), {id: true})
})

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

test('metadata GET tries the configured URL first, then the operation without dollar on failure', async () => {
  const urls = []
  const result = await fetchAlgorithmMetadata('https://example.test/api/$match?x=$keep', async url => {
    urls.push(url)
    return urls.length === 1 ? {response: {status: 404}} : {data: {ID: 'x', name: 'X'}}
  })
  assert.deepEqual(urls, ['https://example.test/api/$match?x=$keep', 'https://example.test/api/match?x=$keep'])
  assert.equal(result.data.ID, 'x')
})

test('metadata GET never reaches another document when the configured URL already returns metadata', async () => {
  for (const url of ['https://example.test/api/$match/', 'https://example.test/fhir/ConceptMap/$translate']) {
    const calls = []
    const result = await fetchAlgorithmMetadata(url, async candidate => (
      calls.push(candidate) && candidate === url ? {data: {id: 'configured', name: 'Configured'}} : {data: {id: 'translate', name: 'Wrong document'}}
    ))
    assert.deepEqual(calls, [url])
    assert.equal(result.data.id, 'configured')
  }
})

test('metadata GET requests a URL without an operation marker only once', async () => {
  const calls = []
  await fetchAlgorithmMetadata('https://example.test/api/match', async candidate => { calls.push(candidate); return {response: {status: 404}} })
  assert.deepEqual(calls, ['https://example.test/api/match'])
})

test('metadata GET moves on when the configured URL does not return usable metadata', async () => {
  const calls = []
  const result = await fetchAlgorithmMetadata('https://example.test/$match', async url => {
    calls.push(url)
    return calls.length === 1 ? {data: {message: 'not metadata'}} : {data: {id: 'x', name: 'X'}}
  })
  assert.deepEqual(calls, ['https://example.test/$match', 'https://example.test/match'])
  assert.equal(result.data.id, 'x')
})

test('metadata GET falls back to the parent endpoint after both operation URLs fail', async () => {
  const calls = []
  const result = await fetchAlgorithmMetadata('https://example.test/api/ciel-bridge-rxnorm/$match?lang=en', async url => {
    calls.push(url)
    return calls.length < 3 ? {response: {status: 404}} : {data: {ID: 'x', name: 'X'}}
  })
  assert.deepEqual(calls, [
    'https://example.test/api/ciel-bridge-rxnorm/$match?lang=en',
    'https://example.test/api/ciel-bridge-rxnorm/match?lang=en',
    'https://example.test/api/ciel-bridge-rxnorm?lang=en',
  ])
  assert.equal(result.data.ID, 'x')
})

test('metadata GET retains an authentication failure if the alternate is missing', async () => {
  const result = await fetchAlgorithmMetadata('https://example.test/$match', async url => (
    {response: {status: url.includes('$') ? 404 : 401}}
  ))
  assert.equal(result.response.status, 401)
})

test('parent fallback keeps the first authentication error if all three attempts fail', async () => {
  const calls = []
  const result = await fetchAlgorithmMetadata('https://example.test/api/$match/', async url => {
    calls.push(url)
    return {response: {status: calls.length === 2 ? 403 : 404}}
  })
  assert.deepEqual(calls, ['https://example.test/api/$match/', 'https://example.test/api/match/', 'https://example.test/api'])
  assert.equal(result.response.status, 403)
})

test('metadata fallback performs real GET requests against a local server', async t => {
  const requests = []
  const server = createServer((req, res) => {
    requests.push([req.method, req.url, req.headers.authorization])
    res.setHeader('Content-Type', 'application/json')
    if(req.url === '/$match') res.end(JSON.stringify({ID: 'x', name: 'X', canonical_url: 'https://example.test/system'}))
    else { res.statusCode = 404; res.end('{}') }
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  t.after(() => new Promise(resolve => server.close(resolve)))
  const url = `http://127.0.0.1:${server.address().port}/$match`
  const response = await fetchAlgorithmMetadata(url, async candidate => {
    const result = await fetch(candidate, {headers: {Authorization: 'Token test'}})
    return result.ok ? {data: await result.json()} : {response: {status: result.status}}
  })
  assert.deepEqual(requests, [['GET', '/$match', 'Token test']])
  assert.equal(metadataFields(response.data).canonical_url, 'https://example.test/system')
})

test('parent fallback obtains metadata through real HTTP after two 404 responses', async t => {
  const requests = []
  const server = createServer((req, res) => {
    requests.push(req.url)
    res.setHeader('Content-Type', 'application/json')
    if(req.url === '/api/algorithm') res.end(JSON.stringify({ID: 'x', name: 'X'}))
    else { res.statusCode = 404; res.end('{}') }
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  t.after(() => new Promise(resolve => server.close(resolve)))
  const result = await fetchAlgorithmMetadata(`http://127.0.0.1:${server.address().port}/api/algorithm/$match`, async url => {
    const response = await fetch(url)
    return response.ok ? {data: await response.json()} : {response: {status: response.status}}
  })
  assert.deepEqual(requests, ['/api/algorithm/$match', '/api/algorithm/match', '/api/algorithm'])
  assert.equal(result.data.ID, 'x')
})
