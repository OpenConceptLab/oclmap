/**
 * Proposal field edits and Configure column-mapping changes are seen as
 * unsaved (ocl_online#786).
 *
 * Run with: npm test
 */

import test from 'node:test'
import assert from 'node:assert/strict'

import { editProposed, getColumnsSnapshot, PROPOSAL_CHANGE } from '../unsavedEdits.js'
import { createAutosaveScheduler, saveOnLeave } from '../autosave.js'
import { shouldWarnBeforeUnload } from '../leaveGuard.js'

const setupScheduler = () => {
  const timers = []
  const saves = []
  const scheduler = createAutosaveScheduler({
    getProjectId: () => 'project-1',
    isSaving: () => false,
    onFire: reasons => saves.push(reasons),
    setTimeoutFn: fn => { timers.push(fn); return timers.length },
    clearTimeoutFn: () => {},
  })
  return { scheduler, saves }
}

const setupProposed = initial => {
  let proposed = initial
  return {
    get: () => proposed,
    setProposed: update => { proposed = update(proposed) },
  }
}

test('editProposed: sets the row\'s proposal and schedules an autosave', () => {
  const { scheduler } = setupScheduler()
  const store = setupProposed({ 2: { id: 'A', name: 'Old' } })

  editProposed({ rowIndex: 3, state: { id: 'B', name: 'New' }, setProposed: store.setProposed, scheduleAutoSave: reason => scheduler.schedule(reason) })

  assert.deepEqual(store.get(), { 2: { id: 'A', name: 'Old' }, 3: { id: 'B', name: 'New' } })
  assert.equal(scheduler.hasPending(), true)
  assert.deepEqual(scheduler.pendingReasons(), [PROPOSAL_CHANGE])
})

test('editProposed: leaving before the autosave runs is caught', () => {
  const { scheduler } = setupScheduler()
  const store = setupProposed({ 0: { id: 'A' } })
  editProposed({ rowIndex: 0, state: { id: 'A', name: 'Edited' }, setProposed: store.setProposed, scheduleAutoSave: reason => scheduler.schedule(reason) })

  assert.equal(shouldWarnBeforeUnload({ pendingAutosave: scheduler.hasPending(), projectId: 'project-1' }), true)

  const saved = []
  assert.equal(saveOnLeave({ scheduler, inFlightSave: null, save: reasons => saved.push(reasons) }), true)
  assert.deepEqual(saved, [[PROPOSAL_CHANGE]])
})

test('editProposed: keeps a copy of the editor\'s top-level fields', () => {
  const store = setupProposed({})
  const state = { id: 'A' }
  editProposed({ rowIndex: 1, state, setProposed: store.setProposed, scheduleAutoSave: () => {} })
  state.id = 'changed later'
  assert.equal(store.get()[1].id, 'A')
})

const columns = [
  { dataKey: 'name', original: 'name', label: 'Name' },
  { dataKey: 'loinc_code', original: 'loinc_code', label: 'Mapping: Code', targetSource: { loinc: '/orgs/Regenstrief/sources/LOINC/' } },
]
const snapshot = cols => JSON.stringify(getColumnsSnapshot(cols))

test('getColumnsSnapshot: a mapping label change is a change', () => {
  const next = [{ ...columns[0], label: 'Synonyms' }, columns[1]]
  assert.notEqual(snapshot(next), snapshot(columns))
})

test('getColumnsSnapshot: a target source change is a change', () => {
  const next = [columns[0], { ...columns[1], targetSource: { loinc: '/orgs/Other/sources/LOINC/' } }]
  assert.notEqual(snapshot(next), snapshot(columns))
})

test('getColumnsSnapshot: clearing a mapping is a change', () => {
  const next = [{ ...columns[0], label: '', unmapped: true }, columns[1]]
  assert.notEqual(snapshot(next), snapshot(columns))
})

test('getColumnsSnapshot: an unchanged mapping is not a change', () => {
  assert.equal(snapshot(columns.map(col => ({ ...col }))), snapshot(columns))
})

test('getColumnsSnapshot: visibility, width and AI Assistant columns still count', () => {
  const base = JSON.stringify(getColumnsSnapshot(columns, {}))
  assert.notEqual(JSON.stringify(getColumnsSnapshot(columns, { columnVisibilityModel: { name: false } })), base)
  assert.notEqual(JSON.stringify(getColumnsSnapshot(columns, { columnWidth: { name: 200 } })), base)
  assert.notEqual(JSON.stringify(getColumnsSnapshot(columns, { AIAssistantColumns: { name: false } })), base)
})

test('getColumnsSnapshot: a missing column list is empty', () => {
  assert.deepEqual(getColumnsSnapshot(undefined), [])
})
