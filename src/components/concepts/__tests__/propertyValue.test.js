import test from 'node:test'
import assert from 'node:assert/strict'

import { getPropertyLabel, getPropertyValue, getPropertyValueKey } from '../propertyValue.js'

test('getPropertyValue reads the value in API key order', () => {
  assert.equal(getPropertyValue({code: 'concept_class', valueString: 'Procedure', display: 'Class'}), 'Procedure')
})

test('getPropertyValue reads the value after jsonb puts display first', () => {
  assert.equal(getPropertyValue({code: 'concept_class', display: 'Class', valueString: 'Procedure'}), 'Procedure')
  assert.equal(getPropertyValue({code: 'datatype', display: 'Datatype', valueString: 'N/A'}), 'N/A')
})

test('getPropertyValue reads any typed value key and plain value', () => {
  assert.equal(getPropertyValue({code: 'SCALE_TYP', display: 'Scale', valueCode: 'Qn'}), 'Qn')
  assert.equal(getPropertyValue({code: 'x', display: 'X', valueBoolean: false}), false)
  assert.equal(getPropertyValue({code: 'x', display: 'X', value: 3}), 3)
})

test('getPropertyValue keeps a null value instead of falling back to display', () => {
  assert.equal(getPropertyValueKey({code: 'datatype', display: 'Datatype', valueString: null}), 'valueString')
  assert.equal(getPropertyValue({code: 'datatype', display: 'Datatype', valueString: null}), null)
})

test('getPropertyValue falls back to the first non-code, non-display key', () => {
  assert.equal(getPropertyValue({code: 'COMPONENT', display: 'Component', COMPONENT: 'Glucose'}), 'Glucose')
  assert.equal(getPropertyValue({code: 'x', display: 'X'}), undefined)
  assert.equal(getPropertyValue(undefined), undefined)
})

test('getPropertyLabel prefers display over code', () => {
  assert.equal(getPropertyLabel({code: 'SCALE_TYP', display: 'Scale'}), 'Scale')
  assert.equal(getPropertyLabel({code: 'SCALE_TYP'}), 'SCALE_TYP')
})

test('getPropertyLabel uses the fallback only when there is no display', () => {
  assert.equal(getPropertyLabel({code: 'concept_class', display: 'Class'}, 'Concept Class'), 'Class')
  assert.equal(getPropertyLabel({code: 'concept_class'}, 'Concept Class'), 'Concept Class')
  assert.equal(getPropertyLabel({code: 'concept_class'}, undefined), 'concept_class')
})
