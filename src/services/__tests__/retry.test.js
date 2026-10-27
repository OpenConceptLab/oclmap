import test from 'node:test'
import assert from 'node:assert/strict'

import { retryWithBackoff } from '../retry.js'

test('retryWithBackoff: cancelled during the wait, it sends nothing more', async () => {
  let cancelled = false
  let attempts = 0
  const fn = async () => {
    attempts++
    // The user leaves while the retry waits.
    setTimeout(() => { cancelled = true }, 0)
    throw new Error('connect failed')
  }

  await assert.rejects(retryWithBackoff(fn, {baseDelayMs: 5, jitterFactor: 0, isRetryable: () => true, isCancelled: () => cancelled}), /connect failed/)
  assert.equal(attempts, 1)
})

test('retryWithBackoff: retries a retryable failure', async () => {
  let attempts = 0
  const result = await retryWithBackoff(async () => {
    if(++attempts < 3)
      throw new Error('busy')
    return 'ok'
  }, {baseDelayMs: 1, jitterFactor: 0, isRetryable: () => true})

  assert.equal(result, 'ok')
  assert.equal(attempts, 3)
})
