/**
 * Tests for the Mapper autosave debounce (OpenConceptLab/ocl_issues#2188).
 *
 * These drive the real scheduler used by MapProject.jsx through an injected
 * virtual clock, so the 5s debounce window is asserted without waiting it out.
 *
 * The reschedule and project-id tests cover the stale-closure defect raised in
 * PR #56 review: the timer callback used to read the `isSaving` and `project`
 * captured by the render that scheduled it, so a save that completed after
 * scheduling was never observed and the autosave wedged.
 */

import test from 'node:test'
import assert from 'node:assert/strict'

import { createAutosaveScheduler, saveOnLeave, trackSave, whenSaved, hasSaveInFlight, AUTOSAVE_DELAY_MS } from '../autosave.js'

// Virtual clock standing in for setTimeout/clearTimeout. Timers scheduled
// while the clock is being advanced land in a later window, as real timers
// would — that is what makes the reschedule path observable.
const createFakeClock = () => {
  let now = 0
  let nextId = 0
  const timers = new Map()

  const setTimeoutFn = (fn, delay) => {
    const id = ++nextId
    timers.set(id, { fn, at: now + delay })
    return id
  }

  const clearTimeoutFn = id => {
    timers.delete(id)
  }

  const tick = ms => {
    now += ms
    const due = [...timers.entries()]
      .filter(([, timer]) => timer.at <= now)
      .sort((a, b) => a[1].at - b[1].at)
    for(const [id, timer] of due) {
      timers.delete(id)
      timer.fn()
    }
  }

  return { setTimeoutFn, clearTimeoutFn, tick, pendingCount: () => timers.size }
}

// Mirrors how MapProject.jsx wires the scheduler: project id and isSaving are
// read through getters backed by refs, so the test can move them mid-window.
const setup = ({ projectId = 'project-1', saving = false } = {}) => {
  const clock = createFakeClock()
  const state = { projectId, saving }
  const saves = []
  const scheduler = createAutosaveScheduler({
    getProjectId: () => state.projectId,
    isSaving: () => state.saving,
    onFire: reasons => saves.push(reasons),
    setTimeoutFn: clock.setTimeoutFn,
    clearTimeoutFn: clock.clearTimeoutFn
  })
  return { scheduler, clock, state, saves }
}

const DELAY = AUTOSAVE_DELAY_MS

test('autosave debounce: triggers within one window coalesce into a single save', () => {
  const { scheduler, clock, saves } = setup()

  scheduler.schedule('decision_change')
  clock.tick(2000)
  scheduler.schedule('bulk_decision')
  clock.tick(2000)
  scheduler.schedule('decision_change') // duplicate reason, restarts the window

  assert.equal(saves.length, 0, 'still inside the debounce window of the last trigger')

  clock.tick(DELAY)

  assert.equal(saves.length, 1, 'three triggers must coalesce into one autosave')
  assert.deepEqual(saves[0], ['decision_change', 'bulk_decision'],
    'reasons accumulate across the window and dedupe')
})

test('autosave debounce: leaves exactly one pending timer behind', () => {
  const { scheduler, clock } = setup()

  scheduler.schedule('decision_change')
  scheduler.schedule('bulk_decision')
  scheduler.schedule('auto_match')

  assert.equal(clock.pendingCount(), 1, 'each trigger must replace the pending timer, not stack one')

  clock.tick(DELAY)
  assert.equal(clock.pendingCount(), 0, 'no timer left running after the save fires')
})

test('autosave regression: a save in flight reschedules, then fires once it completes (#2188 PR review)', () => {
  const { scheduler, clock, state, saves } = setup({ saving: true })

  scheduler.schedule('decision_change')

  clock.tick(DELAY)
  assert.equal(saves.length, 0, 'must not autosave on top of an in-flight save')
  assert.equal(scheduler.hasPending(), true, 'the autosave must be rescheduled, not dropped')

  state.saving = false // the in-flight save completes

  clock.tick(DELAY)
  assert.equal(saves.length, 1, 'autosave must observe the completed save and fire on the next window')
  assert.deepEqual(saves[0], ['decision_change'])
})

test('autosave regression: reasons queued during a save survive the reschedule', () => {
  const { scheduler, clock, state, saves } = setup({ saving: true })

  scheduler.schedule('decision_change')
  clock.tick(DELAY) // reschedules — save still in flight
  scheduler.schedule('bulk_decision')

  state.saving = false
  clock.tick(DELAY)

  assert.equal(saves.length, 1)
  assert.deepEqual(saves[0], ['decision_change', 'bulk_decision'],
    'a reason queued while saving must not be lost by the reschedule')
})

test('autosave: cancel() preempts a pending autosave, as a manual save does', () => {
  const { scheduler, clock, saves } = setup()

  scheduler.schedule('decision_change')
  scheduler.cancel()

  assert.equal(scheduler.hasPending(), false, 'pending timer must be cleared')
  assert.deepEqual(scheduler.pendingReasons(), [], 'queued reasons must be dropped')

  clock.tick(DELAY * 2)
  assert.equal(saves.length, 0, 'a cancelled autosave must never fire')

  // scheduling afterward still works, and does not resurrect the old reason
  scheduler.schedule('bulk_decision')
  clock.tick(DELAY)
  assert.deepEqual(saves, [['bulk_decision']])
})

test('autosave gating: scheduling is a no-op for a project with no id', () => {
  const { scheduler, clock, saves } = setup({ projectId: null })

  scheduler.schedule('decision_change')

  assert.equal(scheduler.hasPending(), false)
  clock.tick(DELAY * 2)
  assert.equal(saves.length, 0, 'autosave must never run for an unsaved project')
})

test('autosave gating: a pending autosave is dropped if the project id goes away', () => {
  const { scheduler, clock, state, saves } = setup()

  scheduler.schedule('decision_change')
  state.projectId = null

  clock.tick(DELAY)

  assert.equal(saves.length, 0, 'no save without a project id')
  assert.deepEqual(scheduler.pendingReasons(), [], 'queued reasons must be cleared')
})

// Leaving the project inside the autosave window (OpenConceptLab/ocl_issues#2829).

test('autosave: takePending() hands back the queued reasons and clears the timer', () => {
  const { scheduler, clock, saves } = setup()

  scheduler.schedule('auto_match')
  scheduler.schedule('decision_change')

  assert.deepEqual(scheduler.takePending(), ['auto_match', 'decision_change'])
  assert.equal(scheduler.hasPending(), false)
  assert.deepEqual(scheduler.pendingReasons(), [])

  clock.tick(DELAY * 2)
  assert.equal(saves.length, 0, 'the taken autosave must not also fire from the timer')
})

test('autosave: takePending() is null with nothing pending, or once the project id is gone', () => {
  const { scheduler, state } = setup()

  assert.equal(scheduler.takePending(), null)

  scheduler.schedule('decision_change')
  state.projectId = null
  assert.equal(scheduler.takePending(), null, 'no save without a project id')
  assert.equal(scheduler.hasPending(), false)
})

const nextTick = () => new Promise(resolve => setTimeout(resolve, 0))

test('saveOnLeave: saves a pending change as the page closes instead of dropping it', async () => {
  const { scheduler, clock, saves } = setup()
  const leaveSaves = []

  scheduler.schedule('auto_match')
  const queued = saveOnLeave({ scheduler, inFlightSave: null, save: reasons => leaveSaves.push(reasons) })

  assert.equal(queued, true)
  await nextTick()
  assert.deepEqual(leaveSaves, [['auto_match']], 'saved at once, not 5s later')
  clock.tick(DELAY * 2)
  assert.equal(saves.length, 0, 'and only once')
})

test('saveOnLeave: an error building the payload is logged, never thrown into the unmount', async () => {
  const { scheduler } = setup()
  const logged = []
  const originalError = console.error
  console.error = (...args) => logged.push(args[0])
  try {
    scheduler.schedule('decision_change')
    assert.doesNotThrow(() => saveOnLeave({ scheduler, inFlightSave: null, save: () => { throw new Error('bad payload') } }))
    await nextTick()
  } finally {
    console.error = originalError
  }
  assert.deepEqual(logged, ['Mapper: saving on leave failed'])
})

test('saveOnLeave: nothing pending, nothing saved', () => {
  const { scheduler } = setup()
  const leaveSaves = []

  assert.equal(saveOnLeave({ scheduler, inFlightSave: null, save: reasons => leaveSaves.push(reasons) }), false)
  assert.deepEqual(leaveSaves, [])
})

test('saveOnLeave: waits for a save in flight, so the newer payload lands last', async () => {
  const { scheduler } = setup()
  const order = []
  let finish
  const inFlightSave = new Promise(resolve => { finish = resolve }).then(() => order.push('in-flight save'))

  scheduler.schedule('decision_change')
  saveOnLeave({ scheduler, inFlightSave, save: reasons => order.push(`leave save: ${reasons}`) })
  assert.deepEqual(order, [], 'must not save on top of the in-flight save')

  finish()
  await inFlightSave
  await nextTick()
  assert.deepEqual(order, ['in-flight save', 'leave save: decision_change'])
})

test('saveOnLeave: still saves when the in-flight save fails', async () => {
  const { scheduler } = setup()
  const leaveSaves = []
  const inFlightSave = Promise.reject(new Error('network'))

  scheduler.schedule('decision_change')
  saveOnLeave({ scheduler, inFlightSave, save: reasons => leaveSaves.push(reasons) })

  await inFlightSave.catch(() => {})
  await nextTick()
  assert.deepEqual(leaveSaves, [['decision_change']])
})

// Saves that outlive their page: reopening the project waits for them, and
// closing the tab warns while any is in flight.

test('whenSaved: resolves at once with no save in flight for the project', async () => {
  assert.equal(hasSaveInFlight(), false)
  await whenSaved('project-none')
})

test('whenSaved: waits for the tracked save and resolves even when it fails', async () => {
  const order = []
  let fail
  const request = new Promise((resolve, reject) => { fail = reject })
  trackSave(160, request)
  assert.equal(hasSaveInFlight(), true)

  const loaded = whenSaved('160').then(() => order.push('load'))
  await nextTick()
  assert.deepEqual(order, [], 'the load must wait while the save is in flight')

  fail(new Error('network'))
  await loaded
  assert.deepEqual(order, ['load'])
  assert.equal(hasSaveInFlight(), false, 'a settled save is no longer tracked')
})

test('trackSave: an older save settling does not untrack a newer one for the same project', async () => {
  let finishOld, finishNew
  const older = new Promise(resolve => { finishOld = resolve })
  const newer = new Promise(resolve => { finishNew = resolve })
  trackSave('project-7', older)
  trackSave('project-7', newer)

  finishOld()
  await older
  await nextTick()
  assert.equal(hasSaveInFlight(), true, 'the newer save is still uploading')

  finishNew()
  await newer
  await nextTick()
  assert.equal(hasSaveInFlight(), false)
})
