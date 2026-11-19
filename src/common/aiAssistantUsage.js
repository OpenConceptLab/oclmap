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

// Counts the reports kept from replies, so a refresh that was sent before one
// doesn't overwrite it with an older count.
let keptFromReplies = 0

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
  keptFromReplies += 1
  store(storage, username, usage)
  return true
}

// The reply without `metadata.usage`, for what a project stores: the report is
// the person's own count, and a project's history can be an organization's.
export const withoutAIAssistantUsage = reply => {
  if(!reply?.metadata || !Object.prototype.hasOwnProperty.call(reply.metadata, 'usage'))
    return reply
  const metadata = {...reply.metadata}
  delete metadata.usage
  return {...reply, metadata}
}

// Asks for the report with `get` (axios.get, not APIService, so a refused or
// throttled request skips its sign-out and throttling handling). A report
// without a unit and a count clears the kept one; a failed request, or one
// overtaken by a reply's report, keeps it. Resolves to whether the kept
// report changed.
export const refreshAIAssistantUsage = ({get, storage, baseURL, token, username}) => {
  if(!baseURL || !token || !username)
    return Promise.resolve(false)
  const url = `${baseURL.replace(/\/+$/, '')}/match/usage/`
  const keptBefore = keptFromReplies
  return get(url, {headers: {Authorization: `Token ${token}`}, timeout: 10000})
    .then(response => {
      if(keptFromReplies !== keptBefore)
        return false
      store(storage, username, toAIAssistantUsage(response?.data))
      return true
    })
    .catch(() => false)
}
