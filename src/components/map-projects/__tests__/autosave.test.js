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

import { createAutosaveScheduler, createLatestSender, isToldOnLeave, recordReadOnlyRefusal, saveOnLeave, sendAfter, trackSave, whenSaved, hasSaveInFlight, AUTOSAVE_DELAY_MS, SAVE_SKIPPED } from '../autosave.js'
import { createEditTracker, shouldAskBeforeLeaving, shouldWarnBeforeUnload } from '../leaveGuard.js'

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
const setup = ({ projectId = 'project-1', saving = false, paused = false } = {}) => {
  const clock = createFakeClock()
  const state = { projectId, saving, paused }
  const saves = []
  const scheduler = createAutosaveScheduler({
    getProjectId: () => state.projectId,
    isSaving: () => state.saving,
    isPaused: () => state.paused,
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

// A read-only project refuses every save (OpenConceptLab/ocl_online#424).

test('autosave paused: scheduling is a no-op while the project is read-only', () => {
  const { scheduler, clock, saves } = setup({ paused: true })

  scheduler.schedule('decision_change')

  assert.equal(scheduler.hasPending(), false)
  clock.tick(DELAY * 2)
  assert.equal(saves.length, 0, 'a read-only project must never autosave')
})

test('autosave paused: a pending autosave doesn\'t fire once the project turns read-only', () => {
  const { scheduler, clock, state, saves } = setup()

  scheduler.schedule('decision_change')
  state.paused = true
  clock.tick(DELAY)

  assert.equal(saves.length, 0, 'no save once read-only')
  assert.deepEqual(scheduler.pendingReasons(), [], 'queued reasons must be cleared')
})

test('autosave paused: nothing is handed back to save on leave', () => {
  const { scheduler, clock, state, saves } = setup()

  scheduler.schedule('auto_match')
  state.paused = true

  assert.equal(scheduler.takePending(), null)
  assert.equal(saveOnLeave({ scheduler, inFlightSave: null, save: reasons => saves.push(reasons) }), false)
  clock.tick(DELAY * 2)
  assert.equal(saves.length, 0)
})

test('autosave paused: scheduling works again once the project is editable', () => {
  const { scheduler, clock, state, saves } = setup({ paused: true })

  scheduler.schedule('decision_change')
  state.paused = false
  scheduler.schedule('bulk_decision')
  clock.tick(DELAY)

  assert.deepEqual(saves, [['bulk_decision']], 'only what was scheduled while editable is saved')
})

// The edit locks can't cover an edit made before the project turned read-only:
// the notice that lands inside the autosave window, or the save refused as
// read-only. Wired as MapProject.jsx wires them: each edit is counted as it
// schedules, the lock cancels the pending autosave, and the lock's end
// requeues what no save kept.
const setupReadOnlyEdits = () => {
  const { scheduler, clock, state, saves } = setup()
  const edits = createEditTracker()
  const edit = reason => {
    edits.edited()
    scheduler.schedule(reason)
  }
  const lock = () => {
    state.paused = true
    scheduler.cancel()
  }
  const unlock = () => {
    state.paused = false
    if(edits.hasUnsaved())
      scheduler.schedule('read_only_ended')
  }
  const leaveState = () => ({runActive: false, projectId: state.projectId, hasInput: true, readOnly: state.paused, unsavedEdits: edits.hasUnsaved()})
  const unloadState = () => ({...leaveState(), pendingAutosave: scheduler.hasPending(), saveInFlight: false, saveFailed: false})
  return { scheduler, clock, saves, edits, edit, lock, unlock, leaveState, unloadState }
}

test('a notice that locks the project inside the autosave window keeps the edit, and both guards ask before leaving', () => {
  const { scheduler, clock, saves, edit, lock, leaveState, unloadState } = setupReadOnlyEdits()

  edit('note_change')
  lock()
  clock.tick(DELAY)

  assert.equal(saves.length, 0, 'the lock dropped the autosave')
  assert.equal(scheduler.takePending(), null, 'so leaving has nothing to save')
  assert.equal(shouldAskBeforeLeaving(leaveState()), true, 'in-app navigation asks')
  assert.equal(shouldWarnBeforeUnload(unloadState()), true, 'closing or reloading the tab warns')
})

test('a save refused as read-only keeps its edits once the refusal is dismissed, and both guards ask', () => {
  const { edits, edit, lock, leaveState, unloadState } = setupReadOnlyEdits()

  edit('decision_change')
  edits.saving() // the autosave's payload, refused: saved() is never called
  lock()

  assert.equal(shouldAskBeforeLeaving(leaveState()), true)
  assert.equal(shouldWarnBeforeUnload({...unloadState(), saveFailed: true}), true)
})

test('once the lock ends, the edits it kept back autosave, and leaving asks nothing more', () => {
  const { clock, saves, edits, edit, lock, unlock, leaveState } = setupReadOnlyEdits()

  edit('note_change')
  lock()
  unlock()
  clock.tick(DELAY)

  assert.deepEqual(saves, [['read_only_ended']])
  edits.saved(edits.saving())
  assert.equal(shouldAskBeforeLeaving(leaveState()), false)
})

test('a lock with no edit before it asks nothing on leave', () => {
  const { lock, unlock, clock, saves, leaveState, unloadState } = setupReadOnlyEdits()

  lock()
  assert.equal(shouldAskBeforeLeaving(leaveState()), false)
  assert.equal(shouldWarnBeforeUnload(unloadState()), false)
  unlock()
  clock.tick(DELAY)
  assert.equal(saves.length, 0, 'nothing to requeue')
})

const nextTick = () => new Promise(resolve => setTimeout(resolve, 0))

const deferred = () => {
  let resolve, reject
  const promise = new Promise((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

test('sendAfter: a queued save sends once the save in flight settles, and not before', async () => {
  const inFlight = deferred()
  const sent = []
  const result = sendAfter(inFlight.promise, () => { sent.push('queued'); return 'response' })
  await nextTick()
  assert.deepEqual(sent, [], 'waits for the save in flight')
  inFlight.resolve()
  assert.equal(await result, 'response')
  assert.deepEqual(sent, ['queued'])
})

test('sendAfter: a queued save is dropped when the save before it turned the project read-only', async () => {
  const inFlight = deferred()
  const state = { readOnly: false }
  const sent = []
  const result = sendAfter(inFlight.promise, () => sent.push('queued'), () => state.readOnly)
  // the save in flight is refused as read-only, which turns the project read-only, then settles
  state.readOnly = true
  inFlight.resolve({ status: 403 })
  assert.equal(await result, SAVE_SKIPPED)
  assert.deepEqual(sent, [], 'no second save once read-only')
})

test('sendAfter: a queued save still sends after the save in flight fails for another reason', async () => {
  const inFlight = deferred()
  const sent = []
  const result = sendAfter(inFlight.promise, () => { sent.push('queued'); return 'response' }, () => false)
  inFlight.reject(new Error('network'))
  assert.equal(await result, 'response')
  assert.deepEqual(sent, ['queued'])
})

const READ_ONLY_REFUSAL = {response: {status: 403, data: {error_code: 'content_read_only', detail: 'Example detail.'}}}

test('recordReadOnlyRefusal: records a read-only refusal, and nothing else', () => {
  const recorded = []
  assert.equal(recordReadOnlyRefusal(READ_ONLY_REFUSAL, body => recorded.push(body.detail)), true)
  assert.equal(recordReadOnlyRefusal({status: 403, data: {error_code: 'content_read_only', detail: 'Other detail.'}}, body => recorded.push(body.detail)), true)
  assert.deepEqual(recorded, ['Example detail.', 'Other detail.'])
  for(const response of [
    {response: {status: 403, data: {error_code: 'example_limit_reached'}}},
    {response: {status: 400, data: {error_code: 'content_read_only'}}},
    {status: 200, data: {id: 7}},
    undefined,
  ])
    assert.equal(recordReadOnlyRefusal(response, () => recorded.push('no')), false, JSON.stringify(response))
  assert.equal(recorded.length, 2)
})

test('two leave saves: once the first is refused as read-only, the one queued behind it isn\'t sent', async () => {
  const state = { readOnly: false }
  const sent = []
  const shown = []
  // onSave's response handler for a save on leave: the refusal is recorded
  // first, then shown as the page closes (a message, never the dialog)
  const handle = response => {
    if(response === SAVE_SKIPPED)
      return 'skipped'
    recordReadOnlyRefusal(response, () => { state.readOnly = true })
    shown.push('leave message')
    return false
  }
  const save = (after, name) => sendAfter(after, () => { sent.push(name); return Promise.resolve(READ_ONLY_REFUSAL) }, () => state.readOnly).then(handle)
  const first = save(null, 'first')
  const second = save(first, 'second')
  assert.equal(await first, false)
  assert.equal(await second, 'skipped')
  assert.deepEqual(sent, ['first'], 'only the first save is sent')
  assert.deepEqual(shown, ['leave message'], 'the refusal is told once')
})

test('a save in flight as the user left, refused as read-only, is told once; the save queued behind it isn\'t sent', async () => {
  const state = { readOnly: false, mounted: true }
  const sent = []
  const told = []
  // onSave's response handler: the refusal is recorded first, then told in a
  // message when no dialog can show
  const handle = leaving => response => {
    if(response === SAVE_SKIPPED)
      return 'skipped'
    const readOnlyRefused = recordReadOnlyRefusal(response, () => { state.readOnly = true })
    if(isToldOnLeave({leaving, mounted: state.mounted, readOnlyRefused}))
      told.push('leave message')
    return false
  }
  const inFlight = deferred()
  // an autosave in flight, then the user leaves with another edit: a save on leave queued behind it
  const autosave = sendAfter(null, () => { sent.push('autosave'); return inFlight.promise }).then(handle(false))
  const leaveSave = sendAfter(autosave, () => { sent.push('leave'); return Promise.resolve(READ_ONLY_REFUSAL) }, () => state.readOnly).then(handle(true))
  state.mounted = false
  inFlight.resolve(READ_ONLY_REFUSAL)
  assert.equal(await leaveSave, 'skipped')
  assert.deepEqual(sent, ['autosave'])
  assert.deepEqual(told, ['leave message'], 'told once, by the save in flight')
})

test('isToldOnLeave: a save on leave, or a read-only refusal once the page is gone', () => {
  assert.equal(isToldOnLeave({leaving: true, mounted: false, readOnlyRefused: false}), true)
  assert.equal(isToldOnLeave({leaving: false, mounted: false, readOnlyRefused: true}), true)
  assert.equal(isToldOnLeave({leaving: false, mounted: true, readOnlyRefused: true}), false, 'the page shows its dialog')
  assert.equal(isToldOnLeave({leaving: false, mounted: false, readOnlyRefused: false}), false, 'other autosave failures stay quiet, as before')
})

test('sendAfter: with nothing in flight it sends at once', () => {
  const sent = []
  assert.equal(sendAfter(null, () => { sent.push('now'); return 'response' }, () => true), 'response')
  assert.deepEqual(sent, ['now'], 'the immediate path is gated by the caller, not here')
})

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

test('saveOnLeave: builds the payload at once, to send after the save in flight', () => {
  const { scheduler } = setup()
  const inFlightSave = new Promise(() => {})
  const leaveSaves = []

  scheduler.schedule('decision_change')
  saveOnLeave({ scheduler, inFlightSave, save: (reasons, {after}) => leaveSaves.push({reasons, after}) })

  // Called now, before anything after leaving can change what it saves.
  assert.equal(leaveSaves.length, 1)
  assert.deepEqual(leaveSaves[0].reasons, ['decision_change'])
  assert.equal(leaveSaves[0].after, inFlightSave)
})

test('saveOnLeave: a rejected leave save is logged', async () => {
  const { scheduler } = setup()
  const logged = []
  const originalError = console.error
  console.error = (...args) => logged.push(args[0])
  try {
    scheduler.schedule('decision_change')
    saveOnLeave({ scheduler, inFlightSave: null, save: () => Promise.reject(new Error('network')) })
    await nextTick()
  } finally {
    console.error = originalError
  }
  assert.deepEqual(logged, ['Mapper: saving on leave failed'])
})

test('saveOnLeave: reopening the project waits for the leave save, not just the save before it', async () => {
  const { scheduler } = setup()
  const order = []
  let finishFirst
  let finishLeave
  const first = trackSave('project-chain', new Promise(resolve => { finishFirst = resolve }).then(() => order.push('first save')))
  const send = () => new Promise(resolve => { finishLeave = resolve }).then(() => order.push('leave save'))

  scheduler.schedule('auto_match_stopped')
  // As onSave does with {after}: tracked now, sent once the first settles.
  saveOnLeave({ scheduler, inFlightSave: first, save: (reasons, {after}) => trackSave('project-chain', Promise.resolve(after).then(send, send)) })
  const reopened = whenSaved('project-chain').then(() => order.push('reopen'))

  finishFirst()
  await first
  await nextTick()
  assert.deepEqual(order, ['first save'], 'the reopen still waits')
  finishLeave()
  await reopened
  assert.deepEqual(order, ['first save', 'leave save', 'reopen'])
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

// ── createLatestSender (ocl_issues#2849) ───────────────────────────────────
// The logs POST sends the whole log each time. With retries, an older POST
// that waited out a 429 could land after a newer one and overwrite it; so one
// POST at a time, and triggers during it coalesce into one more, which reads
// the log as it is then.

test('createLatestSender: one trigger sends once', async () => {
  let sends = 0
  const sender = createLatestSender(async () => { sends += 1 })
  await sender.trigger()
  assert.equal(sends, 1)
})

test('createLatestSender: triggers while a send is in flight coalesce into one more send', async () => {
  const gates = [deferred(), deferred()]
  let sends = 0
  const sender = createLatestSender(() => gates[sends++].promise)
  const first = sender.trigger()
  sender.trigger()
  sender.trigger()
  const last = sender.trigger()
  assert.equal(sends, 1)
  gates[0].resolve()
  await new Promise(resolve => setTimeout(resolve, 0))
  assert.equal(sends, 2)
  gates[1].resolve()
  // every trigger's promise settles once the log is sent as it stood last
  await Promise.all([first, last])
  assert.equal(sends, 2)
})

test('createLatestSender: a failed send doesn\'t stop the pending one, and nothing rejects', async () => {
  let sends = 0
  const sender = createLatestSender(async () => {
    sends += 1
    if(sends === 1) {
      await new Promise(resolve => setTimeout(resolve, 5))
      throw new Error('boom')
    }
  })
  const first = sender.trigger()
  const second = sender.trigger()
  await Promise.all([first, second])
  assert.equal(sends, 2)
})

test('createLatestSender: after it settles, the next trigger sends again', async () => {
  let sends = 0
  const sender = createLatestSender(async () => { sends += 1 })
  await sender.trigger()
  await sender.trigger()
  assert.equal(sends, 2)
})

// Codex review, pass 1: the payload belongs to the sender (one per project),
// so a retry for project A can't pick up project B's log from shared state.
test('createLatestSender: the send reads the latest payload triggered on this sender, on every attempt', async () => {
  const gate = deferred()
  const seen = []
  const sender = createLatestSender(async getPayload => {
    seen.push(getPayload())
    if(seen.length === 1) {
      await gate.promise
      // a retry within the same send reads it again
      seen.push(getPayload())
    }
  })
  const first = sender.trigger({logs: 'a1'})
  sender.trigger({logs: 'a2'})
  sender.trigger({logs: 'a3'})
  gate.resolve()
  await first
  assert.deepEqual(seen, [{logs: 'a1'}, {logs: 'a3'}, {logs: 'a3'}])
})

test('createLatestSender: two senders keep their own payloads', async () => {
  const seen = []
  const a = createLatestSender(async getPayload => { seen.push(['a', getPayload()]) })
  const b = createLatestSender(async getPayload => { seen.push(['b', getPayload()]) })
  await Promise.all([a.trigger('project A'), b.trigger('project B')])
  assert.deepEqual(seen.sort(), [['a', 'project A'], ['b', 'project B']])
})
