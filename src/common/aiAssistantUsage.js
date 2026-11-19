// The OCL AI Assistant's usage as the service reports it: the unit it counts in
// and how many it has counted, never a limit (OpenConceptLab/ocl_online#641).
export const toAIAssistantUsage = data =>
  typeof data?.meter === 'string' && Number.isFinite(data?.used) ? {meter: data.meter, used: data.used} : null

// The units whose report gets a chip of its own where the Mapper shows no
// Preview chip (OpenConceptLab/ocl_online#641).
export const USAGE_CHIP_METERS = ['calls', 'tokens']

export const getUsageChipReport = usage => usage && USAGE_CHIP_METERS.includes(usage.meter) ? usage : null

// Each person's last report, under their own key.
const storageKey = username => `ai_assistant_usage:${username}`

// What's kept for this person now, to tell whether it changed: undefined if
// the storage can't be read.
const read = (storage, username) => {
  try {
    return storage.getItem(storageKey(username))
  } catch(_) {
    return undefined
  }
}

// A full or blocked storage only costs the chip its report.
const store = (storage, username, usage) => {
  try {
    if(usage)
      storage.setItem(storageKey(username), JSON.stringify(usage))
    else
      storage.removeItem(storageKey(username))
  } catch(_) {
    // nothing to keep
  }
}

// The last report kept for this person. Without one, the chip keeps its call line.
export const getAIAssistantUsage = (storage, username) => {
  if(!username)
    return null
  try {
    return toAIAssistantUsage(JSON.parse(storage.getItem(storageKey(username))))
  } catch(_) {
    return null
  }
}

// Keeps the report a reply carries in `metadata.usage` (an $invoke reply) for
// the person who sent the request. Returns whether it kept one.
export const keepAIAssistantUsage = (storage, username, reply) => {
  const usage = toAIAssistantUsage(reply?.metadata?.usage)
  if(!usage || !username)
    return false
  store(storage, username, usage)
  return true
}

// The reply without `metadata.usage`, for what a project stores: the report is
// a running count for whoever sent the request, not part of the project's work.
export const withoutAIAssistantUsage = reply => {
  if(!reply?.metadata || !Object.prototype.hasOwnProperty.call(reply.metadata, 'usage'))
    return reply
  const metadata = {...reply.metadata}
  delete metadata.usage
  return {...reply, metadata}
}

// Asks for the report with `get` (axios.get, not APIService, so a refused or
// throttled request skips its sign-out and throttling handling). A report
// without a unit and a count clears the kept one. A failed request keeps it,
// and so does one that's overtaken: something else (a reply's report, in this
// tab or another) kept a report while it was in flight. Resolves to whether
// the kept report changed.
const fetchAIAssistantUsage = ({get, storage, baseURL, token, username}) => {
  const url = `${baseURL.replace(/\/+$/, '')}/match/usage/`
  const keptBefore = read(storage, username)
  return get(url, {headers: {Authorization: `Token ${token}`}, timeout: 10000})
    .then(response => {
      if(read(storage, username) !== keptBefore)
        return false
      store(storage, username, toAIAssistantUsage(response?.data))
      return true
    })
    .catch(() => false)
}

// One refresh at a time per person: a request made while one is in flight
// waits for it, then all such requests share one more, so a refresh never
// overtakes another and discards its newer count.
const refreshing = new Map()

export const refreshAIAssistantUsage = request => {
  const { baseURL, token, username } = request
  if(!baseURL || !token || !username)
    return Promise.resolve(false)
  const running = refreshing.get(username)
  if(running) {
    running.next = running.next || running.promise.then(() => refreshAIAssistantUsage(request))
    return running.next
  }
  const entry = {}
  entry.promise = fetchAIAssistantUsage(request).finally(() => {
    if(refreshing.get(username) === entry)
      refreshing.delete(username)
  })
  refreshing.set(username, entry)
  return entry.promise
}
