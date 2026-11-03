import test from 'node:test'
import assert from 'node:assert/strict'

const { resolveV3URL, resolveIntegratedV3URL, PRODUCTION_TERMBROWSER_URL } = await import('../appUrls.js')

test('configured URL wins and loses its trailing slash', () => {
  assert.equal(resolveV3URL('https://tb.example.org/', 'https://map.qa.openconceptlab.org', 'map.qa.openconceptlab.org'), 'https://tb.example.org')
})

test('localhost points to the local TermBrowser', () => {
  assert.equal(resolveV3URL('', 'http://localhost:4004', 'localhost:4004'), 'http://localhost:4002')
})

test('official Mapper hosts map to the matching TermBrowser environment', () => {
  assert.equal(resolveV3URL('', 'https://map.openconceptlab.org', 'map.openconceptlab.org'), 'https://app.v3.openconceptlab.org')
  assert.equal(resolveV3URL('', 'https://map.qa.openconceptlab.org', 'map.qa.openconceptlab.org'), 'https://app.v3.qa.openconceptlab.org')
  assert.equal(resolveV3URL(undefined, 'https://map.staging.who.openconceptlab.org', 'map.staging.who.openconceptlab.org'), 'https://app.v3.staging.who.openconceptlab.org')
})

test('custom hosts without configuration point to production', () => {
  assert.equal(resolveV3URL('', 'https://mapper.example.org', 'mapper.example.org'), PRODUCTION_TERMBROWSER_URL)
  assert.equal(resolveV3URL('', undefined, undefined), PRODUCTION_TERMBROWSER_URL)
})

test('an integrated TermBrowser needs configuration or an official Mapper host', () => {
  assert.equal(resolveIntegratedV3URL('https://tb.example.org/', 'https://mapper.example.org', 'mapper.example.org'), 'https://tb.example.org')
  assert.equal(resolveIntegratedV3URL('http://localhost:4002', 'http://localhost:4004', 'localhost:4004'), 'http://localhost:4002')
  assert.equal(resolveIntegratedV3URL('', 'http://localhost:4004', 'localhost:4004'), '', 'a standalone local Mapper keeps its own pages')
  assert.equal(resolveIntegratedV3URL('', 'https://map.qa.openconceptlab.org', 'map.qa.openconceptlab.org'), 'https://app.v3.qa.openconceptlab.org')
  assert.equal(resolveIntegratedV3URL('', 'https://mapper.example.org', 'mapper.example.org'), '')
  assert.equal(resolveIntegratedV3URL('', undefined, undefined), '')
})
