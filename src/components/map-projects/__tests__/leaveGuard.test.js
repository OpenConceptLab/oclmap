/**
 * Tests for leaving a project while Auto Match runs, or before a new
 * project's first save.
 */

import test from 'node:test'
import assert from 'node:assert/strict'

import { blockLeaving, continueLeaving, createRunClosers, getPageKey, isUnsavedNewProject, shouldAskBeforeLeaving, shouldWarnBeforeUnload } from '../leaveGuard.js'

// Stands in for a history v4 object: block's prompt decides each transition.
const createFakeHistory = () => {
  let prompt = null
  const calls = []
  const transition = (action, location) => {
    if(prompt && prompt(location, action) === false)
      return
    calls.push({action, location})
  }
  return {
    calls,
    block: fn => {
      prompt = fn
      return () => { prompt = null }
    },
    push: location => transition('PUSH', location),
    replace: location => transition('REPLACE', location),
  }
}

test('blockLeaving holds a navigation and hands it over', () => {
  const history = createFakeHistory()
  const blocked = []
  blockLeaving(history, {onBlocked: next => blocked.push(next)})

  history.push('/projects')

  assert.deepEqual(history.calls, [])
  assert.deepEqual(blocked, [{location: '/projects', action: 'PUSH'}])
})

test('blockLeaving lets an allowed navigation through', () => {
  const history = createFakeHistory()
  const blocked = []
  blockLeaving(history, {isAllowed: location => location === '/project/1', onBlocked: next => blocked.push(next)})

  history.push('/project/1')

  assert.deepEqual(history.calls, [{action: 'PUSH', location: '/project/1'}])
  assert.deepEqual(blocked, [])
})

test('continueLeaving replays a held navigation once unblocked', () => {
  const history = createFakeHistory()
  let held = null
  const unblock = blockLeaving(history, {onBlocked: next => { held = next }})

  history.replace({pathname: '/elsewhere'})
  unblock()
  continueLeaving(history, held)

  assert.deepEqual(history.calls, [{action: 'REPLACE', location: {pathname: '/elsewhere', state: undefined}}])
})

test('continueLeaving pushes a held Back', () => {
  const history = createFakeHistory()
  continueLeaving(history, {location: {pathname: '/back'}, action: 'POP'})
  assert.deepEqual(history.calls, [{action: 'PUSH', location: {pathname: '/back', state: undefined}}])
})

test('a run closer closes its run once, whoever calls first', async () => {
  const closers = createRunClosers()
  const closed = []
  const close = closers.add(aborted => { closed.push(aborted) })

  assert.equal(closers.hasOpen(), true)
  // Leaving closes it at once; the run's own close, once its requests settle,
  // must not close it again with a later status.
  await closers.closeAll(true)
  await close(false)

  assert.deepEqual(closed, [true])
  assert.equal(closers.hasOpen(), false)
})

test('a run that closed itself is not closed again on leave', async () => {
  const closers = createRunClosers()
  const closed = []
  const close = closers.add(aborted => { closed.push(aborted) })

  await close(false)
  await closers.closeAll(true)

  assert.deepEqual(closed, [false])
})

test('closeAll closes every run still open', async () => {
  const closers = createRunClosers()
  const closed = []
  closers.add(aborted => { closed.push(['first', aborted]) })
  closers.add(aborted => { closed.push(['second', aborted]) })

  await closers.closeAll(true)

  assert.deepEqual(closed, [['first', true], ['second', true]])
})

test('closing the tab resends a close still in flight, with its own status', async () => {
  const closers = createRunClosers()
  const calls = []
  let settle
  const close = closers.add((aborted, options) => {
    calls.push([aborted, Boolean(options?.keepalive)])
    if(calls.length === 1)
      return new Promise(resolve => { settle = resolve })
  })

  const own = close(false)
  assert.equal(closers.hasOpen(), false)
  assert.equal(closers.hasUnsettled(), true)
  await closers.closeAll(true, {keepalive: true})
  settle()
  await own

  assert.deepEqual(calls, [[false, false], [false, true]])
  assert.equal(closers.hasUnsettled(), false)
})

test('closing the tab sends nothing for a run already closed', async () => {
  const closers = createRunClosers()
  const calls = []
  const close = closers.add((aborted, options) => { calls.push([aborted, Boolean(options?.keepalive)]) })

  await close(false)
  await closers.closeAll(true, {keepalive: true})

  assert.deepEqual(calls, [[false, false]])
})

const start = {key: null, path: null}

test('getPageKey gives another project a new page', () => {
  const first = getPageKey(start, {pathname: '/p/1'}, 'PUSH')
  const next = getPageKey(first, {pathname: '/p/2'}, 'PUSH')
  assert.equal(first.path, '/p/1')
  assert.deepEqual(next, {key: first.key + 1, path: '/p/2'})
})

test("getPageKey keeps the page for a save's own navigation", () => {
  const page = getPageKey(start, {pathname: '/map-projects/new'}, 'POP')
  const saved = getPageKey(page, {pathname: '/p/1', state: {mapProjectFrom: '/map-projects/new'}}, 'PUSH')
  assert.deepEqual(saved, {key: page.key, path: '/p/1'})
})

test('getPageKey gives a new page on Back and Forward after new -> saved', () => {
  const page = getPageKey(start, {pathname: '/map-projects/new'}, 'POP')
  const saved = getPageKey(page, {pathname: '/p/1', state: {mapProjectFrom: '/map-projects/new'}}, 'PUSH')
  const back = getPageKey(saved, {pathname: '/map-projects/new'}, 'POP')
  // Forward replays the save's state, but it isn't the save.
  const forward = getPageKey(back, {pathname: '/p/1', state: {mapProjectFrom: '/map-projects/new'}}, 'POP')

  assert.notEqual(back.key, saved.key)
  assert.notEqual(forward.key, back.key)
  assert.deepEqual(forward, {key: back.key + 1, path: '/p/1'})
})

test('getPageKey gives a new page on Back to an entry a save pushed', () => {
  const page = getPageKey(start, {pathname: '/map-projects/new'}, 'POP')
  const saved = getPageKey(page, {pathname: '/p/1', state: {mapProjectFrom: '/map-projects/new'}}, 'PUSH')
  const other = getPageKey(saved, {pathname: '/p/2'}, 'PUSH')
  const back = getPageKey(other, {pathname: '/p/1', state: {mapProjectFrom: '/map-projects/new'}}, 'POP')
  assert.deepEqual(back, {key: other.key + 1, path: '/p/1'})
})

test('continueLeaving drops the save marker, so a held Forward to a saved entry gets a new page', () => {
  // new saved as /p/1 (kept), Back to new, Forward to /p/1 held by the dialog
  // and continued as a push.
  const history = createFakeHistory()
  const page = getPageKey(start, {pathname: '/map-projects/new'}, 'POP')
  const saved = getPageKey(page, {pathname: '/p/1', state: {mapProjectFrom: '/map-projects/new'}}, 'PUSH')
  const back = getPageKey(saved, {pathname: '/map-projects/new'}, 'POP')

  continueLeaving(history, {location: {pathname: '/p/1', state: {mapProjectFrom: '/map-projects/new'}}, action: 'POP'})
  const [pushed] = history.calls
  const forward = getPageKey(back, pushed.location, pushed.action)

  assert.equal(pushed.location.state, undefined)
  assert.deepEqual(forward, {key: back.key + 1, path: '/p/1'})
})

test('continueLeaving keeps other state', () => {
  const history = createFakeHistory()
  continueLeaving(history, {location: {pathname: '/x', state: {mapProjectFrom: '/y', other: 1}}, action: 'PUSH'})
  assert.deepEqual(history.calls[0].location.state, {other: 1})
})

test('a new project with a file loaded is unsaved until it has an id', () => {
  assert.equal(isUnsavedNewProject({projectId: undefined, hasInput: {name: 'terms.csv'}}), true)
  assert.equal(isUnsavedNewProject({projectId: undefined, hasInput: false}), false)
  assert.equal(isUnsavedNewProject({projectId: 42, hasInput: {name: 'terms.csv'}}), false)
})

test('in-app navigation asks first for a run or an unsaved new project only', () => {
  assert.equal(shouldAskBeforeLeaving({runActive: false, projectId: 42, hasInput: true}), false)
  assert.equal(shouldAskBeforeLeaving({runActive: true, projectId: 42, hasInput: true}), true)
  assert.equal(shouldAskBeforeLeaving({runActive: false, projectId: null, hasInput: true}), true)
  assert.equal(shouldAskBeforeLeaving({runActive: false, projectId: null, hasInput: false}), false)
})

test('closing the tab also warns while a change waits to be saved', () => {
  const saved = {runActive: false, projectId: 42, hasInput: true}
  assert.equal(shouldWarnBeforeUnload({...saved, pendingAutosave: false, saveInFlight: false}), false)
  assert.equal(shouldWarnBeforeUnload({...saved, pendingAutosave: true, saveInFlight: false}), true)
  assert.equal(shouldWarnBeforeUnload({...saved, pendingAutosave: false, saveInFlight: true}), true)
  assert.equal(shouldWarnBeforeUnload({pendingAutosave: false, saveInFlight: false, runActive: false, projectId: null, hasInput: true}), true)
  assert.equal(shouldWarnBeforeUnload({...saved, pendingAutosave: false, saveInFlight: false, saveFailed: true}), true, 'a failed save still has a change to lose')
})
