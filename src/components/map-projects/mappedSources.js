// A repository version's mapped-sources list, read once per page and shared by
// everyone who asks for it while the project is open: the bridge probe and the
// target version often ask for the same version (OpenConceptLab/ocl_issues#3064).

import { retryWithBackoff } from '../../services/retry.js'

export const MAPPED_SOURCES_PAGE_SIZE = 25

// A network error or a 5xx is tried again twice, after about 3 s and 12 s.
const RETRY = {maxRetries: 2, baseDelayMs: 3000}

// APIService in raw mode answers a failed request with the error itself.
const isTransientFailure = response => Boolean(response?.isAxiosError) &&
  (!response.response || response.response.status >= 500)

// Settles with the answer, after trying again while the failure is transient.
const withRetry = (request, {isCancelled, ...retry}) => retryWithBackoff(
  () => Promise.resolve(request()).then(response => {
    if(isTransientFailure(response))
      throw response
    return response
  }),
  {...retry, isCancelled, isRetryable: isTransientFailure}
).catch(() => null)

const versionURL = url => `${String(url || '').replace(/\/+$/, '')}/`

// The API's version URLs can encode a version's id twice.
const decoded = url => {
  let value = url
  for(let i = 0; i < 3; i++) {
    let next
    try {
      next = decodeURIComponent(value)
    } catch {
      break
    }
    if(next === value)
      break
    value = next
  }
  return value
}

// The API encodes a version's id in its URL, and the bridge's URL is built
// from the bare id. A repository's HEAD is listed at its own URL and at
// <repository>/HEAD/.
const versionKey = url => decoded(versionURL(url)).replace(/^(\/(?:orgs|users)\/[^/]+\/(?:sources|collections)\/[^/]+\/)HEAD\/$/, '$1')

// fetchPage(url, page) answers as APIService does in raw mode: a response with
// the page in `data` and the total in the `num_found` header, or the error. A
// page that fails isn't kept, so the next ask reads it again, and a page is
// tried again only while a read still waits for it.
//
// The reader returned, read(url, onList), gives onList the list so far after
// each page, and returns a function that stops it.
export const createMappedSourcesReader = (fetchPage, retry = RETRY) => {
  const pages = new Map()

  const readPage = (url, page, waiter) => {
    const key = `${versionKey(url)}#${page}`
    if(!pages.has(key)) {
      const waiting = new Set()
      const request = withRetry(() => fetchPage(url, page), {...retry, isCancelled: () => !waiting.size}).then(response => {
        if(!Array.isArray(response?.data))
          pages.delete(key)
        return response
      })
      pages.set(key, {request, waiting})
    }
    const {request, waiting} = pages.get(key)
    waiting.add(waiter)
    return {request: request.finally(() => waiting.delete(waiter)), stop: () => waiting.delete(waiter)}
  }

  return (url, onList) => {
    const versionUrl = versionURL(url)
    const waiter = {}
    let stopped = false
    let stopWaiting = () => {}
    const read = (page, soFar) => {
      const {request, stop} = readPage(versionUrl, page, waiter)
      stopWaiting = stop
      request.then(response => {
        if(stopped)
          return
        const data = Array.isArray(response?.data) ? response.data : []
        const list = [...soFar, ...data]
        onList(list)
        if(data.length && list.length < parseInt(response?.headers?.num_found || 0))
          read(page + 1, list)
      })
    }
    read(1, [])
    return () => {
      stopped = true
      stopWaiting()
    }
  }
}

// The Bridge Match component mounts once it has the bridge repository's mapped
// sources. A bridge algorithm with no version reads the version its repository
// resolves to in the namespace (resolveVersion answers as APIService does in
// raw mode), and a selected one keeps that version.
// Returns a function that stops the probe.
export const probeBridgeMappedSources = ({algo, selected, namespace, resolveVersion, readMappedSources, pinVersion, onSources, retry = RETRY}) => {
  const bridgeUrl = algo?.target_repo_url
  if(!algo?.id || !bridgeUrl)
    return () => {}

  let stopped = false
  let stopReading = () => {}
  const read = version => {
    stopReading = readMappedSources(bridgeUrl + version + '/', sources => onSources(bridgeUrl, sources))
  }

  if(algo.target_repo_version)
    read(algo.target_repo_version)
  else
    withRetry(() => resolveVersion(bridgeUrl, namespace), {...retry, isCancelled: () => stopped}).then(response => {
      const version = response?.data?.[0]?.result?.version
      if(stopped || !version)
        return
      if(selected)
        pinVersion(algo.id, version)
      read(version)
    })

  return () => {
    stopped = true
    stopReading()
  }
}
