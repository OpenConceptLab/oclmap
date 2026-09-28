// Retry helpers for API calls. Dependency-free so node's test runner can load
// them; APIService re-exports both.

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

export const isTransientNetworkError = err => {
  if (!err?.isAxiosError) return false;
  if (!err.response) return true;
  return ['ECONNABORTED', 'ETIMEDOUT', 'ENETUNREACH'].includes(err.code);
};

export const retryWithBackoff = async (fn, { maxRetries = 2, baseDelayMs = 3000, backoffFactor = 4, jitterFactor = 0.25, isCancelled = () => false, isRetryable = () => false, onAttemptFailed = null } = {}) => {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn(attempt);
    } catch (err) {
      onAttemptFailed?.(err, attempt);
      if (attempt >= maxRetries || !isRetryable(err) || isCancelled()) throw err;
      const base = baseDelayMs * Math.pow(backoffFactor, attempt);
      const delay = base * (1 - jitterFactor + Math.random() * jitterFactor * 2);
      await sleep(delay);
    }
  }
};
