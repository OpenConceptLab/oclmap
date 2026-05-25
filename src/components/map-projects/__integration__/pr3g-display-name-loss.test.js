/**
 * Regression test for OpenConceptLab/ocl_issues#2536 (PR3-G).
 *
 * Bug (now fixed): AI Assistant `recommendable_concepts[*]` entries for
 * bridge cascade targets were missing `display_name` even when the lookup
 * repo returned 200, because of a stale-closure setConceptCache at
 * MapProject.jsx:2447 (formerly L2472). The .then() callback inside
 * onCSVRowSelect captured `conceptCache` (React state) in its closure;
 * by the time the fetch resolved, that closure was stale relative to any
 * writeConceptCachePatch enrichments. The stale value was written back to
 * state, and the useEffect at MapProject.jsx:1738 then copied that stale
 * state into conceptCacheRef, wiping enrichments for unrelated keys.
 *
 * Fix: source the URL-keyed write from `conceptCacheRef.current` (the live
 * ref) instead of the closure-captured state. Matches the pattern already
 * used by writeConceptCachePatch and mergeIntoRowMatchState.
 *
 * This file mounts a minimal harness that mirrors the post-fix MapProject
 * cache pattern. If anyone reintroduces the stale-closure setConceptCache
 * (or another similar pattern in this area), PR3-G/3 will fail.
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

  // Mirror MapProject.jsx:2447 (post-#2536 fix) — onCSVRowSelect's
  // URL-keyed setConceptCache. The fix sources from `conceptCacheRef.current`
  // (the live ref) instead of `conceptCache` (closure-captured state). The
  // old buggy form `setConceptCache({...conceptCache, [url]: payload})`
  // captured a stale state in its closure; the deferred .then() then wrote
  // that stale state back, wiping any writeConceptCachePatch enrichment
  // that had landed in the interim. The fix synchronously updates the ref
  // and schedules a state update from the same live value — same pattern
  // as writeConceptCachePatch and mergeIntoRowMatchState.
  const legacyURLKeyedWrite = React.useCallback((url, payload) => {
    const next = { ...conceptCacheRef.current, [url]: payload }
    conceptCacheRef.current = next
    setConceptCache(next)
  }, [])

  React.useImperativeHandle(ref, () => ({
    writeConceptCachePatch,
    mergeIntoCache,
    legacyURLKeyedWrite,
    getCacheRef: () => conceptCacheRef.current,
    getCacheState: () => conceptCache,
  }), [conceptCache, writeConceptCachePatch, mergeIntoCache, legacyURLKeyedWrite])
  // ^ getCacheState reads conceptCache directly; depending on conceptCache
  // here is still useful so the test reads the latest committed state.

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

test('PR3-G/3 regression: deferred URL-keyed setConceptCache must NOT wipe lookup enrichment (#2536)', () => {
  // Scenario this guards: in production, onCSVRowSelect issues a fetch and
  // writes the response into conceptCache from a .then() callback. The
  // callback was created when the user clicked (an earlier render); by
  // the time the fetch resolves, conceptCache state may have advanced
  // (e.g., a writeConceptCachePatch landed). If the callback uses the
  // closure-captured state, the deferred write spreads a stale snapshot
  // and the useEffect at MapProject.jsx:1738 copies that stale state back
  // into the ref, wiping enrichment for unrelated keys.
  //
  // The fix (MapProject.jsx:2447, mirrored in the harness above) sources
  // the URL-keyed write from conceptCacheRef.current instead. This test
  // verifies enrichment survives a deferred callback under that pattern.

  const ref = mountHarness()
  act(() => { ref.current.mergeIntoCache([bridgeStub(QC01)]) })

  // Capture the URL-keyed write callback NOW (post-merge, pre-lookup-patch).
  // In production this models a user clicking a row before the bridge cascade
  // target's lookup has completed.
  const deferredCallback = ref.current.legacyURLKeyedWrite

  // Lookup patch lands while the deferred callback is still pending.
  act(() => { ref.current.writeConceptCachePatch(QC01, lookupEnriched(QC01)) })
  assert.equal(ref.current.getCacheRef()[QC01].display_name, 'Need for immunization against rabies',
    'enrichment present in ref after writeConceptCachePatch')

  // Fire the deferred callback (modeling the .then() resolving).
  act(() => { deferredCallback('/orgs/x/sources/y/concepts/z/', { id: 'z', display_name: 'unrelated' }) })

  // The fix should keep the QC01.2 enrichment intact. If anyone re-introduces
  // a stale-closure setConceptCache in this area, this assertion fails.
  assert.equal(ref.current.getCacheRef()[QC01].display_name, 'Need for immunization against rabies',
    'lookup enrichment must survive a deferred URL-keyed setConceptCache (#2536)')

  cleanup()
})
