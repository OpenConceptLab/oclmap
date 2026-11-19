// The OCL AI Assistant's usage as the service reports it: the unit it counts in
// and how many it has counted, never a limit (OpenConceptLab/ocl_online#641).
export const toAIAssistantUsage = data =>
  typeof data?.meter === 'string' && Number.isFinite(data?.used) ? {meter: data.meter, used: data.used} : null

// The units whose report gets a chip of its own where the Mapper shows no
// Preview chip (OpenConceptLab/ocl_online#641).
export const USAGE_CHIP_METERS = ['calls', 'tokens']

export const getUsageChipReport = usage => usage && USAGE_CHIP_METERS.includes(usage.meter) ? usage : null

const hasProject = project => project !== undefined && project !== null && project !== ''

// The service reports the count for the map project a call names (none for a
// project not saved yet), so each person's last report is kept per project,
// under its own key.
const storageKey = (username, project) =>
  `ai_assistant_usage:${username}${hasProject(project) ? `:project:${project}` : ''}`

// What's kept for this person and project now, to tell whether it changed:
// undefined if the storage can't be read.
const read = (storage, key) => {
  try {
    return storage.getItem(key)
  } catch(_) {
    return undefined
  }
}

// A full or blocked storage only costs the chip its report.
const store = (storage, key, usage) => {
  try {
    if(usage)
      storage.setItem(key, JSON.stringify(usage))
    else
      storage.removeItem(key)
  } catch(_) {
    // nothing to keep
  }
}

// The last report kept for this person and project. Without one, the chip
// keeps its call line.
export const getAIAssistantUsage = (storage, username, project) => {
  if(!username)
    return null
  try {
    return toAIAssistantUsage(JSON.parse(storage.getItem(storageKey(username, project))))
  } catch(_) {
    return null
  }
}

// Keeps the report a reply carries in `metadata.usage` (an $invoke reply) for
// the person who sent the request and the project it named. Returns whether
// it kept one.
export const keepAIAssistantUsage = (storage, username, reply, project) => {
  const usage = toAIAssistantUsage(reply?.metadata?.usage)
  if(!usage || !username)
    return false
  store(storage, storageKey(username, project), usage)
  return true
}

// The reply without `metadata.usage`, for what a project stores: the report is
// the service's running count, which covers more than this project's work.
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
// the kept report changed. The request names the project (`map_project`), so
// the report is the count the calls on it are charged to, as their replies
// carry it.
const fetchAIAssistantUsage = ({get, storage, baseURL, token, username, project}) => {
  const url = `${baseURL.replace(/\/+$/, '')}/match/usage/`
  const key = storageKey(username, project)
  const keptBefore = read(storage, key)
  const config = {headers: {Authorization: `Token ${token}`}, timeout: 10000}
  if(hasProject(project))
    config.params = {map_project: project}
  return get(url, config)
    .then(response => {
      if(read(storage, key) !== keptBefore)
        return false
      store(storage, key, toAIAssistantUsage(response?.data))
      return true
    })
    .catch(() => false)
}

// One refresh at a time per person and project: a request made while one is
// in flight waits for it, then all such requests share one more, so a refresh
// never overtakes another and discards its newer count.
const refreshing = new Map()

export const refreshAIAssistantUsage = request => {
  const { baseURL, token, username, project } = request
  if(!baseURL || !token || !username)
    return Promise.resolve(false)
  const key = storageKey(username, project)
  const running = refreshing.get(key)
  if(running) {
    running.next = running.next || running.promise.then(() => refreshAIAssistantUsage(request))
    return running.next
  }
  const entry = {}
  entry.promise = fetchAIAssistantUsage(request).finally(() => {
    if(refreshing.get(key) === entry)
      refreshing.delete(key)
  })
  refreshing.set(key, entry)
  return entry.promise
}
