import test from 'node:test'
import assert from 'node:assert/strict'

import {
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
