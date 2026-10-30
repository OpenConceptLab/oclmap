/**
 * The header search offers the open project's rows and all of OCL
 * (OpenConceptLab/ocl_online#418).
 */

import test from 'node:test'
import assert from 'node:assert/strict'

import { headerSearchOptions, oclSearchURL } from '../headerSearchOptions.js'

test('the header search offers the project rows first, then all of OCL', () => {
  assert.deepEqual(headerSearchOptions({canSearchRows: true, canSearchOCL: true}), ['rows', 'ocl'])
  assert.deepEqual(headerSearchOptions({canSearchRows: true, canSearchOCL: false}), ['rows'])
  assert.deepEqual(headerSearchOptions({canSearchRows: false, canSearchOCL: true}), ['ocl'])
  assert.deepEqual(headerSearchOptions({canSearchRows: false, canSearchOCL: false}), [])
})

test('searching all of OCL opens TBv3 concept search', () => {
  assert.equal(oclSearchURL('https://app.v3.openconceptlab.org', ' malaria fever '), 'https://app.v3.openconceptlab.org/search/?q=malaria%20fever&type=concepts')
  assert.equal(oclSearchURL('http://localhost:4002', 'a&b'), 'http://localhost:4002/search/?q=a%26b&type=concepts')
  assert.equal(oclSearchURL('http://localhost:4002', ''), 'http://localhost:4002/search/?type=concepts')
})
