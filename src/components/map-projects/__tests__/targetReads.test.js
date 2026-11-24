/**
 * The target repository's reads, as the AutoMatch dialog follows them
 * (OpenConceptLab/ocl_issues#3067): only the latest read applies, Try again
 * repeats the last one, the saved rows' repository stands in only for the
 * project's own target, and a rate-limited read waits out its countdown.
 */

import test from 'node:test'
import assert from 'node:assert/strict'

import { createLatestRead, getRetryAt, isSameTargetRepo, settleRepoRead } from '../targetReads.js'

test('createLatestRead: only the latest read applies', () => {
  const read = createLatestRead()
  const first = read.begin('/orgs/A/sources/A/')
  const second = read.begin('/orgs/B/sources/B/')
  assert.equal(first(), false)
  assert.equal(second(), true)
})

test('createLatestRead: invalidate drops the running read', () => {
  const read = createLatestRead()
  const running = read.begin('/orgs/A/sources/A/')
  read.invalidate()
  assert.equal(running(), false)
})

test('createLatestRead: keeps the last read\'s arguments for Try again', () => {
  const read = createLatestRead()
  assert.equal(read.lastArgs(), null)
  read.begin('/orgs/A/sources/A/', 'v1')
  read.begin('/orgs/B/sources/B/', undefined)
  assert.deepEqual(read.lastArgs(), ['/orgs/B/sources/B/', undefined])
  // Invalidating keeps them: Try again repeats what was asked for.
  read.invalidate()
  assert.deepEqual(read.lastArgs(), ['/orgs/B/sources/B/', undefined])
})

const CIEL = { id: 'CIEL', version: '', url: undefined }

test('isSameTargetRepo: compares the row\'s repository URL, any version', () => {
  assert.equal(isSameTargetRepo(CIEL, '/orgs/CIEL/sources/CIEL/v2026-09-24/', '/orgs/CIEL/sources/CIEL/'), true)
  assert.equal(isSameTargetRepo(CIEL, '/orgs/CIEL/sources/CIEL/', '/orgs/CIEL/sources/CIEL/v2026-09-24/'), true)
  // The target changed since the rows were mapped.
  assert.equal(isSameTargetRepo(CIEL, '/orgs/CIEL/sources/CIEL/v1/', '/orgs/Regenstrief/sources/LOINC/'), false)
  // Same id, other owner.
  assert.equal(isSameTargetRepo(CIEL, '/orgs/Other/sources/CIEL/', '/orgs/CIEL/sources/CIEL/'), false)
})

test('isSameTargetRepo: rows without a repository URL compare its id', () => {
  assert.equal(isSameTargetRepo(CIEL, '', '/orgs/CIEL/sources/CIEL/'), true)
  assert.equal(isSameTargetRepo(CIEL, undefined, '/orgs/Regenstrief/sources/LOINC/'), false)
})

test('isSameTargetRepo: nothing to stand in', () => {
  assert.equal(isSameTargetRepo(null, '/orgs/CIEL/sources/CIEL/', '/orgs/CIEL/sources/CIEL/'), false)
  assert.equal(isSameTargetRepo(CIEL, '/orgs/CIEL/sources/CIEL/', ''), false)
})

test('settleRepoRead: a reply with the repository loads it', () => {
  const repo = { id: 'CIEL', url: '/orgs/CIEL/sources/CIEL/' }
  assert.deepEqual(settleRepoRead({ data: repo }, CIEL), { repo, status: null })
})

test('settleRepoRead: a failed read takes the fallback, else fails', () => {
  const rateLimited = { message: 'Request failed with status code 429', response: { status: 429, data: {} } }
  assert.deepEqual(settleRepoRead(rateLimited, CIEL), { repo: CIEL, status: null })
  assert.deepEqual(settleRepoRead(rateLimited, null), { repo: null, status: 'failed' })
  // A 401 resolves with undefined while the session renews.
  assert.deepEqual(settleRepoRead(undefined, undefined), { repo: null, status: 'failed' })
})

test('getRetryAt: waits out the countdown, or not at all', () => {
  assert.equal(getRetryAt(30, 1000), 31000)
  assert.equal(getRetryAt(0, 1000), 0)
  assert.equal(getRetryAt(undefined, 1000), 0)
})
