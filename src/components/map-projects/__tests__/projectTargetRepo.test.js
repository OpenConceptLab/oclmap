import test from 'node:test'
import assert from 'node:assert/strict'

import {
  getDefaultBridgeRepoVersion,
  getDefaultTargetRepoVersion,
  getLatestReleasedBridgeVersion,
  getLatestReleasedTargetRepoVersion,
  getProjectTargetRepoVersion,
  getSavedTargetRepoVersion,
  getTargetRepoVersionBadges,
  getTargetRepoVersionFromUrl,
  getTargetRepoVersionId,
  getTargetRepoVersionReleaseDate,
  hasSelectedTargetRepoVersion
} from '../projectTargetRepo.js'

// LOINC's versions as the API lists them, newest first: only 2.81 supports
// the OCL Semantic Algorithm.
const LOINC_VERSIONS = [
  { id: '2.81', released: true, match_algorithms: ['es', 'llm'], revision_date: '2025-08-12T00:00:00Z', created_on: '2025-09-01T10:00:00Z' },
  { id: '2.71.21AA', released: true, match_algorithms: ['es'], created_on: '2021-11-03T10:00:00Z' },
  { id: '2.70.21AA', released: true, match_algorithms: ['es'], created_on: '2021-06-30T10:00:00Z' },
  { id: 'HEAD', released: false, match_algorithms: ['es'], created_on: '2021-01-15T10:00:00Z' }
]

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

test('getDefaultTargetRepoVersion skips a newer release without semantic search', () => {
  const versions = [
    { id: '2.82', released: true, match_algorithms: ['es'] },
    { id: '2.81', released: true, match_algorithms: ['es', 'llm'] },
    { id: 'HEAD', released: false, match_algorithms: ['es', 'llm'] }
  ]
  assert.equal(getDefaultTargetRepoVersion(versions), versions[1])
})

test('getDefaultTargetRepoVersion falls back to the latest release', () => {
  const versions = [
    { id: 'HEAD', released: false, match_algorithms: ['llm'] },
    { id: '2.81', released: false, match_algorithms: ['llm'] },
    { id: '2.80', released: true, match_algorithms: ['es'] },
    { id: '2.79', released: true, match_algorithms: null }
  ]
  assert.equal(getDefaultTargetRepoVersion(versions), versions[2])
})

test('getDefaultTargetRepoVersion falls back to HEAD when nothing is released', () => {
  const versions = [
    { id: '2.81', released: false, match_algorithms: ['llm'] },
    { id: 'HEAD', released: false }
  ]
  assert.equal(getDefaultTargetRepoVersion(versions), versions[1])
})

test('getDefaultTargetRepoVersion stays unset without a release or HEAD', () => {
  assert.equal(getDefaultTargetRepoVersion([]), false)
  assert.equal(getDefaultTargetRepoVersion(undefined), false)
  assert.equal(getDefaultTargetRepoVersion({ detail: 'Not found.' }), false)
  assert.equal(getDefaultTargetRepoVersion([{ id: '2.81', released: false }]), false)
})

test('getSavedTargetRepoVersion keeps the saved version over a newer default', () => {
  assert.equal(getSavedTargetRepoVersion(LOINC_VERSIONS, '2.70.21AA'), LOINC_VERSIONS[2])
})

test('getSavedTargetRepoVersion reads a blank saved version as HEAD', () => {
  // HEAD's version_url carries no version, so a project saved on HEAD
  // stores a target_repo_url without one.
  assert.equal(getSavedTargetRepoVersion(LOINC_VERSIONS, ''), LOINC_VERSIONS[3])
})

test('getSavedTargetRepoVersion stays unset when the saved version is gone', () => {
  assert.equal(getSavedTargetRepoVersion(LOINC_VERSIONS, '2.69'), false)
  assert.equal(getSavedTargetRepoVersion(undefined, '2.81'), false)
})

test('getLatestReleasedTargetRepoVersion is null without a versions list', () => {
  assert.equal(getLatestReleasedTargetRepoVersion(undefined), null)
})

test('getTargetRepoVersionBadges marks the latest release and semantic search', () => {
  assert.deepEqual(
    LOINC_VERSIONS.map(version => getTargetRepoVersionBadges(version, LOINC_VERSIONS)),
    [['common.latest', 'map_project.semantic_search'], [], [], []]
  )
})

test('getTargetRepoVersionBadges marks no version latest when nothing is released', () => {
  const versions = [
    { id: '2.81', released: false },
    { id: 'HEAD', released: false, match_algorithms: ['llm'] }
  ]
  assert.deepEqual(
    versions.map(version => getTargetRepoVersionBadges(version, versions)),
    [[], ['map_project.semantic_search']]
  )
})

test('getTargetRepoVersionReleaseDate dates a release by when OCL created it', () => {
  // Not revision_date: OCL copies it from HEAD into each new version.
  assert.equal(getTargetRepoVersionReleaseDate(LOINC_VERSIONS[0]), '2025-09-01T10:00:00Z')
  assert.equal(getTargetRepoVersionReleaseDate(LOINC_VERSIONS[1]), '2021-11-03T10:00:00Z')
})

test('getTargetRepoVersionReleaseDate leaves HEAD and unreleased versions undated', () => {
  assert.equal(getTargetRepoVersionReleaseDate(LOINC_VERSIONS[3]), null)
  assert.equal(getTargetRepoVersionReleaseDate({ id: '2.81', released: false, created_on: '2025-09-01T10:00:00Z' }), null)
})

test('hasSelectedTargetRepoVersion treats blank selections as invalid', () => {
  assert.equal(hasSelectedTargetRepoVersion(false), false)
  assert.equal(hasSelectedTargetRepoVersion({ id: 'HEAD' }), true)
})

test('getDefaultBridgeRepoVersion prefers the latest released llm version', () => {
  const versions = [
    { id: 'HEAD', released: false, match_algorithms: ['llm'] },
    { id: '2.81', released: true, match_algorithms: ['exact', 'llm'] },
    { id: '2.80', released: true, match_algorithms: ['llm'] }
  ]

  assert.deepEqual(getDefaultBridgeRepoVersion(versions), versions[1])
})

test('getDefaultBridgeRepoVersion falls back to the latest llm-enabled version when no release matches', () => {
  const versions = [
    { id: 'HEAD', released: false, match_algorithms: ['llm'] },
    { id: '2.81', released: true, match_algorithms: ['exact'] },
    { id: '2.80', released: false, match_algorithms: ['llm'] }
  ]

  assert.deepEqual(getDefaultBridgeRepoVersion(versions), versions[0])
})

test('getDefaultBridgeRepoVersion stays unset when no version supports llm', () => {
  assert.equal(
    getDefaultBridgeRepoVersion([
      { id: 'HEAD', released: false, match_algorithms: ['exact'] },
      { id: '2.81', released: true, match_algorithms: ['fts'] }
    ]),
    false
  )
})

test('getDefaultBridgeRepoVersion ignores missing algorithm metadata', () => {
  assert.equal(
    getDefaultBridgeRepoVersion([
      { id: 'HEAD', released: false },
      { id: '2.81', released: true, match_algorithms: null }
    ]),
    false
  )
})

test('getLatestReleasedBridgeVersion prefers the first explicitly released version', () => {
  const versions = [
    { id: 'HEAD', released: false },
    { id: '2.81', released: true },
    { id: '2.80', released: true }
  ]

  assert.deepEqual(getLatestReleasedBridgeVersion(versions), versions[1])
})

test('getLatestReleasedBridgeVersion falls back to the first non-HEAD version', () => {
  const versions = [
    { id: 'HEAD', released: false },
    { id: '2.81', released: false },
    { id: '2.80', released: false }
  ]

  assert.deepEqual(getLatestReleasedBridgeVersion(versions), versions[1])
})

test('getLatestReleasedBridgeVersion stays null when every option is HEAD-like', () => {
  assert.equal(
    getLatestReleasedBridgeVersion([
      { id: 'HEAD', released: false },
      { released: false }
    ]),
    null
  )
})
