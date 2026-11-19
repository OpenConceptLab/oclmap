/**
 * The kept line under a form field follows the owner chosen now
 * (OpenConceptLab/ocl_online#700): switching away and back shows the line
 * kept for the earlier choice in no committed render, drops a late reply for
 * another owner, and shows the fresh reply.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { render, act, cleanup } from '@testing-library/react'

import { toCapabilityNoteKey, useKeptCapabilityNote } from '../capabilityNote.js'

const keyFor = owner => toCapabilityNoteKey({capability: 'example.capability', owner, lang: 'en'})
const PERSONAL = keyFor('/users/someone/')
const ORG = keyFor('/orgs/Example/')

// Records what every render showed.
const renderNotes = () => {
  const shown = []
  let keep
  const Note = ({noteKey}) => {
    const [note, keepNote] = useKeptCapabilityNote(noteKey)
    keep = keepNote
    shown.push(note)
    return React.createElement('span', {'data-testid': 'note'}, note || '')
  }
  return {Note, shown, keep: (...args) => act(() => keep(...args))}
}

test('switching away and straight back never shows the earlier line', () => {
  const { Note, shown, keep } = renderNotes()
  const { rerender, getByTestId } = render(React.createElement(Note, {noteKey: PERSONAL}))
  keep(PERSONAL, 'Personal line.')
  assert.equal(getByTestId('note').textContent, 'Personal line.')

  shown.length = 0
  rerender(React.createElement(Note, {noteKey: ORG}))
  rerender(React.createElement(Note, {noteKey: PERSONAL}))
  assert.deepEqual(shown.filter(Boolean), [], 'no render after the switch showed a line')
  assert.equal(getByTestId('note').textContent, '')

  // the organization's late reply is dropped; the fresh personal one shows
  keep(ORG, 'Org line.')
  assert.equal(getByTestId('note').textContent, '')
  keep(PERSONAL, 'Personal line again.')
  assert.equal(getByTestId('note').textContent, 'Personal line again.')
  cleanup()
})
