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
