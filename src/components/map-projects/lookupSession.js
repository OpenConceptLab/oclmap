/**
 * Lookup state for one target version: fetched concept URLs (404s included),
 * the concept_keys found missing, and the bridge_child candidates dropped for
 * them. reset() starts a new generation and restores those candidates.
 */
import { dropMissingBridgeTargets, restoreBridgeTargets } from './normalizers.js'

export const LOOKUP_NOT_FOUND = Object.freeze({notFound: true})

const isNotFound = err => err?.response?.status === 404

export const createLookupSession = () => {
  let generation = 0
  let missingKeys = new Set()
  let urlFetches = new Map()
  let dropped = {}

  const recordDropped = (rowIndex, before, after) => {
    const prev = dropped[rowIndex] || {candidates: {}, concept_rows: {}}
    const candidates = {...prev.candidates}
    const conceptRows = {...prev.concept_rows}
    Object.entries(before.candidates || {}).forEach(([id, c]) => {
      if(!after.candidates[id]) candidates[id] = c
    })
    Object.entries(before.concept_rows || {}).forEach(([key, cr]) => {
      if(!after.concept_rows[key]) conceptRows[key] = cr
    })
    dropped[rowIndex] = {candidates, concept_rows: conceptRows}
  }

  return {
    get generation() { return generation },
    isCurrent: gen => gen === generation,
    isMissing: key => missingKeys.has(key),

    // Keeps a found concept or a final 404; anything else stays retryable.
    fetchOnce(url, fetcher) {
      const cache = urlFetches
      if(cache.has(url)) return cache.get(url)
      const promise = Promise.resolve()
        .then(fetcher)
        .then(data => {
          if(data?.id) return data
          cache.delete(url)
          return null
        }, err => {
          if(isNotFound(err)) return LOOKUP_NOT_FOUND
          cache.delete(url)
          return null
        })
      cache.set(url, promise)
      return promise
    },

    markMissing(gen, key) {
      if(gen !== generation) return false
      missingKeys.add(key)
      return true
    },

    dropMissing(rowIndex, rowState) {
      const kept = dropMissingBridgeTargets(rowState, missingKeys)
      if(kept !== rowState) recordDropped(rowIndex, rowState, kept)
      return kept
    },

    reset(rowMatchState) {
      generation += 1
      missingKeys = new Set()
      urlFetches = new Map()
      const toRestore = dropped
      dropped = {}
      let rows = rowMatchState
      const restored = {}
      Object.entries(toRestore).forEach(([rowIndex, removed]) => {
        const rowState = rows?.[rowIndex]
        const next = restoreBridgeTargets(rowState, removed)
        if(next === rowState) return
        rows = {...rows, [rowIndex]: next}
        restored[rowIndex] = Object.keys(next.candidates)
          .filter(id => !rowState.candidates[id])
          .map(id => next.candidates[id].concept_key)
      })
      return {rowMatchState: rows, restored}
    },
  }
}
