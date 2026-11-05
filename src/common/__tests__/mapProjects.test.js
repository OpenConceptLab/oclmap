import test from 'node:test'
import assert from 'node:assert/strict'

const { projectCount } = await import('../mapProjects.js')

test('projectCount sums num_found across user and organization lists', () => {
  assert.equal(projectCount({headers: {num_found: '4'}}, {headers: {num_found: '3'}}), 7)
  assert.equal(projectCount({headers: {}}, undefined), 0)
})
