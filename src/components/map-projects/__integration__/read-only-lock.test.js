/**
 * A map project's read-only lock (OpenConceptLab/ocl_online#424, #702) with
 * the notices route's lookup, autosave and saves, as MapProject wires them:
 * useNoticeLookup asks again when the user comes back to a project that shows
 * a strip or is read-only, an empty answer ends the lock and queues the edits
 * kept back, and a save's success ends only a lock it was sent under.
 *
 * The harness mounts the real hook and the real lock, scheduler, edit tracker
 * and sendAfter; only the requests are the test's. It mirrors MapProject's
 * wiring: scheduleAutoSave, onSave's send and its answer, the lookup's effect.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { render, act, cleanup } from '@testing-library/react'

import { READ_ONLY_ERROR_CODE } from '../../common/limitNotice.js'
import useNoticeLookup from '../../common/useNoticeLookup.js'
import { createReadOnlyLock } from '../readOnlyLock.js'
import { createAutosaveScheduler, recordReadOnlyRefusal, sendAfter } from '../autosave.js'
import { createEditTracker } from '../leaveGuard.js'

const PROJECT = '/users/someone/map-projects/1/'
const LOCKED = {notices: [{title: 'Example read-only notice', kind: 'read_only', locks: ['edit']}]}
const EMPTY = {notices: []}
const REFUSED = {response: {status: 403, data: {error_code: READ_ONLY_ERROR_CODE, detail: 'Example refusal'}}}

// Requests the test answers, in any order
const makeRequests = () => {
  const pending = []
  const send = what => new Promise((resolve, reject) => pending.push({what, resolve, reject}))
  return {
    pending,
    send,
    count: what => pending.filter(request => request.what.kind === what).length,
    take: kind => {
      const index = pending.findIndex(request => request.what.kind === kind)
      assert.ok(index >= 0, `a ${kind} request was sent`)
      return pending.splice(index, 1)[0]
    },
  }
}

const settle = () => act(() => new Promise(resolve => setTimeout(resolve, 5)))

const mountProject = () => {
  const requests = makeRequests()
  const asked = []
  const shown = {}
  const handles = {}

  const Project = () => {
    const [isReadOnly, setIsReadOnly] = React.useState(false)
    const [strip, setStrip] = React.useState(null)
    const inFlightSaveRef = React.useRef(null)
    const ref = React.useRef(null)
    if(!ref.current) {
      const tracker = createEditTracker()
      const lock = createReadOnlyLock({
        onChange: ({readOnly, strip}) => {
          setIsReadOnly(readOnly)
          setStrip(strip)
        },
        onLock: () => scheduler.cancel(),
        onUnlock: () => tracker.hasUnsaved() && scheduler.schedule('read_only_ended'),
      })
      const scheduler = createAutosaveScheduler({
        getProjectId: () => 1,
        isSaving: () => Boolean(inFlightSaveRef.current),
        isPaused: () => lock.isReadOnly(),
        onFire: reasons => save({source: 'auto', reasons}),
        delay: 1,
      })
      // MapProject's onSave: the lock a save was sent under is taken as it's sent
      const save = ({source = 'manual', reasons} = {}) => {
        if(source === 'auto' && lock.isReadOnly())
          return
        const editsInSave = tracker.saving()
        let sentUnder = null
        const request = sendAfter(inFlightSaveRef.current, () => {
          sentUnder = lock.stampSend()
          return requests.send({kind: 'save', source, reasons})
        }, () => source === 'auto' && lock.isReadOnly()).then(
          () => {
            tracker.saved(editsInSave)
            lock.releaseAfterSave(sentUnder)
          },
          error => recordReadOnlyRefusal(error, body => lock.enter({notice: null, detail: body.detail}))
        ).finally(() => {
          if(inFlightSaveRef.current === request)
            inFlightSaveRef.current = null
        })
        inFlightSaveRef.current = request
      }
      ref.current = {
        lock,
        save,
        // MapProject's scheduleAutoSave
        edit: () => {
          tracker.edited()
          if(!lock.isReadOnly())
            scheduler.schedule('edit')
        },
        hasUnsaved: () => tracker.hasUnsaved(),
      }
    }
    const { lock } = ref.current
    const answer = useNoticeLookup(JSON.stringify([PROJECT, 'en']), () => {
      asked.push(PROJECT)
      return requests.send({kind: 'notices'})
    }, isReadOnly || Boolean(strip))
    React.useEffect(() => {
      lock.applyAnswer(answer)
    }, [answer])
    Object.assign(handles, ref.current)
    shown.readOnly = isReadOnly
    shown.strip = strip
    return React.createElement('div', {'data-testid': 'project'}, strip?.notice?.title || '')
  }

  render(React.createElement(Project))
  const answer = async (kind, outcome) => {
    const request = requests.take(kind)
    await act(async () => {
      if(outcome === REFUSED)
        request.reject(outcome)
      else
        request.resolve({data: outcome})
    })
    await settle()
  }
  const leaveAndReturn = async () => {
    await act(async () => {
      window.dispatchEvent(new Event('blur'))
      window.dispatchEvent(new Event('focus'))
    })
    await settle()
  }
  return {requests, asked, shown, handles, answer, leaveAndReturn}
}

test.afterEach(cleanup)

test('a locked project unlocks when the user comes back and the lookup answers empty; the edit kept back autosaves', async () => {
  const project = mountProject()
  await project.answer('notices', LOCKED)
  assert.equal(project.shown.readOnly, true)
  assert.equal(project.shown.strip.notice.title, 'Example read-only notice')

  // an edit while it's read-only is kept back: nothing autosaves
  await act(async () => project.handles.edit())
  await settle()
  assert.equal(project.requests.count('save'), 0)
  assert.equal(project.handles.hasUnsaved(), true)

  // access is restored in another tab; coming back asks the same project and language again
  await project.leaveAndReturn()
  assert.deepEqual(project.asked, [PROJECT, PROJECT])
  assert.equal(project.shown.readOnly, true, 'still read-only while the answer is awaited')
  await project.answer('notices', EMPTY)
  assert.equal(project.shown.readOnly, false)
  assert.equal(project.shown.strip, null)

  // the edit kept back is queued and autosaves
  const autosave = project.requests.take('save')
  assert.deepEqual(autosave.what, {kind: 'save', source: 'auto', reasons: ['read_only_ended']})
})

test('a save refused as read-only unlocks when the user comes back and the lookup answers empty', async () => {
  const project = mountProject()
  await project.answer('notices', EMPTY)
  await act(async () => project.handles.edit())
  await settle()
  await project.answer('save', REFUSED)
  assert.equal(project.shown.readOnly, true)
  assert.equal(project.shown.strip.detail, 'Example refusal')

  await project.leaveAndReturn()
  assert.equal(project.asked.length, 2)
  await project.answer('notices', EMPTY)
  assert.equal(project.shown.readOnly, false)
  assert.deepEqual(project.requests.take('save').what.reasons, ['read_only_ended'])
})

test('a project with no strip asks nothing when the user comes back', async () => {
  const project = mountProject()
  await project.answer('notices', EMPTY)
  await project.leaveAndReturn()
  assert.equal(project.asked.length, 1)
})

test('a save sent before a newer lock arrived leaves that lock in place when it goes through', async () => {
  const project = mountProject()
  // the user saves while the lookup is still on its way
  await act(async () => project.handles.save())
  // the lookup locks the project before the save's answer comes back
  await project.answer('notices', LOCKED)
  assert.equal(project.shown.readOnly, true)
  await act(async () => project.handles.edit())
  await project.answer('save', {id: 1})
  assert.equal(project.shown.readOnly, true, 'the newer lock stands')
  assert.equal(project.shown.strip.notice.title, 'Example read-only notice')
  await settle()
  assert.equal(project.requests.count('save'), 0, 'nothing is requeued for autosave')
})

test('a save sent under a lock ends it when it goes through: access was restored', async () => {
  const project = mountProject()
  await project.answer('notices', LOCKED)
  await act(async () => project.handles.save())
  await project.answer('save', {id: 1})
  assert.equal(project.shown.readOnly, false)
  assert.equal(project.shown.strip, null)
})

test('a recheck that still locks, answered after a save sent under the earlier lock, stands', async () => {
  const project = mountProject()
  await project.answer('notices', LOCKED)
  await act(async () => project.handles.save())
  await project.leaveAndReturn()
  await project.answer('notices', LOCKED)
  await project.answer('save', {id: 1})
  assert.equal(project.shown.readOnly, true)
})
