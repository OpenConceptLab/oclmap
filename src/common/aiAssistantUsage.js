// The OCL AI Assistant's usage as the service reports it: the unit it counts in
// and how many it has counted, never a limit (OpenConceptLab/ocl_online#641).
export const toAIAssistantUsage = data =>
  typeof data?.meter === 'string' && Number.isFinite(data?.used) ? {meter: data.meter, used: data.used} : null

const STORAGE_KEY = 'ai_assistant_usage'

// The last report kept for this person. Without one, the chip keeps its call line.
export const getAIAssistantUsage = (storage, username) => {
  try {
    const stored = JSON.parse(storage.getItem(STORAGE_KEY))
    return username && stored?.username === username ? toAIAssistantUsage(stored) : null
  } catch(_) {
    return null
  }
}

// Asks for the report with `get` (axios.get, not APIService, so a refused or
// throttled request skips its sign-out and throttling handling). A report
// without a unit and a count clears the kept one; a failed request keeps it.
// Resolves to whether the kept report changed.
export const refreshAIAssistantUsage = ({get, storage, baseURL, token, username}) => {
  if(!baseURL || !token || !username)
    return Promise.resolve(false)
  const url = `${baseURL.replace(/\/+$/, '')}/match/usage/`
  return get(url, {headers: {Authorization: `Token ${token}`}, timeout: 10000})
    .then(response => {
      const usage = toAIAssistantUsage(response?.data)
      if(usage)
        storage.setItem(STORAGE_KEY, JSON.stringify({...usage, username}))
      else
        storage.removeItem(STORAGE_KEY)
      return true
    })
    .catch(() => false)
}
