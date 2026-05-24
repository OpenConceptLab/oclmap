/**
 * Smoke test for the React component test harness.
 *
 * Verifies that:
 *   - happy-dom is registered (document, window, HTMLElement exist as globals)
 *   - @testing-library/react can render a React element
 *   - basic queries work
 *   - cleanup runs between tests so each test gets a fresh DOM
 *
 * If any of these fail, the harness is broken — fix it before relying on
 * the other tests in this directory.
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { render, cleanup } from '@testing-library/react'

test('happy-dom globals are registered', () => {
  /* eslint-env browser */
  assert.notEqual(typeof document, 'undefined', 'document should exist as a global')
  assert.notEqual(typeof window, 'undefined', 'window should exist as a global')
  assert.notEqual(typeof HTMLElement, 'undefined', 'HTMLElement should exist as a global')
})

test('@testing-library/react renders a React element into happy-dom', () => {
  const el = React.createElement('div', { 'data-testid': 'hello' }, 'hi')
  const { getByTestId, unmount } = render(el)

  const node = getByTestId('hello')
  assert.ok(node, 'rendered node should be queryable by data-testid')
  assert.equal(node.textContent, 'hi')

  unmount()
})

test('cleanup between tests leaves DOM empty (smoke check)', () => {
  cleanup()
  // After cleanup, RTL's container should be gone from document.body.
  assert.equal(document.body.childElementCount, 0,
    'document.body should have no children after cleanup')
})
