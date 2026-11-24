// The target repository's two reads, the repository and its versions, as the
// AutoMatch dialog follows them (OpenConceptLab/ocl_issues#3067).

// Tracks one kind of read. Only the latest begun read may apply its reply, and
// its arguments are kept so Try again can repeat it.
export const createLatestRead = () => {
  let latest = 0
  let args = null
  return {
    // Starts a read and returns whether it's still the latest one.
    begin: (...readArgs) => {
      const request = ++latest
      args = readArgs
      return () => request === latest
    },
    // Drops the read that's running, so its reply changes nothing.
    invalidate: () => {
      latest += 1
    },
    lastArgs: () => args,
  }
}

// '/orgs/CIEL/sources/CIEL/v2026/' -> 'orgs/CIEL/sources/CIEL', '' if the URL
// doesn't name a repository.
const getRepoPath = url => {
  const parts = (url || '').split('/').filter(Boolean)
  return parts.length >= 4 ? parts.slice(0, 4).join('/') : ''
}

// Whether the repository the saved rows name is the project's target, so it
// can stand in when the target's own read fails. Rows that don't hold a
// repository URL are compared by the repository's id.
export const isSameTargetRepo = (savedRepo, savedRepoURL, targetURL) => {
  const targetPath = getRepoPath(targetURL)
  if(!savedRepo?.id || !targetPath)
    return false
  const savedPath = getRepoPath(savedRepoURL)
  if(savedPath)
    return savedPath === targetPath
  return targetPath.split('/')[3] === savedRepo.id
}

// The repository a read of it gives, and that read's status. A failed read
// (raw: the error, or undefined during a 401's renewal) takes the fallback if
// there is one, else it's failed.
export const settleRepoRead = (response, fallbackRepo) => {
  const repo = response?.data?.id ? response.data : (fallbackRepo || null)
  return { repo, status: repo ? null : 'failed' }
}

// When a rate-limited reply may be tried again: the app shows the countdown,
// and Try again waits for it. 0 when the reply wasn't rate limited or gave no
// wait.
export const getRetryAt = (retryAfterSeconds, now) =>
  retryAfterSeconds > 0 ? now + retryAfterSeconds * 1000 : 0
