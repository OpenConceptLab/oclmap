/**
 * The AutoMatch dialog follows the target repository's versions read
 * (OpenConceptLab/ocl_issues#3067): loading while it runs, failed if it
 * fails, and Try again repeats the same read, so a new project's draft
 * survives a failed read.
 *
 * MapProject can't be mounted here (these tests run without a JSX transform),
 * so this reads its source.
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import babel from '@babel/core'

const source = readFileSync(new URL('../MapProject.jsx', import.meta.url), 'utf8')
const ast = babel.parseSync(source, {babelrc: false, configFile: false, parserOpts: {plugins: ['jsx']}})
const code = node => source.slice(node.start, node.end)

const fetchVersions = (() => {
  let body
  babel.traverse(ast, {
    VariableDeclarator({node}) {
      if(node.id.name === 'fetchVersions')
        body = code(node.init)
    }
  })
  return body
})()

test('a versions read starts loading and keeps its arguments for Try again', () => {
  assert.match(fetchVersions, /versionsArgsRef\.current = \[url, savedVersion\]\s*setVersionsStatus\('loading'\)\s*\/\/[^\n]*\n[^\n]*\n\s*APIService/)
})

test('a versions read settles a rate-limited reply and ends loaded or failed', () => {
  // Raw: a 429 settles after the app's countdown instead of never.
  assert.match(fetchVersions, /\.get\(undefined, undefined, undefined, true\)/)
  assert.match(fetchVersions, /setVersionsStatus\(fetchedVersions \? null : 'failed'\)/)
  // Only the latest read sets the status.
  assert.ok(fetchVersions.indexOf('request !== versionsRequestRef.current') < fetchVersions.indexOf('setVersionsStatus(fetchedVersions'))
})

test('the dialog gets the status and a Try again that repeats the last read', () => {
  assert.match(source, /versionsStatus,\s*onRetryVersions: \(\) => fetchVersions\(\.\.\.versionsArgsRef\.current\),/)
})
