/**
 * MUI fills a hovered contained button, and a hovered or focused clickable
 * chip, with the palette's `dark` under its `contrastText`. That text must
 * keep WCAG 1.4.3's 4.5:1 (OpenConceptLab/ocl_issues#2969).
 *
 * colors.jsx holds no JSX, but Node won't load a .jsx file, so this imports
 * its source as a data: URL.
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { getContrastRatio } from '@mui/material/styles'

const source = readFileSync(new URL('../colors.jsx', import.meta.url), 'utf8')
const { COLORS } = await import(`data:text/javascript,${encodeURIComponent(source)}`)

for(const name of ['primary', 'secondary', 'tertiary', 'error'])
  test(`${name}.dark keeps its contrastText at 4.5:1 or more`, () => {
    const { dark, contrastText } = COLORS[name]
    const ratio = getContrastRatio(dark, contrastText)
    assert.ok(ratio >= 4.5, `${name}.dark ${dark} under ${contrastText} is ${ratio.toFixed(2)}:1`)
  })
