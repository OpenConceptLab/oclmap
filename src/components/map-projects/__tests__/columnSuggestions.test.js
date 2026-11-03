/**
 * Suggested mapped fields for uploaded column headers (ocl_issues#2907).
 *
 * Run with: npm test
 */

import test from 'node:test'
import assert from 'node:assert/strict'

import { suggestColumnLabels, isCodeLikeHeader, updateColumnState, resuggestColumns, applyTemplateColumns } from '../columnSuggestions.js'

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

test('suggestColumnLabels: Name goes to the strongest header, not the first', () => {
  assert.deepEqual(
    suggestColumnLabels(['Test Date', 'Test Description', 'Test Name'], BASE),
    [null, null, 'Name']
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

// Mirrors the upload path: every column starts as an auto suggestion.
const upload = (headers, validColumns = BASE) => resuggestColumns(
  headers.map(original => ({label: original, original, dataKey: original, auto: true})),
  validColumns
)

test('suggestColumnLabels: an exact match keeps its field, even when a pattern column comes first', () => {
  assert.deepEqual(suggestColumnLabels(['Test Name', 'Name'], BASE), [null, null])
})

test('suggestColumnLabels: exact matches reserve their fields in mixed headers', () => {
  assert.deepEqual(
    suggestColumnLabels(['Name', 'Test Name', 'Synonyms', 'Alternate synonym'], BASE),
    [null, null, null, null]
  )
})

test('suggestColumnLabels: labels the user already chose are reserved', () => {
  assert.deepEqual(suggestColumnLabels(['Test Name'], BASE, ['Name']), [null])
})

test('upload: an exact Name column and a Test Name column do not both map to Name', () => {
  const labels = upload(['Test Name', 'Name', 'Specimen'], LOINC).map(col => col.label)
  assert.deepEqual(labels, ['Test Name', 'Name', 'Property: SYSTEM'])
})

test('upload: a suggestion still applies when nothing collides', () => {
  const labels = upload(['Test Name', 'Synonym'], BASE).map(col => col.label)
  assert.deepEqual(labels, ['Name', 'Synonyms'])
})

test('regression: a manual Name choice is not duplicated when the target reloads', () => {
  let cols = upload(['Notes', 'Test Name'], LOINC)
  cols = updateColumnState(cols, 0, 'Name')
  const afterLoad = resuggestColumns(cols, LOINC)
  assert.deepEqual(afterLoad.map(col => col.label), ['Name', 'Test Name'])
  assert.equal(afterLoad[1].suggested, false)
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

test('resuggestColumns: a cleared column does not hold the field it would have been suggested', () => {
  let cols = upload(['Specimen', 'Sample'])
  cols = updateColumnState(cols, 0, '')
  assert.deepEqual(resuggestColumns(cols, LOINC).map(col => col.label), ['', 'Property: SYSTEM'])
})

test('resuggestColumns: a manual choice takes its field back from a suggestion', () => {
  let cols = upload(['Notes', 'Test Name'])
  assert.equal(cols[1].label, 'Name')
  cols = resuggestColumns(updateColumnState(cols, 0, 'Name'), BASE)
  assert.deepEqual(cols.map(col => col.label), ['Name', 'Test Name'])
})

test('applyTemplateColumns carries over the copied project mapping by sheet header', () => {
  const uploaded = [
    {label: 'LOINC', dataKey: 'LOINC', original: 'LOINC', auto: true},
    {label: 'Component', dataKey: 'Component', original: 'Component', auto: true},
    {label: 'Extra', dataKey: 'Extra', original: 'Extra', auto: true},
  ]
  const template = [
    {label: 'ID', dataKey: 'LOINC', original: 'LOINC'},
    {label: 'Name', dataKey: 'Component', original: 'Component', hidden: true},
    {label: 'Extra', dataKey: 'Extra', original: 'Extra', unmapped: true},
  ]
  const result = applyTemplateColumns(uploaded, template)
  assert.deepEqual(result.map(col => col.label), ['ID', 'Name', 'Extra'])
  assert.ok(result.every(col => col.auto === false))
  assert.equal(result[2].unmapped, true)
  assert.equal(result[1].hidden, undefined)
})

test('applyTemplateColumns leaves unmatched columns as suggestions and ignores an empty template', () => {
  const uploaded = [{label: 'Other', dataKey: 'Other', original: 'Other', auto: true}]
  assert.equal(applyTemplateColumns(uploaded, []), uploaded)
  assert.deepEqual(applyTemplateColumns(uploaded, [{label: 'Name', original: 'Component'}]), uploaded)
})
