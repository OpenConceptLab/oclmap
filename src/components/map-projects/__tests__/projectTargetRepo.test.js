import test from 'node:test'
import assert from 'node:assert/strict'

import {
  getDefaultTargetRepoVersion,
  getProjectTargetRepoVersion,
  getTargetRepoVersionFromUrl,
  getTargetRepoVersionId,
  hasSelectedTargetRepoVersion
} from '../projectTargetRepo.js'

test('getTargetRepoVersionId prefers the selected version id', () => {
  assert.equal(getTargetRepoVersionId({ id: '2.81', version_url: '/orgs/OCL/sources/Test/2.81/' }), '2.81')
})

test('getProjectTargetRepoVersion reads the pinned version from target_repo_url', () => {
  assert.equal(
    getProjectTargetRepoVersion({ target_repo_url: '/orgs/Regenstrief/sources/LOINC/2.81/' }),
    '2.81'
  )
})

test('getTargetRepoVersionFromUrl keeps versionless repo URLs blank', () => {
  assert.equal(getTargetRepoVersionFromUrl('/orgs/Regenstrief/sources/LOINC/'), '')
})

test('getProjectTargetRepoVersion falls back to persisted target_repo.source_version', () => {
  assert.equal(
    getProjectTargetRepoVersion({
      target_repo_url: '/orgs/Regenstrief/sources/LOINC/',
      target_repo: { source_version: '2.71.21AA' }
    }),
    '2.71.21AA'
  )
})

test('getProjectTargetRepoVersion returns empty when the project has no pinned version', () => {
  assert.equal(
    getProjectTargetRepoVersion({ target_repo_url: '/orgs/Regenstrief/sources/LOINC/' }),
    ''
  )
})

test('getDefaultTargetRepoVersion selects the only version transparently', () => {
  const onlyVersion = { id: '2.81', released: false }
  assert.deepEqual(getDefaultTargetRepoVersion([onlyVersion]), onlyVersion)
})

test('getDefaultTargetRepoVersion prefers the only released version', () => {
  const releasedVersion = { id: '2.81', released: true }
  assert.deepEqual(
    getDefaultTargetRepoVersion([
      { id: 'HEAD', released: false },
      releasedVersion
    ]),
    releasedVersion
  )
})

test('getDefaultTargetRepoVersion stays unset when multiple choices remain', () => {
  assert.equal(
    getDefaultTargetRepoVersion([
      { id: 'HEAD', released: false },
      { id: '2.81', released: false }
    ]),
    false
  )
})

test('hasSelectedTargetRepoVersion treats blank selections as invalid', () => {
  assert.equal(hasSelectedTargetRepoVersion(false), false)
  assert.equal(hasSelectedTargetRepoVersion({ id: 'HEAD' }), true)
})
