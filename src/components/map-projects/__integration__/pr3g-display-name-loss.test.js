/**
 * Diagnostic test for OpenConceptLab/ocl_issues#2536 (PR3-G).
 *
 * Bug: AI Assistant `recommendable_concepts[*]` entries for bridge cascade
 * targets are missing `display_name` even when the lookup repo returned 200.
 * The pure-logic reproducer (`__tests__/pr3g-cache-bug-repro.test.js`) already
 * ruled out the merge/write logic. The bug must be in React lifecycle.
 *
 * Strategy: mount a minimal harness that mirrors MapProject.jsx's cache
 * pattern — useState + useRef + the useEffect at MapProject.jsx:1738 +
 * writeConceptCachePatch + mergeIntoRowMatchState's cache-merge branch +
 * the legacy URL-keyed setConceptCache at MapProject.jsx:2472. Then drive
 * it through the suspect interaction.
 *
 * Outcome decision tree:
 *   - test 3 PASSES  → the (A)+(B) interaction in #2536 is NOT the bug.
 *                      Widen the harness (or mount MapProject itself) to
 *                      include more of the real lifecycle.
 *   - test 3 FAILS   → suspect (A)+(B) confirmed. Fix targets either the
 *                      useEffect at MapProject.jsx:1738 or the stale-closure
 *                      setConceptCache at MapProject.jsx:2472.
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { render, act, cleanup } from '@testing-library/react'

import { lookupStatusRank } from '../normalizers.js'

// --- Harness that mirrors the suspect MapProject.jsx cache pattern ---
//
// Five hooks mirrored, line numbers from MapProject.jsx on main as of writing:
//   - useState/useRef for conceptCache         (L245, L172-ish)
//   - useEffect syncing state -> ref           (L1738) — suspect (A)
//   - writeConceptCachePatch                    (L3308)
//   - mergeIntoRowMatchState cache branch       (L377-395)
//   - legacy URL-keyed setConceptCache          (L2472) — suspect (B)
//
// Anything NOT mirrored (rowMatchState, ensureLoaded scheduling, scheduleRerank,
// the whole bulk-AI-analysis flow) is intentionally out of scope — if the bug
// requires those, this harness will pass and we'll know to widen scope.
const CacheTestHarness = React.forwardRef((_props, ref) => {
  const [conceptCache, setConceptCache] = React.useState({})
  const conceptCacheRef = React.useRef({})

  // Mirror MapProject.jsx:1738 — the suspect useEffect that syncs state to ref.
  React.useEffect(() => {
    conceptCacheRef.current = conceptCache
  }, [conceptCache])

  // Mirror MapProject.jsx:3308 — unconditional cache patch from lookup.
  const writeConceptCachePatch = React.useCallback((key, def) => {
    const next = { ...conceptCacheRef.current, [key]: def }
    conceptCacheRef.current = next
    setConceptCache(next)
  }, [])

  // Mirror MapProject.jsx:377-395 — rank-guarded merge from algorithm response.
  const mergeIntoCache = React.useCallback((defs) => {
    const nextCache = { ...conceptCacheRef.current }
    let cacheChanged = false
    defs.forEach((def) => {
      const existing = nextCache[def.key]
      if (!existing || lookupStatusRank(def.lookup_status) > lookupStatusRank(existing.lookup_status)) {
        nextCache[def.key] = def
        cacheChanged = true
      }
    })
    if (cacheChanged) {
      conceptCacheRef.current = nextCache
      setConceptCache(nextCache)
    }
  }, [])

  // Mirror MapProject.jsx:2472 — onCSVRowSelect's stale-closure setConceptCache.
  // The `conceptCache` reference here is the closure-captured state value at
  // the time this callback was created — NOT the ref. That's the bug pattern.
  const legacyURLKeyedWrite = React.useCallback((url, payload) => {
    setConceptCache({ ...conceptCache, [url]: payload })
  }, [conceptCache])

  React.useImperativeHandle(ref, () => ({
    writeConceptCachePatch,
    mergeIntoCache,
    legacyURLKeyedWrite,
    getCacheRef: () => conceptCacheRef.current,
    getCacheState: () => conceptCache,
  }), [conceptCache, writeConceptCachePatch, mergeIntoCache, legacyURLKeyedWrite])

  return null
})

// --- Helpers ---
const QC01 = '["http://id.who.int/icd/release/11/mms","QC01.2","HEAD"]'

const bridgeStub = (key) => ({
  key,
  reference: { url: 'http://id.who.int/icd/release/11/mms', code: 'QC01.2', version: 'HEAD' },
  display_name: null,
  names: undefined,
  lookup_status: 'pending',
})

const lookupEnriched = (key) => ({
  key,
  reference: { url: 'http://id.who.int/icd/release/11/mms', code: 'QC01.2', version: 'HEAD' },
  id: 'QC01.2',
  display_name: 'Need for immunization against rabies',
  names: [{ name: 'Need for immunization against rabies', locale: 'en', name_type: 'FULLY_SPECIFIED', locale_preferred: true }],
  concept_class: 'Diagnosis',
  datatype: 'N/A',
  ocl_url: '/orgs/OpenMRS-OCL-Squad/sources/ICD-11-WHO-Mapper/concepts/QC01.2/',
  lookup_status: 'full',
  lookup_source_type: '$lookup',
})

const mountHarness = () => {
  const ref = React.createRef()
  render(React.createElement(CacheTestHarness, { ref }))
  return ref
}

// --- Tests ---

test('PR3-G/1 baseline: merge stub then lookup-patch leaves enriched entry in ref', () => {
  const ref = mountHarness()

  act(() => { ref.current.mergeIntoCache([bridgeStub(QC01)]) })
  assert.equal(ref.current.getCacheRef()[QC01].lookup_status, 'pending')
  assert.equal(ref.current.getCacheRef()[QC01].display_name, null)

  act(() => { ref.current.writeConceptCachePatch(QC01, lookupEnriched(QC01)) })
  assert.equal(ref.current.getCacheRef()[QC01].display_name, 'Need for immunization against rabies',
    'enrichment must land in the ref synchronously after writeConceptCachePatch')

  cleanup()
})

test('PR3-G/2 re-merge: a second bridge merge cannot overwrite the lookup-enriched entry', () => {
  const ref = mountHarness()

  act(() => { ref.current.mergeIntoCache([bridgeStub(QC01)]) })
  act(() => { ref.current.writeConceptCachePatch(QC01, lookupEnriched(QC01)) })
  assert.equal(ref.current.getCacheRef()[QC01].display_name, 'Need for immunization against rabies')

  // Another bridge $match for a different row produces the same QC01.2 stub.
  // The rank guard should reject the overwrite.
  act(() => { ref.current.mergeIntoCache([bridgeStub(QC01)]) })
  assert.equal(ref.current.getCacheRef()[QC01].display_name, 'Need for immunization against rabies',
    'rank guard must preserve the lookup-enriched entry against a thinner re-merge')

  cleanup()
})

test('PR3-G/3 STALE CLOSURE: legacy URL-keyed setConceptCache wipes lookup enrichment', () => {
  const ref = mountHarness()

  // T=0: bridge $match arrives, QC01.2 stub merged into cache (pending).
  act(() => { ref.current.mergeIntoCache([bridgeStub(QC01)]) })

  // T=1: ensureLoaded for QC01.2 completes; writeConceptCachePatch enriches.
  act(() => { ref.current.writeConceptCachePatch(QC01, lookupEnriched(QC01)) })

  // Verify enrichment is in BOTH the ref (synchronous) and state (after commit).
  assert.equal(ref.current.getCacheRef()[QC01].display_name, 'Need for immunization against rabies',
    'enrichment present in ref after writeConceptCachePatch')
  assert.equal(ref.current.getCacheState()[QC01].display_name, 'Need for immunization against rabies',
    'enrichment present in state after writeConceptCachePatch commit')

  // T=2: legacyURLKeyedWrite captures a CURRENT closure of conceptCache and
  // calls setConceptCache({...conceptCache, [url]: payload}). The closure
  // here is the post-enrichment state, so it shouldn't lose anything...
  // UNLESS the closure was captured BEFORE the writeConceptCachePatch ran.
  //
  // To repro the bug we need the legacyURLKeyedWrite callback to be the
  // one created when state was still the bridge-stub. React re-creates the
  // callback every render (its deps are [conceptCache]), so under normal
  // rendering, by the time we call it after writeConceptCachePatch, the
  // callback's closure has already advanced. But — what about a callback
  // that was queued before the writeConceptCachePatch commit?
  //
  // In production, onCSVRowSelect's async .then() callback is created
  // when the user clicks. The fetch returns later. The .then() captures
  // the closure from the ORIGINAL render — which is stale by the time
  // the response arrives. That's what we model here.

  // Capture the legacyURLKeyedWrite that was current BEFORE the enrichment
  // landed — to do that, get a fresh harness up to the pre-enrichment state.
  cleanup()
  const ref2 = mountHarness()
  act(() => { ref2.current.mergeIntoCache([bridgeStub(QC01)]) })

  // Capture the stale callback NOW (post-merge, pre-lookup-patch).
  const staleLegacyWrite = ref2.current.legacyURLKeyedWrite

  // Lookup patch lands.
  act(() => { ref2.current.writeConceptCachePatch(QC01, lookupEnriched(QC01)) })
  assert.equal(ref2.current.getCacheRef()[QC01].display_name, 'Need for immunization against rabies',
    'ref carries enrichment after lookup patch')

  // Now fire the stale callback (modeling the deferred .then() from a user
  // click that happened before lookup completed).
  act(() => { staleLegacyWrite('/orgs/x/sources/y/concepts/z/', { id: 'z', display_name: 'unrelated' }) })

  // If suspect (A) + (B) is the bug, the stale closure's setConceptCache
  // wrote {...staleState, [url]: payload} — staleState is the bridge-stub
  // version. The useEffect at L1738 then copies that stale state back into
  // the ref, wiping the enrichment.
  const finalRefEntry = ref2.current.getCacheRef()[QC01]
  assert.equal(finalRefEntry.display_name, 'Need for immunization against rabies',
    'PR3-G: lookup enrichment must survive a deferred stale-closure setConceptCache (#2536)')

  cleanup()
})
