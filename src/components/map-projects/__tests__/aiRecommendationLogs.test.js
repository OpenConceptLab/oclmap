/**
 * Every entry fetchRecommendation logs goes on the row it analysed, not the
 * row open in the side panel (OpenConceptLab/ocl_issues#2887).
 *
 * fetchRecommendation is a closure inside MapProject, which these tests can't
 * mount (they run without a JSX transform), so this reads its source: each
 * log() call in it must pass __index, the row it was called for.
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import babel from '@babel/core'

test('fetchRecommendation: every AI entry it logs goes on the row being analysed, superseded or not', () => {
  const source = readFileSync(new URL('../MapProject.jsx', import.meta.url), 'utf8')
  const calls = []
  babel.traverse(babel.parseSync(source, {babelrc: false, configFile: false, parserOpts: {plugins: ['jsx']}}), {
    VariableDeclarator(path) {
      if(path.node.id.name === 'fetchRecommendation')
        path.traverse({
          CallExpression({node}) {
            if(node.callee.name === 'log')
              calls.push({line: node.loc.start.line, row: node.arguments[1]?.name})
          }
        })
    }
  })

  assert.ok(calls.length > 0, 'no log() calls found in fetchRecommendation')
  assert.deepEqual(calls.filter(call => call.row !== '__index'), [])
})
