/**
 * A keyboard-focused button shows the two-tone focus ring, not MUI's focus
 * ripple (OpenConceptLab/ocl_issues#2970).
 *
 * The ripple pulses a circle of the text color at 30% behind the label, which
 * drops the label's contrast below 4.5:1. The theme turns it off and draws the
 * ring on `.Mui-focusVisible` instead. The ring has to win over the elevation
 * shadow MUI gives a focused contained button, and over the `box-shadow: none`
 * a contained ButtonGroup gives its buttons.
 *
 * index.jsx builds the theme and renders the app, so it can't be imported
 * here. It merges `buttonFocusComponents` into its theme; this test renders
 * buttons under a theme built from the same function.
 */

import test, { afterEach } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { render, act, cleanup } from '@testing-library/react'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import Button from '@mui/material/Button'
import ButtonGroup from '@mui/material/ButtonGroup'

import { buttonFocusComponents } from '../buttonFocus.js'

const theme = createTheme({ components: buttonFocusComponents('#FFF', '#2d00e5') })

// Emotion writes the shadow list without the space after the comma.
const RING = '0 0 0 2px #FFF,0 0 0 4px #2d00e5'

afterEach(cleanup)

const focusButton = async (element, name) => {
  const { getByRole } = render(React.createElement(ThemeProvider, { theme }, element))
  const button = getByRole('button', { name })
  await act(async () => { button.focus() })
  return button
}

const assertRingWithoutRipple = button => {
  assert.ok(button.classList.contains('Mui-focusVisible'), 'the button should be focus-visible')
  assert.equal(window.getComputedStyle(button).boxShadow, RING)
  // A count, not the element: printing a DOM node in a failure message hangs.
  assert.equal(button.querySelectorAll('.MuiTouchRipple-childPulsate').length, 0, 'no focus ripple should pulse')
}

for (const variant of ['contained', 'outlined', 'text']) {
  test(`a focused ${variant} button shows the ring and no focus ripple`, async () => {
    const button = await focusButton(React.createElement(Button, { variant }, 'Save'), 'Save')
    assertRingWithoutRipple(button)
  })
}

test('a focused button in a contained ButtonGroup shows the ring and no focus ripple', async () => {
  // Which rule wins depends on which stylesheet came last. When a contained
  // button already sits elsewhere on the page, the group's styles come after
  // the button's. Render one first, so the result doesn't depend on which
  // tests ran before this one.
  const page = React.createElement(
    React.Fragment,
    null,
    React.createElement(Button, { variant: 'contained' }, 'Save'),
    React.createElement(
      ButtonGroup,
      { variant: 'contained' },
      React.createElement(Button, null, 'Map'),
      React.createElement(Button, null, 'More')
    )
  )
  const button = await focusButton(page, 'Map')
  assertRingWithoutRipple(button)
})
