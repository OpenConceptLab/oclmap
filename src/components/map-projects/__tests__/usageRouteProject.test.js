/**
 * A project's first save asks for no OCL AI Assistant report itself: its route
 * has no project id yet, and the report is kept per project. The new project's
 * report is asked for once the route has its id, and again when a reply lands
 * for another project than the open one (OpenConceptLab/ocl_online#641).
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

test('the first save refreshes the capabilities without asking for a usage report', () => {
  const refreshes = []
  babel.traverse(ast, {
    IfStatement(path) {
      if(code(path.node.test) !== '!isUpdate')
        return
      path.traverse({
        CallExpression({node}) {
          if(node.callee.name === 'refreshMapperQuotaCache')
            refreshes.push(node.arguments.map(code))
        }
      })
    }
  })
  assert.deepEqual(refreshes, [['{usage: false}']])
})

test('the route gaining a project id refreshes the capabilities and that project\'s usage report', () => {
  const effects = []
  babel.traverse(ast, {
    CallExpression(path) {
      const [effect, deps] = path.node.arguments
      if(code(path.node.callee) !== 'React.useEffect' || !deps || code(deps) !== '[params.projectId]')
        return
      const refreshes = []
      path.traverse({
        CallExpression({node}) {
          if(node.callee.name === 'refreshMapperQuotaCache')
            refreshes.push(node.arguments.map(code))
        }
      })
      if(refreshes.length)
        effects.push({refreshes, body: code(effect)})
    }
  })
  assert.equal(effects.length, 1)
  // No argument: the usage too, asked again if the fresh capabilities grant it.
  assert.deepEqual(effects[0].refreshes, [[]])
  // Only on a change: the mount's own load asks for the opened project's report.
  assert.match(effects[0].body, /usageRouteProjectIdRef\.current === params\.projectId\)\s*return/)
})

test('a reply kept for another project than the open one asks for the open one\'s report', () => {
  const refreshes = []
  babel.traverse(ast, {
    CallExpression({node}) {
      if(node.callee.name === 'refreshMapperQuotaCache' && node.arguments.length && code(node.arguments[0]).includes('usageKept'))
        refreshes.push(code(node.arguments[0]))
    }
  })
  assert.deepEqual(refreshes, ['{usage: !usageKept || lastOfOverlapping || !keptForOpenProject}'])
  assert.match(source, /const keptForOpenProject = invokeProjectId === usageProjectIdRef\.current/)
})
