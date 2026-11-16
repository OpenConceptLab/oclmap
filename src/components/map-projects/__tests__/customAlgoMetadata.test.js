import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { metadataFields, fetchAlgorithmMetadata } from '../customAlgoMetadata.js'

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

test('metadata GET tries the operation without dollar first, then the original on failure', async () => {
  const urls = []
  const result = await fetchAlgorithmMetadata('https://example.test/api/$match?x=$keep', async url => {
    urls.push(url)
    return urls.length === 1 ? {response: {status: 404}} : {data: {ID: 'x', name: 'X'}}
  })
  assert.deepEqual(urls, ['https://example.test/api/match?x=$keep', 'https://example.test/api/$match?x=$keep'])
  assert.equal(result.data.ID, 'x')
})

test('metadata GET avoids a retry on success or when the URL has no operation marker', async () => {
  for (const url of ['https://example.test/api/$match/', 'https://example.test/api/match']) {
    const calls = []
    await fetchAlgorithmMetadata(url, async candidate => { calls.push(candidate); return {data: {id: 'x', name: 'X'}} })
    assert.equal(calls.length, 1)
    assert.equal(calls[0], 'https://example.test/api/match' + (url.endsWith('/') ? '/' : ''))
  }
})

test('metadata GET retries when the first response is not usable metadata', async () => {
  const calls = []
  const result = await fetchAlgorithmMetadata('https://example.test/$match', async url => {
    calls.push(url)
    return calls.length === 1 ? {data: {message: 'not metadata'}} : {data: {id: 'x', name: 'X'}}
  })
  assert.equal(calls.length, 2)
  assert.equal(result.data.id, 'x')
})

test('metadata GET falls back to the parent endpoint after both operation URLs fail', async () => {
  const calls = []
  const result = await fetchAlgorithmMetadata('https://example.test/api/ciel-bridge-rxnorm/$match?lang=en', async url => {
    calls.push(url)
    return calls.length < 3 ? {response: {status: 404}} : {data: {ID: 'x', name: 'X'}}
  })
  assert.deepEqual(calls, [
    'https://example.test/api/ciel-bridge-rxnorm/match?lang=en',
    'https://example.test/api/ciel-bridge-rxnorm/$match?lang=en',
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
  assert.deepEqual(calls, ['https://example.test/api/match/', 'https://example.test/api/$match/', 'https://example.test/api'])
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
  assert.deepEqual(requests, [['GET', '/match', 'Token test'], ['GET', '/$match', 'Token test']])
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
  assert.deepEqual(requests, ['/api/algorithm/match', '/api/algorithm/$match', '/api/algorithm'])
  assert.equal(result.data.ID, 'x')
})
