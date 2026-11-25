// Edits to the selected algorithm list (ocl_online#786).
//
// A reply that arrives after a request (a custom algorithm check, a bridge
// repo's canonical URL) is applied to the list as it is now, not to the list
// from the render that sent the request.

export const patchSelected = (list, key, patch) =>
  (list || []).map(v => (v.__key === key ? { ...v, ...patch } : v))

// The reply was for an algorithm that has since been removed, or for a URL
// the user has since changed.
export const isStaleReply = (list, key, url) => {
  const current = (list || []).find(v => v.__key === key)
  return !current || current.url !== url
}
