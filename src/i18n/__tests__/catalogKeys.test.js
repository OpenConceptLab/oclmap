import test from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// OpenConceptLab/ocl_issues#2917: the catalogs hold the keys the code uses.
// i18next shows a key English lacks as the raw key, or as the English default
// the call passes, in every language. Each locale falls back to English, so a
// key only another locale has is never shown.
const LOCALES_DIR = new URL('../locales/', import.meta.url)
const SRC_DIR = fileURLToPath(new URL('../../', import.meta.url))

const flatten = (node, prefix = []) => typeof node === 'string' ?
  [prefix.join('.')] :
  Object.entries(node).flatMap(([key, value]) => flatten(value, [...prefix, key]))

const keysOf = locale =>
  new Set(flatten(JSON.parse(readFileSync(new URL(`${locale}/translations.json`, LOCALES_DIR), 'utf8'))))

const LOCALES = readdirSync(LOCALES_DIR, { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => entry.name)
const english = keysOf('en')

// The source named these before any catalog had them.
const ADDED = ['common.none', 'common.saved', 'search.save_default_filters', 'map_project.candidates_legacy_shape']

for (const locale of LOCALES) {
  test(`${locale}: has the keys the code used without a catalog entry`, () => {
    const catalog = keysOf(locale)
    assert.deepEqual(ADDED.filter(key => !catalog.has(key)), [])
  })

  test(`${locale}: has no key English lacks`, () => {
    assert.deepEqual([...keysOf(locale)].filter(key => !english.has(key)), [])
  })
}

// A literal key: t('a.b'), this.props.t("a.b"), t(`a.b`), i18nKey='a.b'.
// Keys built at run time ('a.' + id, `a.${id}`) aren't read.
const LITERAL_KEY = /(?:\bt\(\s*|\bi18nKey=\{?\s*)(['"`])([A-Za-z_]+(?:\.[A-Za-z0-9_]+)+)\1(?!\s*\+)/g

const sources = dir => readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
  const file = path.join(dir, entry.name)
  if(entry.isDirectory())
    return ['__tests__', '__integration__'].includes(entry.name) ? [] : sources(file)
  return /\.jsx?$/.test(entry.name) ? [file] : []
})

test('every literal key in the source is in the English catalog', () => {
  const missing = sources(SRC_DIR).flatMap(file =>
    [...readFileSync(file, 'utf8').matchAll(LITERAL_KEY)]
      .map(match => match[2])
      .filter(key => !english.has(key))
      .map(key => `${path.relative(SRC_DIR, file)}: ${key}`)
  )
  assert.deepEqual(missing, [])
})
