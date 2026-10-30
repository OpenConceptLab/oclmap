import test from 'node:test'
import assert from 'node:assert/strict'

const { projectCrumbs } = await import('../breadcrumb.js')

const toV3URL = path => `https://tb.example.org/#${path}`

test('integrated deployments link both crumbs to TermBrowser', () => {
  assert.deepEqual(projectCrumbs('/users/test/', true, toV3URL).map(c => c.href), [
    'https://tb.example.org/#/users/test/',
    'https://tb.example.org/#/users/test/map-projects'
  ])
})

test('standalone deployments keep the owner as text and the projects crumb local', () => {
  assert.deepEqual(projectCrumbs('/users/test/', false, () => { throw new Error('no TermBrowser link') }).map(c => c.href), [
    null,
    '#/map-projects'
  ])
})
