// Match the form's URL validation when accepting metadata from a custom API.
export const isLikelyCanonicalUrl = value => {
  if(!value || typeof value !== 'string') return false
  return /^https?:\/\/[^\s]+$/i.test(value.trim())
}

// Omit an absent or invalid canonical so an existing form value is preserved.
export const metadataFields = data => ({
  id: data.ID || data.id || '',
  name: data.name || '',
  description: data.description || '',
  ...(isLikelyCanonicalUrl(data.canonical_url) ? { canonical_url: data.canonical_url.trim() } : {}),
})

// Try metadata paths in order: operation without $, original URL, then parent.
export const fetchAlgorithmMetadata = async (url, get) => {
  const [path] = url.split(/[?#]/, 1)
  const metadataUrl = path.replace(/\/\$([^/]+)(\/?)$/, '/$1$2') + url.slice(path.length)
  const first = await get(metadataUrl)
  const data = first?.data || first
  if(metadataUrl === url || (!first?.response && data?.name && (data?.ID || data?.id))) return first
  const second = await get(url)
  const secondData = second?.data || second
  if(!second?.response && secondData?.name && (secondData?.ID || secondData?.id)) return second
  const parentPath = path.replace(/\/\$[^/]+\/?$/, '')
  const parentUrl = parentPath + url.slice(path.length)
  const third = await get(parentUrl)
  const thirdData = third?.data || third
  if(!third?.response && thirdData?.name && (thirdData?.ID || thirdData?.id)) return third
  return [first, second, third].find(response => [401, 403].includes(response?.response?.status || response?.status)) || third
}

// Whether the patched id/name collide with ANOTHER algorithm (the one being edited is excluded by key).
export const conflictingFields = (items, key, patch) => {
  const others = (items || []).filter(item => item.__key !== key)
  return Object.fromEntries(['id', 'name']
    .filter(field => patch[field])
    .map(field => [field, others.some(item => item[field] === patch[field])]))
}
