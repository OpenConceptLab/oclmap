import test from 'node:test'
import assert from 'node:assert/strict'

import {
  getToolbarLayout,
  getVisibleSecondaryActionCount,
  splitSecondaryActionsByVisibility
} from '../controlsLayout.js'

test('controlsLayout keeps all secondary actions visible when width is unconstrained', () => {
  assert.equal(
    getVisibleSecondaryActionCount({ toolbarWidth: Number.POSITIVE_INFINITY, hasOverflowItems: true }),
    3
  )
})

test('controlsLayout collapses secondary actions leftmost-first when overflow is always present', () => {
  assert.deepEqual(
    splitSecondaryActionsByVisibility({ toolbarWidth: 260, hasOverflowItems: true }),
    {
      overflowActionKeys: ['settings'],
      visibleActionKeys: ['timeline', 'download']
    }
  )

  assert.deepEqual(
    splitSecondaryActionsByVisibility({ toolbarWidth: 220, hasOverflowItems: true }),
    {
      overflowActionKeys: ['settings', 'timeline'],
      visibleActionKeys: ['download']
    }
  )

  assert.deepEqual(
    splitSecondaryActionsByVisibility({ toolbarWidth: 170, hasOverflowItems: true }),
    {
      overflowActionKeys: ['settings', 'timeline', 'download'],
      visibleActionKeys: []
    }
  )
})

test('controlsLayout may skip directly to a single visible secondary action when the overflow trigger first appears', () => {
  assert.deepEqual(
    splitSecondaryActionsByVisibility({ toolbarWidth: 210, hasOverflowItems: false }),
    {
      overflowActionKeys: ['settings', 'timeline'],
      visibleActionKeys: ['download']
    }
  )
})

test('getToolbarLayout shows AutoMatch in full when width is unconstrained', () => {
  assert.deepEqual(
    getToolbarLayout({ toolbarWidth: Number.POSITIVE_INFINITY, hasOverflowItems: true, hasAutoMatch: true }),
    { autoMatch: 'full', saveInMenu: false, overflowActionKeys: [], visibleActionKeys: ['settings', 'timeline', 'download'] }
  )
})

test('getToolbarLayout compacts AutoMatch before collapsing secondary actions', () => {
  const layout = getToolbarLayout({ toolbarWidth: 400, hasOverflowItems: true, hasAutoMatch: true })
  assert.equal(layout.autoMatch, 'compact')
  assert.deepEqual(layout.overflowActionKeys, [])
})

test('getToolbarLayout moves Save and then AutoMatch into the menu as space runs out', () => {
  assert.deepEqual(
    getToolbarLayout({ toolbarWidth: 160, hasOverflowItems: true, hasAutoMatch: true }),
    { autoMatch: 'compact', saveInMenu: true, overflowActionKeys: ['settings', 'timeline', 'download'], visibleActionKeys: [] }
  )
  assert.equal(getToolbarLayout({ toolbarWidth: 80, hasOverflowItems: true, hasAutoMatch: true }).autoMatch, 'menu')
  assert.equal(getToolbarLayout({ toolbarWidth: 80, hasOverflowItems: true, hasAutoMatch: false }).autoMatch, 'none')
})
