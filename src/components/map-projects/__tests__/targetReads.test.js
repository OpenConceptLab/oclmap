/**
 * The AutoMatch dialog follows the target repository's reads, the repository
 * and its versions (OpenConceptLab/ocl_issues#3067): loading while they run,
 * failed if one fails, and Try again repeats the failed one, so a new
 * project's draft survives a failed read and Submit waits for both.
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

const functionSource = name => {
  let body
  babel.traverse(ast, {
    VariableDeclarator({node}) {
      if(node.id.name === name)
        body = code(node.init)
    }
  })
  assert.ok(body, `${name} is defined`)
  return body
}

for (const [name, requestRef, argsRef, args, setStatus] of [
  ['fetchVersions', 'versionsRequestRef', 'versionsArgsRef', '[url, savedVersion]', 'setVersionsStatus'],
  ['fetchRepo', 'repoRequestRef', 'repoArgsRef', '[url, _repo]', 'setRepoStatus'],
]) {
  const body = functionSource(name)

  test(`${name} starts loading and keeps its arguments for Try again`, () => {
    assert.match(body, new RegExp(`${argsRef}\\.current = ${args.replace(/[[\]]/g, '\\$&')}\\s*${setStatus}\\('loading'\\)`))
  })

  test(`${name} settles a rate-limited reply`, () => {
    // Raw: a 429 settles after the app's countdown instead of never.
    assert.match(body, /\.get\(undefined, undefined, undefined, true\)\.then\(/)
  })

  test(`only ${name}'s latest read sets anything`, () => {
    const reply = body.slice(body.indexOf('.then('))
    assert.match(reply, new RegExp(`^\\.then\\(response => \\{\\s*if\\(request !== ${requestRef}\\.current\\)\\s*return\\n`))
    assert.match(reply, new RegExp(`${setStatus}\\(fetched\\w+ \\? null : 'failed'\\)`))
  })
}

test('Try again repeats whichever read failed', () => {
  const retry = functionSource('retryTargetReads')
  assert.match(retry, /if\(repoStatus === 'failed'\)\s*fetchRepo\(\.\.\.repoArgsRef\.current\)/)
  assert.match(retry, /if\(versionsStatus === 'failed'\)\s*fetchVersions\(\.\.\.versionsArgsRef\.current\)/)
})

test('the dialog gets both reads\' status and Try again', () => {
  assert.match(source, /targetReadStatus: getTargetReadStatus\(repoStatus, versionsStatus\),\s*onRetryTargetReads: retryTargetReads,/)
})

test('choosing another repository drops an older repository read', () => {
  assert.match(functionSource('onRepoChange'), /repoRequestRef\.current \+= 1\s*setRepo\(newRepo\)\s*setRepoStatus\(null\)/)
})
