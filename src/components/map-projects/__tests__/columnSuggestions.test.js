/**
 * Suggested mapped fields for uploaded column headers (ocl_issues#2907).
 *
 * Run with: npm test
 */

import test from 'node:test'
import assert from 'node:assert/strict'

import { suggestColumnLabels, isCodeLikeHeader, updateColumnState, resuggestColumns } from '../columnSuggestions.js'

const BASE = [
  {label: 'ID'},
  {label: 'Name'},
  {label: 'Synonyms'},
  {label: 'Description'},
  {label: 'Mapping: Code'},
  {label: 'Mapping: List'},
  {label: 'Property: Class'},
  {label: 'Property: Datatype'},
]
const LOINC = [...BASE, {label: 'Property: SYSTEM'}]

test('suggestColumnLabels: term, test and description headers suggest Name, once', () => {
  assert.deepEqual(
    suggestColumnLabels(['Test Name', 'Term', 'Lab test', 'Test description'], BASE),
    ['Name', null, null, null]
  )
})

test('suggestColumnLabels: exact matches are left alone', () => {
  assert.deepEqual(suggestColumnLabels(['Name', 'Description'], BASE), [null, null])
})

test('suggestColumnLabels: synonym headers suggest Synonyms', () => {
  assert.deepEqual(suggestColumnLabels(['Alternate synonym'], BASE), ['Synonyms'])
})

test('suggestColumnLabels: specimen, system and sample suggest Property: SYSTEM when the target has it', () => {
  assert.deepEqual(
    suggestColumnLabels(['Specimen', 'System', 'Sample type'], LOINC),
    ['Property: SYSTEM', null, null]
  )
})

test('suggestColumnLabels: no Property: SYSTEM suggestion when the target lacks it', () => {
  assert.deepEqual(suggestColumnLabels(['Specimen'], BASE), [null])
})

test('suggestColumnLabels: class headers are left alone, since they are already recognised', () => {
  assert.deepEqual(suggestColumnLabels(['Class', 'Lab class'], BASE), [null, null])
})

test('suggestColumnLabels: code-like headers stay unmapped', () => {
  assert.deepEqual(
    suggestColumnLabels(['Local Code', 'Sample ID', 'external_id', 'UUID'], LOINC),
    [null, null, null, null]
  )
})

test('suggestColumnLabels: unrelated headers get no suggestion', () => {
  assert.deepEqual(suggestColumnLabels(['Notes', 'Units'], LOINC), [null, null])
})

test('isCodeLikeHeader: matches code-like words as whole tokens', () => {
  assert.equal(isCodeLikeHeader('Local Code'), true)
  assert.equal(isCodeLikeHeader('ID'), true)
  assert.equal(isCodeLikeHeader('Identity'), false)
  assert.equal(isCodeLikeHeader('Test Name'), false)
})

const upload = headers => headers.map(original => {
  const [suggested] = suggestColumnLabels([original], BASE)
  return {label: suggested || original, original, dataKey: original, suggested: Boolean(suggested), auto: true}
})

test('updateColumnState: keeps columns an array after a user edit', () => {
  const cols = updateColumnState(upload(['Code', 'Name']), 0, 'Name')
  assert.ok(Array.isArray(cols))
  assert.equal(cols[0].label, 'Name')
  assert.equal(cols[0].auto, false)
})

test('regression: editing a column, then the target loads, does not throw and keeps the edit', () => {
  let cols = upload(['Specimen', 'Code'])
  cols = updateColumnState(cols, 1, '')
  assert.equal(cols[1].unmapped, true)
  const afterLoad = resuggestColumns(cols, LOINC)
  assert.ok(Array.isArray(afterLoad))
  assert.equal(afterLoad[0].label, 'Property: SYSTEM')
  assert.equal(afterLoad[0].suggested, true)
  assert.equal(afterLoad[1].label, '')
  assert.equal(afterLoad[1].unmapped, true)
})

test('resuggestColumns: a manual choice is not overwritten when the target changes', () => {
  let cols = upload(['Specimen'])
  cols = updateColumnState(cols, 0, 'Name')
  assert.equal(resuggestColumns(cols, LOINC)[0].label, 'Name')
})

test('resuggestColumns: suggests Property: SYSTEM once the target loads it', () => {
  const cols = upload(['Specimen'])
  assert.equal(resuggestColumns(cols, BASE)[0].label, 'Specimen')
  assert.equal(resuggestColumns(cols, LOINC)[0].label, 'Property: SYSTEM')
})
