/**
 * Tests for withExtraColumns (tableColumns.js), which TableResults uses to add
 * a caller's columns to a resource's base columns.
 *
 * Run with: npm test
 */

import test from 'node:test'
import assert from 'node:assert/strict'

import { withExtraColumns } from '../tableColumns.js'

const BASE = [
  { id: 'id', value: 'id', permanent: true },
  { id: 'name', value: 'display_name', permanent: true, renderer: () => 'base' },
  { id: 'datatype', value: 'datatype' }
]

test('withExtraColumns: appends extra columns after the base ones', () => {
  const mappings = { id: 'mappings', renderer: () => 'map' }
  assert.deepEqual(withExtraColumns(BASE, [mappings]).map(column => column.id), ['id', 'name', 'datatype', 'mappings'])
})

test("withExtraColumns: an extra column with a base column's id replaces it in place (OpenConceptLab/ocl_issues#2909)", () => {
  const name = { id: 'name', renderer: () => 'localized' }
  const columns = withExtraColumns(BASE, [name, { id: 'mappings' }])
  assert.deepEqual(columns.map(column => column.id), ['id', 'name', 'datatype', 'mappings'])
  assert.equal(columns[1].renderer(), 'localized')
  assert.equal(columns[1].value, 'display_name')
  assert.equal(columns[1].permanent, true)
  assert.equal(BASE[1].renderer(), 'base')
})

test('withExtraColumns: no extra columns leaves the base ones', () => {
  assert.deepEqual(withExtraColumns(BASE, undefined), BASE)
  assert.deepEqual(withExtraColumns(BASE, []), BASE)
})
