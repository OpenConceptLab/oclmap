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
import { readFileSync } from 'node:fs'
import React from 'react'
import { render, act, cleanup } from '@testing-library/react'
import { ThemeProvider, createTheme, getContrastRatio } from '@mui/material/styles'
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
  // Raised, so a filled neighbour can't paint over the ring's shared edge.
  assert.equal(window.getComputedStyle(button).zIndex, '1')
})

test('a contained link-button keeps its text color under Bootstrap\'s a:focus and a:hover', async () => {
  // The app loads Bootstrap 3, whose anchor rule outranks MUI's button color.
  const css = readFileSync(new URL('../../../public/bootstrap.min.css', import.meta.url), 'utf8')
  const bootstrap = document.createElement('style')
  bootstrap.textContent = css.match(/a:hover,a:focus\{[^}]*\}/)[0]
  document.head.appendChild(bootstrap)
  let undoHover = () => {}
  try {
    const { getByRole } = render(React.createElement(ThemeProvider, { theme }, React.createElement(Button, { variant: 'contained', href: '#new' }, 'New')))
    const link = getByRole('link', { name: 'New' })
    const assertTextColor = state => {
      const { color, backgroundColor } = window.getComputedStyle(link)
      assert.equal(getContrastRatio(color, theme.palette.primary.contrastText), 1, `${state}: text is ${color}`)
      assert.ok(getContrastRatio(color, backgroundColor) >= 4.5, `${state}: ${color} on ${backgroundColor}`)
    }

    await act(async () => { link.focus() })
    assertTextColor('focused')
    await act(async () => { link.blur() })

    undoHover = copyHoverRulesToClass('hover')
    link.classList.add('hover')
    assertTextColor('hovered')
  } finally {
    undoHover()
    bootstrap.remove()
  }
})

// happy-dom doesn't match :hover. Copy every :hover rule, right after itself,
// as a rule for `.<name>`; returns a function that removes the copies.
function copyHoverRulesToClass(name) {
  const copies = []
  for (const sheet of document.styleSheets) {
    for (let i = 0; i < sheet.cssRules.length; i++) {
      const text = sheet.cssRules[i].cssText
      if (!text.includes(':hover')) continue
      sheet.insertRule(text.replaceAll(':hover', `.${name}`), ++i)
      copies.push([sheet, i])
    }
  }
  return () => copies.reverse().forEach(([sheet, i]) => sheet.deleteRule(i))
}
