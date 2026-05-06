/**
 * Helpers for the opaque internal pool key used to index ConceptDefinitions
 * and ConceptRows by canonical concept identity.
 *
 * See plans/unified-mapper-model.md (the "key" and FHIR alignment notes
 * section). This file is the only place that knows the on-the-wire format
 * of the key. Components must use makeConceptKey / parseConceptKey rather
 * than constructing or splitting strings themselves.
 *
 * Why opaque: a key like `${url}|${code}` would collide with FHIR canonical
 * URL syntax (where `|` is the version separator: `http://loinc.org|2.74`).
 * Using JSON.stringify of an array sidesteps this and lets us extend with
 * version transparently.
 */

/**
 * @typedef {Object} ConceptReference
 * @property {string} url - canonical URL of the code system
 * @property {string} code - the concept code
 * @property {string} [version] - optional code system version
 */

/**
 * Produce the internal pool key for a ConceptReference.
 * @param {ConceptReference} reference
 * @returns {string}
 */
export const makeConceptKey = (reference) => {
  if (!reference || typeof reference.url !== 'string' || typeof reference.code !== 'string') {
    throw new TypeError('makeConceptKey requires a ConceptReference with url and code')
  }
  return JSON.stringify([reference.url, reference.code, reference.version ?? null])
}

/**
 * Recover the ConceptReference from an internal pool key.
 * @param {string} key
 * @returns {ConceptReference}
 */
export const parseConceptKey = (key) => {
  const [url, code, version] = JSON.parse(key)
  return version === null ? { url, code } : { url, code, version }
}

/**
 * Compare two references for canonical equality (ignoring undefined version).
 * @param {ConceptReference} a
 * @param {ConceptReference} b
 * @returns {boolean}
 */
export const referencesEqual = (a, b) => {
  if (!a || !b) return false
  return a.url === b.url && a.code === b.code && (a.version ?? null) === (b.version ?? null)
}
