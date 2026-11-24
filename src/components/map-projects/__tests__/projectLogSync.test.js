/**
 * The API replaces a project's saved log with the one the Mapper sends, so the
 * Mapper sends nothing until it has loaded the saved log, and entries made
 * before then go with it once it loads (OpenConceptLab/ocl_issues#3068).
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import babel from '@babel/core'

import { createProjectLogsLoader, mergeSavedLogs, savedLogsFromResult } from '../projectLogSync.js'

const URL_ = '/users/jontest1/map-projects/7/'
const SAVED = {
  row_logs: {0: [{action: 'approved', created_at: '2026-11-23T18:00:02Z'}, {action: 'mapped', created_at: '2026-11-23T18:00:01Z'}]},
  project_logs: [{action: 'Saved', created_at: '2026-11-23T18:00:03Z'}, {action: 'Created', created_at: '2026-11-23T18:00:00Z'}],
}

// A page with a fake log read and POST. `answers` are the reads' results in
// turn: the saved log, null for a read that failed, or false for one refused.
const ROUTE = '/users/jontest1/map-projects/7/'
const pageWith = (answers = [SAVED], maxRetries = 3, route = ROUTE, options = {}) => {
  const page = {rowLogs: {}, projectLogs: [], posts: [], reads: 0, pending: [], warnings: []}
  page.loader = createProjectLogsLoader({
    delayMs: () => 0,
    maxRetries,
    warn: message => page.warnings.push(message),
    ...options,
    read: url => {
      assert.equal(url, URL_)
      const answer = answers[Math.min(page.reads, answers.length - 1)]
      page.reads += 1
      return new Promise(resolve => page.pending.push(() => resolve(answer)))
    },
    onLoaded: (saved, {send}) => {
      const merged = mergeSavedLogs(saved, {row_logs: page.rowLogs, project_logs: [{action: 'Opened'}, ...page.projectLogs]})
      page.rowLogs = merged.row_logs
      page.projectLogs = merged.project_logs
      if(send)
        page.posts.push(merged)
    }
  })
  // What MapProject does: log locally, and send only once the saved log has loaded.
  page.projectLog = action => {
    page.projectLogs = [{action}, ...page.projectLogs]
    if(page.loader.canSend(URL_))
      page.posts.push({row_logs: page.rowLogs, project_logs: page.projectLogs})
  }
  page.save = () => page.projectLog('Saved again')
  // The page opens.
  page.loader.opened(route)
  // Answers the reads, retries included, until none is left.
  page.answer = async () => {
    for(let idle = 0; idle < 3;) {
      await new Promise(resolve => setTimeout(resolve, 5))
      if(page.pending.length) {
        idle = 0
        page.pending.splice(0).forEach(resolve => resolve())
      } else {
        idle++
      }
    }
  }
  return page
}

test('a download before the log read returns is sent with the saved log once it loads', async () => {
  const page = pageWith()
  page.loader.load(URL_)
  page.projectLog('downloaded')
  // One read at a time: more entries, or another load, ask for no second read.
  page.projectLog('downloaded again')
  page.loader.load(URL_)
  assert.equal(page.reads, 1)
  assert.deepEqual(page.posts, [])

  await page.answer()

  assert.equal(page.reads, 1)
  assert.equal(page.posts.length, 1)
  assert.deepEqual(page.posts[0].project_logs.map(e => e.action), ['Opened', 'downloaded again', 'downloaded', 'Saved', 'Created'])
  assert.deepEqual(page.posts[0].row_logs, SAVED.row_logs)
})

test('a save before the log read returns keeps its entry and the saved history', async () => {
  const page = pageWith()
  page.loader.load(URL_)
  page.rowLogs = {0: [{action: 'rejected'}], 2: [{action: 'excluded'}]}
  page.save()
  assert.deepEqual(page.posts, [])

  await page.answer()

  assert.deepEqual(page.posts.map(p => p.project_logs.map(e => e.action)), [['Opened', 'Saved again', 'Saved', 'Created']])
  // A row's entries made on this page come first, above its saved ones.
  assert.deepEqual(page.posts[0].row_logs[0].map(e => e.action), ['rejected', 'approved', 'mapped'])
  assert.deepEqual(page.posts[0].row_logs[2].map(e => e.action), ['excluded'])
})

test('with nothing held back, loading sends nothing and later entries are sent at once', async () => {
  const page = pageWith()
  page.loader.load(URL_)
  await page.answer()
  assert.deepEqual(page.posts, [])
  assert.deepEqual(page.projectLogs.map(e => e.action), ['Opened', 'Saved', 'Created'])

  page.projectLog('downloaded')
  assert.deepEqual(page.posts.map(p => p.project_logs.map(e => e.action)), [['downloaded', 'Opened', 'Saved', 'Created']])
  assert.equal(page.reads, 1)
})

test('a failed log read sends nothing, and the next entry reads it again', async () => {
  const page = pageWith([null, SAVED])
  page.loader.load(URL_)
  await page.answer()
  assert.equal(page.loader.isLoaded(), false)

  page.save()
  assert.deepEqual(page.posts, [])
  assert.equal(page.reads, 2)

  await page.answer()
  assert.equal(page.loader.isLoaded(), true)
  assert.deepEqual(page.posts.map(p => p.project_logs.map(e => e.action)), [['Opened', 'Saved again', 'Saved', 'Created']])
})

test('a read that fails while an entry waits is read again after a wait', async () => {
  const page = pageWith([null, null, SAVED])
  page.loader.load(URL_)
  page.projectLog('downloaded')
  await page.answer()

  assert.equal(page.reads, 3)
  assert.deepEqual(page.posts.map(p => p.project_logs.map(e => e.action)), [['Opened', 'downloaded', 'Saved', 'Created']])
})

test('reads that keep failing stop after the waits run out, and the next entry starts them again', async () => {
  const page = pageWith([null])
  page.loader.load(URL_)
  page.projectLog('downloaded')
  await page.answer()
  // The first read and three more.
  assert.equal(page.reads, 4)
  assert.deepEqual(page.posts, [])

  page.save()
  await page.answer()
  assert.equal(page.reads, 8)
  assert.deepEqual(page.posts, [])
  // Said once, not on every round.
  assert.equal(page.warnings.length, 1)
})

test('an entry made while a retry waits doesn\'t start the waits over', async () => {
  const delays = []
  const page = pageWith([null], 3, ROUTE, {delayMs: retry => { delays.push(retry); return 0 }})
  page.loader.load(URL_)
  page.projectLog('downloaded')
  for(let round = 0; round < 3; round++) {
    await new Promise(resolve => setTimeout(resolve, 5))
    page.pending.splice(0).forEach(resolve => resolve())
    await new Promise(resolve => setTimeout(resolve, 5))
    page.projectLog('downloaded again')
  }
  await page.answer()

  assert.deepEqual(delays, [0, 1, 2])
  assert.equal(page.reads, 4)
  assert.equal(page.warnings.length, 1)
})

test('a refused read isn\'t read again on a timer, says so once, and the next entry reads it again', async () => {
  const page = pageWith([false, SAVED])
  page.loader.load(URL_)
  page.projectLog('downloaded')
  await page.answer()
  assert.equal(page.reads, 1)
  assert.deepEqual(page.posts, [])
  assert.equal(page.warnings.length, 1)

  page.save()
  await page.answer()
  assert.equal(page.reads, 2)
  assert.deepEqual(page.posts.map(p => p.project_logs.map(e => e.action)), [['Opened', 'Saved again', 'downloaded', 'Saved', 'Created']])
})

test('a refused read with no entry waiting says nothing', async () => {
  const page = pageWith([false])
  page.loader.load(URL_)
  await page.answer()
  assert.equal(page.reads, 1)
  assert.deepEqual(page.warnings, [])
})

test('savedLogsFromResult: the saved log, null for a failure worth a wait, false for a refusal', () => {
  const failed = (reason, status) => ({ok: false, reason, error: status ? {response: {status}} : new Error('network')})
  assert.deepEqual(savedLogsFromResult({ok: true, response: {data: {logs: SAVED}}}), SAVED)
  assert.deepEqual(savedLogsFromResult({ok: true, response: {data: {}}}), {})
  assert.equal(savedLogsFromResult(failed('error', 403)), false)
  assert.equal(savedLogsFromResult(failed('error', 404)), false)
  assert.equal(savedLogsFromResult(failed('error', 500)), null)
  assert.equal(savedLogsFromResult(failed('error', 503)), null)
  assert.equal(savedLogsFromResult(failed('error')), null)
  assert.equal(savedLogsFromResult(failed('throttled', 429)), null)
  assert.equal(savedLogsFromResult({ok: false, reason: 'cancelled'}), null)
})

test('a page left behind sends nothing once the project is open in a newer page', async () => {
  const left = pageWith()
  left.loader.load(URL_)
  left.projectLog('downloaded')

  const reopened = pageWith()
  reopened.loader.load(URL_)
  await reopened.answer()
  reopened.projectLog('downloaded again')

  await left.answer()
  assert.deepEqual(left.posts, [])
  assert.equal(left.loader.isLoaded(), false)
  assert.deepEqual(reopened.posts.map(p => p.project_logs.map(e => e.action)), [['downloaded again', 'Opened', 'Saved', 'Created']])
})

test('an old page whose project details come back late doesn\'t take the project back', async () => {
  const left = pageWith()
  const reopened = pageWith()
  // The reopened page loads first; the old page's details arrive after.
  reopened.loader.load(URL_)
  left.loader.load(URL_)
  left.projectLog('downloaded')
  await reopened.answer()
  reopened.projectLog('downloaded again')

  assert.equal(left.reads, 0)
  assert.deepEqual(left.posts, [])
  assert.deepEqual(reopened.posts.map(p => p.project_logs.map(e => e.action)), [['downloaded again', 'Opened', 'Saved', 'Created']])
})

test('a reopen stops the page left behind at once, before the new page has its project details', async () => {
  const left = pageWith()
  left.loader.load(URL_)
  left.projectLog('downloaded')
  // Reopened by the same route; its details haven't arrived yet.
  const reopened = pageWith()
  await left.answer()

  assert.deepEqual(left.posts, [])
  assert.equal(left.loader.isLoaded(), false)
  reopened.loader.load(URL_)
  await reopened.answer()
  reopened.projectLog('downloaded again')
  assert.deepEqual(reopened.posts.map(p => p.project_logs.map(e => e.action)), [['downloaded again', 'Opened', 'Saved', 'Created']])
})

test('a reopen by another route to the same project stops the page left behind once its details arrive', async () => {
  const left = pageWith()
  left.loader.load(URL_)
  left.projectLog('downloaded')
  const reopened = pageWith([SAVED], 3, '/users/jontest1/map-projects/007/')
  reopened.loader.load(URL_)
  await left.answer()
  await reopened.answer()

  assert.deepEqual(left.posts, [])
  assert.equal(reopened.loader.isLoaded(), true)
})

test('a page left before its log loaded still sends what it held back, if the project isn\'t open again', async () => {
  // As a save on leave does: the page is gone, but its read and send go on.
  const left = pageWith()
  left.loader.load(URL_)
  left.save()
  await left.answer()
  assert.deepEqual(left.posts.map(p => p.project_logs.map(e => e.action)), [['Opened', 'Saved again', 'Saved', 'Created']])
})

test('a read that throws counts as failed', async () => {
  let reads = 0
  const loader = createProjectLogsLoader({
    read: () => {
      reads += 1
      return reads === 1 ? Promise.reject(new Error('network')) : Promise.resolve({})
    },
    onLoaded: () => {}
  })
  loader.opened(null)
  loader.load(URL_)
  await new Promise(resolve => setTimeout(resolve, 0))
  assert.equal(loader.isLoaded(), false)
  assert.equal(loader.canSend(URL_), false)
  await new Promise(resolve => setTimeout(resolve, 0))
  assert.equal(loader.isLoaded(), true)
})

test('a new project has no saved log to wait for', () => {
  const loader = createProjectLogsLoader({loaded: true, read: () => assert.fail('no read'), onLoaded: () => {}})
  assert.equal(loader.canSend(URL_), true)
})

test('mergeSavedLogs keeps a saved log that has no rows or no entries', () => {
  assert.deepEqual(mergeSavedLogs({}, {row_logs: {1: [{action: 'mapped'}]}, project_logs: [{action: 'Opened'}]}),
    {row_logs: {1: [{action: 'mapped'}]}, project_logs: [{action: 'Opened'}]})
  // The API has kept row logs as a list, by row index.
  assert.deepEqual(mergeSavedLogs({row_logs: [], project_logs: null}, {row_logs: {}, project_logs: []}),
    {row_logs: {}, project_logs: []})
  assert.deepEqual(mergeSavedLogs({row_logs: [[{action: 'approved'}], null, [{action: 'mapped'}]]}, {row_logs: {2: [{action: 'rejected'}]}}).row_logs,
    {0: [{action: 'approved'}], 1: null, 2: [{action: 'rejected'}, {action: 'mapped'}]})
})

// MapProject can't be mounted here (these tests run without a JSX transform),
// so these check its syntax tree, ignoring layout.
const source = readFileSync(new URL('../MapProject.jsx', import.meta.url), 'utf8')
const ast = babel.parseSync(source, {babelrc: false, configFile: false, parserOpts: {plugins: ['jsx']}})
const flat = node => source.slice(node.start, node.end).replace(/\s+/g, '')
const find = (type, match, root = null) => {
  const found = []
  const visitor = {[type](path) { if(match(path.node)) found.push(path) }}
  if(root)
    root.traverse(visitor)
  else
    babel.traverse(ast, visitor)
  return found
}
const callsTo = (callee, root) => find('CallExpression', node => flat(node.callee) === callee, root)
const declared = name => {
  const [path] = find('VariableDeclarator', node => node.id.name === name)
  assert.ok(path, `${name} is declared`)
  return path
}

test('MapProject sends the project\'s log only through the loader\'s check', () => {
  const guards = callsTo('postProjectLogs').map(path => {
    const guard = path.findParent(p => p.isIfStatement())
    return guard ? flat(guard.node.test) : null
  })
  assert.deepEqual(guards.sort(), [
    'project?.url&&projectLogsLoaderRef.current.canSend(project.url)',
    'projectLogsLoaderRef.current.canSend(response.data.url)',
    'send',
  ])
})

test('MapProject marks when the page opens, with its route, so a page opened later takes the project\'s log', () => {
  const opened = callsTo('projectLogsLoaderRef.current.opened')
  assert.equal(opened.length, 1)
  const effect = opened[0].findParent(p => p.isCallExpression() && flat(p.node.callee) === 'React.useEffect')
  assert.ok(effect, 'opened() runs in an effect')
  assert.equal(flat(effect.node.arguments[1]), '[]')
  // The route, or null for a new project, is the URL the page reads its project from.
  const route = opened[0].node.arguments[0]
  assert.equal(route.type, 'ConditionalExpression')
  assert.equal(flat(route.test), 'params.projectId')
  assert.equal(route.alternate.type, 'NullLiteral')
  const [projectUrl] = find('VariableDeclarator', node => node.id.name === 'url', declared('fetchAndSetProject'))
  assert.equal(flat(route.consequent), flat(projectUrl.node.init))
})

test('MapProject reads the saved log through the loader, settling a throttled or failed read', () => {
  const gets = find('CallExpression', node => node.callee.property?.name === 'request' &&
    node.arguments[0]?.value === 'GET' && flat(node.callee.object).endsWith(".appendToUrl('logs/')"))
  assert.equal(gets.length, 1)
  const reader = declared('readProjectLogs')
  assert.ok(gets[0].findParent(p => p === reader), 'the one read is readProjectLogs')
  // Its result goes through savedLogsFromResult.
  const body = reader.node.init.body
  assert.equal(body.callee.property.name, 'then')
  assert.equal(flat(body.arguments[0]), 'savedLogsFromResult')
  assert.equal(flat(callsTo('requestWithCapacityRetry', reader)[0].node), flat(body.callee.object))
  const loads = callsTo('projectLogsLoaderRef.current.load')
  assert.deepEqual(loads.map(path => flat(path.node.arguments[0])), ['response.data.url'])
})
