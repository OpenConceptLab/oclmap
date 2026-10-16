/**
 * Suggested mapped fields for uploaded column headers (ocl_issues#2907).
 *
 * Run with: npm test
 */

import test from 'node:test'
import assert from 'node:assert/strict'

import { suggestColumnLabels, isCodeLikeHeader } from '../columnSuggestions.js'

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
