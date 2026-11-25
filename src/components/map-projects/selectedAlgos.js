// Edits to the selected algorithm list (ocl_online#786).
//
// A reply that arrives after a request (a custom algorithm check, a bridge
// repo's canonical URL) is applied to the list as it is now, not to the list
// from the render that sent the request.

export const patchSelected = (list, key, patch) =>
  (list || []).map(v => (v.__key === key ? { ...v, ...patch } : v))

// The reply was for an algorithm that has since been removed, or one whose
// sent fields (such as its URL or token) the user has since changed.
export const isStaleReply = (list, key, sent) => {
  const current = (list || []).find(v => v.__key === key)
  return !current || Object.keys(sent || {}).some(field => current[field] !== sent[field])
}

// What to do with a custom algorithm check's reply:
// - 'ignore': a newer check owns this algorithm's state, or it was removed
// - 'clear': its URL or token changed while pending; only stop loading
// - 'apply': the reply is for the algorithm as it is now
export const customCheckReply = ({ list, key, sent, checkId, latestCheckId }) => {
  if(latestCheckId !== checkId)
    return 'ignore'
  if(!(list || []).some(v => v.__key === key))
    return 'ignore'
  return isStaleReply(list, key, sent) ? 'clear' : 'apply'
}
