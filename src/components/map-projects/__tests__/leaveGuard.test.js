/**
 * Tests for leaving a project while Auto Match runs.
 */

import test from 'node:test'
import assert from 'node:assert/strict'

import { blockLeaving, continueLeaving, createRunClosers } from '../leaveGuard.js'

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

  history.replace('/elsewhere')
  unblock()
  continueLeaving(history, held)

  assert.deepEqual(history.calls, [{action: 'REPLACE', location: '/elsewhere'}])
})

test('continueLeaving pushes a held Back', () => {
  const history = createFakeHistory()
  continueLeaving(history, {location: '/back', action: 'POP'})
  assert.deepEqual(history.calls, [{action: 'PUSH', location: '/back'}])
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
