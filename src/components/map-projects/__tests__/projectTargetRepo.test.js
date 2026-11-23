import test from 'node:test'
import assert from 'node:assert/strict'

import {
  getDeclaredLocales,
  getDefaultBridgeRepoVersion,
  getDefaultTargetRepoVersion,
  getLatestReleasedBridgeVersion,
  getLatestReleasedTargetRepoVersion,
  getProjectTargetRepoVersion,
  getSavedTargetRepoVersion,
  getTargetRepoVersionBadges,
  getTargetRepoVersionFromUrl,
  getTargetRepoVersionId,
  getTargetReadStatus,
  getTargetRepoState,
  getTargetRepoVersionReleaseDate,
  getVersionsFromResponse,
  hasSelectedTargetRepoVersion,
  needsSemanticSearchWarning
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

test('getDeclaredLocales reads the version default and supported locales', () => {
  assert.deepEqual(
    getDeclaredLocales({ default_locale: 'en', supported_locales: ['en', 'es', 'fr'] }),
    ['en', 'es', 'fr']
  )
  assert.deepEqual(getDeclaredLocales({ default_locale: 'en', supported_locales: ['en'] }), ['en'])
  assert.deepEqual(getDeclaredLocales({ default_locale: 'en' }), ['en'])
  assert.deepEqual(getDeclaredLocales({}), [])
  assert.deepEqual(getDeclaredLocales(null), [])
})

// ICD-11's HEAD isn't vectorized for Semantic Search; LOINC 2.81 is.
const ICD11_HEAD = { id: 'HEAD', version_url: '/orgs/WHO/sources/ICD-11-WHO/', match_algorithms: ['es'] }
const LOINC_281 = { id: '2.81', version_url: '/orgs/Regenstrief/sources/LOINC/2.81/', match_algorithms: ['es', 'llm'] }
const SEMANTIC_ALGO = { id: 'ocl-semantic', type: 'ocl-semantic', provider: 'ocl' }

test('needsSemanticSearchWarning stays quiet when no selected algorithm uses Semantic Search', () => {
  const algosSelected = [
    { id: 'ocl-ciel-bridge', type: 'ocl-ciel-bridge', provider: 'ocl' },
    { id: 'icd11-lexical', type: 'custom', provider: 'external', url: 'https://match.example.org/icd11/' },
    { id: 'ocl-search', type: 'ocl-search', provider: 'ocl' }
  ]
  assert.equal(needsSemanticSearchWarning(ICD11_HEAD, algosSelected), false)
  assert.equal(needsSemanticSearchWarning(ICD11_HEAD, []), false)
  assert.equal(needsSemanticSearchWarning(ICD11_HEAD, undefined), false)
})

test('needsSemanticSearchWarning warns when the OCL Semantic Algorithm is selected on a version without it', () => {
  assert.equal(needsSemanticSearchWarning(ICD11_HEAD, [SEMANTIC_ALGO]), true)
})

test('needsSemanticSearchWarning stays quiet on a version that runs Semantic Search', () => {
  assert.equal(needsSemanticSearchWarning(LOINC_281, [SEMANTIC_ALGO]), false)
})

test('needsSemanticSearchWarning waits for a version to be chosen', () => {
  assert.equal(needsSemanticSearchWarning(false, [SEMANTIC_ALGO]), false)
})

// OpenConceptLab/ocl_issues#3067: the AutoMatch dialog shows the target
// repository loading, loaded or failed.
test('getVersionsFromResponse reads the list from a reply', () => {
  assert.deepEqual(getVersionsFromResponse({ data: LOINC_VERSIONS }), LOINC_VERSIONS)
  assert.deepEqual(getVersionsFromResponse({ data: [] }), [])
})

test('getVersionsFromResponse gives null for a failed read', () => {
  // APIService resolves a failed read with the error's body or message.
  assert.equal(getVersionsFromResponse('<html>Service Unavailable</html>'), null)
  assert.equal(getVersionsFromResponse({ detail: 'Not found.' }), null)
  assert.equal(getVersionsFromResponse('Network Error'), null)
  // A 401 resolves with undefined while the session renews.
  assert.equal(getVersionsFromResponse(undefined), null)
  // A raw read resolves with the error itself, a 429 among them.
  assert.equal(getVersionsFromResponse({ message: 'Request failed with status code 429', response: { status: 429, data: {} } }), null)
})

test('getTargetReadStatus: loading while either read runs, failed if either failed', () => {
  assert.equal(getTargetReadStatus(null, 'loading'), 'loading')
  assert.equal(getTargetReadStatus('failed', 'loading'), 'loading')
  assert.equal(getTargetReadStatus('failed', null), 'failed')
  assert.equal(getTargetReadStatus(null, 'failed'), 'failed')
  assert.equal(getTargetReadStatus(null, null), null)
})

const LOINC_281_URL = { ...LOINC_VERSIONS[0], version_url: '/orgs/Regenstrief/sources/LOINC/2.81/' }

test('getTargetRepoState: loading while the versions are read', () => {
  assert.equal(getTargetRepoState(false, 'loading'), 'loading')
  // A version still set from before the read waits for the new one.
  assert.equal(getTargetRepoState(LOINC_281_URL, 'loading'), 'loading')
})

test('getTargetRepoState: loaded once a version is chosen', () => {
  assert.equal(getTargetRepoState(LOINC_281_URL, null), 'loaded')
})

test('getTargetRepoState: failed when the versions read failed', () => {
  assert.equal(getTargetRepoState(false, 'failed'), 'failed')
})

test('getTargetRepoState: none chosen and nothing loading', () => {
  assert.equal(getTargetRepoState(false, null), null)
  assert.equal(getTargetRepoState({ id: '2.81' }, null), null)
})
