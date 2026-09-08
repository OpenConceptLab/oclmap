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

import { createAutosaveScheduler, AUTOSAVE_DELAY_MS } from '../autosave.js'

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
