/**
 * Every row log entry an AI Assistant call writes goes on the row the call
 * analysed (OpenConceptLab/ocl_issues#2887). log() puts an entry passed
 * without a row on the row open in the side panel, or under null when none is
 * open, so during Auto Match a failure or quota stop showed up on another row.
 *
 * fetchRecommendation is a closure inside MapProject, which these tests can't
 * mount (they run without a JSX transform), so this reads its source: each
 * log() call with an AIRecommendation* action must pass __index, the row
 * fetchRecommendation was called for. In a bulk run that's the run's row.
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import babel from '@babel/core'

const source = readFileSync(new URL('../MapProject.jsx', import.meta.url), 'utf8')

// The AIRecommendation* log() calls in fetchRecommendation, and the row each passes.
const getAILogCalls = () => {
  const ast = babel.parseSync(source, {babelrc: false, configFile: false, parserOpts: {plugins: ['jsx']}})
  const calls = []
  babel.traverse(ast, {
    VariableDeclarator(path) {
      if(path.node.id.name !== 'fetchRecommendation')
        return
      path.traverse({
        CallExpression({node}) {
          const [entry, row] = node.arguments
          if(node.callee.name !== 'log' || entry?.type !== 'ObjectExpression')
            return
          const action = entry.properties.find(property => property.key?.name === 'action')?.value?.value
          if(String(action).startsWith('AIRecommendation'))
            calls.push({line: node.loc.start.line, action, row: row?.name || null})
        }
      })
    }
  })
  return calls
}

test('fetchRecommendation: every AIRecommendation* entry goes on the row being analysed, superseded or not', () => {
  const calls = getAILogCalls()

  assert.ok(calls.length > 0, 'no AIRecommendation* log() calls found in fetchRecommendation')
  assert.deepEqual(calls.filter(call => call.row !== '__index'), [])
})
