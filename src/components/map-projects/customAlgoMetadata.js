// Cheap structural validator for canonical URLs. The unified mapper model requires every
// algorithm's concept_identity.canonical_url to be a URL, and custom algorithms rely on user
// input or on the metadata below for it, so the form validates here.
export const isLikelyCanonicalUrl = value => {
  if(!value || typeof value !== 'string') return false
  return /^https?:\/\/[^\s]+$/i.test(value.trim())
}

// Omit an absent or invalid canonical, and never replace one the user already filled in.
export const metadataFields = (data, current = {}) => ({
  id: data.ID || data.id || '',
  name: data.name || '',
  description: data.description || '',
  ...(isLikelyCanonicalUrl(data.canonical_url) && !current.canonical_url?.trim() ? { canonical_url: data.canonical_url.trim() } : {}),
})

const isMetadata = response => {
  const data = response?.data || response
  return !response?.response && Boolean(data?.name && (data?.ID || data?.id))
}

// The configured URL is authoritative: request it first, then the operation without $
// (`/$match` -> `/match`), then the parent path. Candidates that collapse to the same URL
// (no `$` marker) are requested once.
export const fetchAlgorithmMetadata = async (url, get) => {
  const [path] = url.split(/[?#]/, 1)
  const suffix = url.slice(path.length)
  const candidates = [...new Set([
    url,
    path.replace(/\/\$([^/]+)(\/?)$/, '/$1$2') + suffix,
    path.replace(/\/\$[^/]+\/?$/, '') + suffix,
  ])]
  const responses = []
  for(const candidate of candidates) {
    const response = await get(candidate)
    if(isMetadata(response)) return response
    responses.push(response)
  }
  return responses.find(response => [401, 403].includes(response?.response?.status || response?.status)) || responses[responses.length - 1]
}

// Whether the patched id/name collide with ANOTHER algorithm (the one being edited is excluded by key).
export const conflictingFields = (items, key, patch) => {
  const others = (items || []).filter(item => item.__key !== key)
  return Object.fromEntries(['id', 'name']
    .filter(field => patch[field])
    .map(field => [field, others.some(item => item[field] === patch[field])]))
}
