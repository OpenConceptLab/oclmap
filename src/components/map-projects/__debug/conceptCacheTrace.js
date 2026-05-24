// Debug-only instrumentation for OpenConceptLab/ocl_issues#2536 (PR3-G).
// Logs every conceptCache write touching a target concept_key, with
// timestamp + source + lookup_status + display_name presence. Gated by
// localStorage so it costs nothing in normal use.
//
// Enable in browser devtools console:
//   localStorage.setItem('MAPPER_DEBUG_CONCEPT_KEY', '<concept_key>')
//   // Example key for ICD-11 QC01.2 (project pinned to HEAD):
//   //   ["http://id.who.int/icd/release/11/mms","QC01.2","HEAD"]
// Disable:
//   localStorage.removeItem('MAPPER_DEBUG_CONCEPT_KEY')
//
// To trace by concept code substring instead of exact key, set:
//   localStorage.setItem('MAPPER_DEBUG_CONCEPT_CODE', 'QC01.2')
//
// Remove this module + its call sites after #2536 root cause is found.

const isBrowser = typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'

const getTargetKey = () => {
  if (!isBrowser) return null
  try { return window.localStorage.getItem('MAPPER_DEBUG_CONCEPT_KEY') } catch (_) { return null }
}

const getTargetCode = () => {
  if (!isBrowser) return null
  try { return window.localStorage.getItem('MAPPER_DEBUG_CONCEPT_CODE') } catch (_) { return null }
}

const matchesTarget = (key) => {
  if (!key) return false
  const targetKey = getTargetKey()
  if (targetKey && key === targetKey) return true
  const targetCode = getTargetCode()
  if (targetCode && key.includes(`"${targetCode}"`)) return true
  return false
}

const summarize = (def) => {
  if (!def) return '(null)'
  return {
    lookup_status: def.lookup_status,
    has_display_name: typeof def.display_name === 'string' && def.display_name.length > 0,
    display_name: def.display_name,
    has_names: Array.isArray(def.names) && def.names.length > 0,
    has_property: Array.isArray(def.property) && def.property.length > 0,
    ocl_url: def.ocl_url,
    lookup_source_type: def.lookup_source_type,
    lookup_source: def.lookup_source,
  }
}

// Log a write to conceptCache for the target key.
// `source` is a short string identifying the call site (e.g. 'mergeIntoRowMatchState/accept',
// 'writeConceptCachePatch', 'load/setConceptCache', 'legacy-url/setConceptCache').
// `prevDef` is the entry that was in cache before this write (or null).
// `nextDef` is what's being written (or null if no write — e.g. rank-guard rejection).
// `extra` is an optional object with any extra context (e.g. action: 'accept'|'reject').
export const traceConceptCacheWrite = (key, source, prevDef, nextDef, extra) => {
  if (!matchesTarget(key)) return
  // eslint-disable-next-line no-console
  console.log(
    `[#2536 conceptCache] ${new Date().toISOString()} key=${key} source=${source}`,
    { prev: summarize(prevDef), next: summarize(nextDef), ...(extra || {}) }
  )
}

// Log a read from conceptCache at AI-payload build time.
export const traceConceptCacheRead = (key, source, def, extra) => {
  if (!matchesTarget(key)) return
  // eslint-disable-next-line no-console
  console.log(
    `[#2536 conceptCache READ] ${new Date().toISOString()} key=${key} source=${source}`,
    { def: summarize(def), ...(extra || {}) }
  )
}
