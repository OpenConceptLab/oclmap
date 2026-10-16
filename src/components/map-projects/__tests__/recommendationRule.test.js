/**
 * Tests for the Mapper's recommendation rule (OpenConceptLab/ocl_issues#2908):
 * getRowRecommendation in viewBuilders.js. If the OCL AI Assistant has
 * analysed the row's current candidates, it decides what is proposed and the
 * score orders everything else; if it hasn't, the score decides.
 *
 * One test per row of the ticket's table, then the edge cases.
 *
 * Run with: npm test
 */

import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildQualityRowViews,
  getTargetRepoQualityViews,
  getRowRecommendation
} from '../viewBuilders.js'

const LOINC = 'http://loinc.org'
const keyOf = code => JSON.stringify([LOINC, code, '2.81'])
const defOf = (code, extra = {}) => ({
  key: keyOf(code),
  reference: { url: LOINC, code, version: '2.81' },
  id: code,
  ocl_url: `/orgs/Regenstrief/sources/LOINC/concepts/${code}/`,
  display_name: `Concept ${code}`,
  source: 'LOINC',
  ...extra
})

// A row's candidates, one per [code, rerank score]; a null score is a
// candidate whose rerank hasn't landed.
const rowOf = scored => {
  const candidates = {}
  const conceptRows = {}
  const conceptCache = {}
  scored.forEach(([code, score], i) => {
    const key = keyOf(code)
    candidates[`c${i}`] = { id: `c${i}`, concept_key: key, algorithm_id: 'ocl-semantic', type: 'standard', score: 1 - i / 100 }
    conceptRows[key] = { concept_key: key, ...(score === null ? {} : { rerank_score: score }) }
    conceptCache[key] = defOf(code)
  })
  return { rowState: { candidates, concept_rows: conceptRows }, conceptCache }
}

// Hemoglobin (Blood) from the 2026-10-13 LOINC 2.81 test, plus a low-ranked
// and an unranked candidate.
const HEMOGLOBIN = [['110885-1', 99.42], ['718-7', 97.39], ['717-9', 90], ['2823-3', 44.74], ['99999-9', null]]
const candidatesScore = { recommended: 99, available: 70 }
const FINGERPRINT = '5-abcdef12'

const aiCandidate = (code, extra = {}) => ({ concept_key: keyOf(code), canonical_reference: { url: LOINC, code, version: '2.81' }, ...extra })
const analysisOf = ({ recommendation, pick = null, alternates = [], confidence = 'HIGH', fingerprint = FINGERPRINT } = {}) => ({
  output: {
    recommendation,
    primary_candidate: pick ? aiCandidate(pick, { confidence_level: confidence }) : null,
    alternative_candidates: alternates.map((code, i) => aiCandidate(code, { rank: i + 1 }))
  },
  ...(fingerprint ? { candidate_pool_fingerprint: fingerprint } : {})
})

const decide = (scored, analyses, overrides = {}) => {
  const { rowState, conceptCache } = rowOf(scored)
  return getRowRecommendation({
    views: buildQualityRowViews(rowState, conceptCache),
    analyses,
    fingerprint: FINGERPRINT,
    candidatesScore,
    conceptCache,
    ...overrides
  })
}

const codes = views => (views || []).map(view => view.conceptDefinition.id)
const code = view => view?.conceptDefinition?.id ?? null
const sectionCodes = result => Object.fromEntries(Object.entries(result.sections).map(([name, views]) => [name, codes(views)]))

const SCORE_SECTIONS = {
  pick: [],
  alternates: [],
  recommended: ['110885-1'],
  available: ['718-7', '717-9'],
  lowRanked: ['2823-3'],
  unranked: ['99999-9']
}

// ---------- The table: no analysis, failed, or out of date ----------

test('getRowRecommendation: no analysis proposes the top score, if Recommended (today\'s rule)', () => {
  const result = decide(HEMOGLOBIN, undefined)
  assert.equal(code(result.proposal), '110885-1')
  assert.equal(result.chosenBy, 'score')
  assert.equal(result.agreement, 'none')
  assert.equal(result.verdict, null)
  assert.deepEqual(sectionCodes(result), SCORE_SECTIONS)
})

test('getRowRecommendation: no analysis and a top score below Recommended proposes nothing', () => {
  const result = decide([['718-7', 97.39], ['717-9', 90]], [])
  assert.equal(result.proposal, null)
  assert.equal(result.chosenBy, 'score')
  assert.equal(result.agreement, 'none')
})

test('getRowRecommendation: a failed analysis leaves only an older one of other candidates, so the score decides', () => {
  // A call that fails adds no entry: the latest is the one before it, which
  // saw a different candidate pool.
  const result = decide(HEMOGLOBIN, [analysisOf({ recommendation: 'RECOMMEND', pick: '718-7', fingerprint: '4-0ld0ld00' })])
  assert.equal(code(result.proposal), '110885-1')
  assert.equal(result.chosenBy, 'score')
  assert.equal(result.agreement, 'out_of_date')
  assert.deepEqual(sectionCodes(result), SCORE_SECTIONS)
})

test('getRowRecommendation: an out-of-date analysis keeps its verdict and pick for display, but the score decides', () => {
  const result = decide(HEMOGLOBIN, [analysisOf({ recommendation: 'REJECT', fingerprint: '6-c4a4ged0' })])
  assert.equal(result.isCurrent, false)
  assert.equal(result.verdict, 'REJECT')
  assert.equal(code(result.proposal), '110885-1')
  assert.equal(result.chosenBy, 'score')
  assert.equal(result.agreement, 'out_of_date')
})

test('getRowRecommendation: an analysis saved before candidate-pool fingerprints is out of date', () => {
  const result = decide(HEMOGLOBIN, [analysisOf({ recommendation: 'RECOMMEND', pick: '718-7', fingerprint: null })])
  assert.equal(result.agreement, 'out_of_date')
  assert.equal(code(result.proposal), '110885-1')
  assert.equal(code(result.pick), '718-7')
})

test('getRowRecommendation: without the current pool\'s fingerprint no analysis is current', () => {
  const result = decide(HEMOGLOBIN, [analysisOf({ recommendation: 'RECOMMEND', pick: '718-7' })], { fingerprint: null })
  assert.equal(result.agreement, 'out_of_date')
  assert.equal(result.chosenBy, 'score')
})

// ---------- The table: RECOMMEND ----------

test('getRowRecommendation: RECOMMEND of the top score proposes it and agrees', () => {
  const result = decide(HEMOGLOBIN, [analysisOf({ recommendation: 'RECOMMEND', pick: '110885-1', alternates: ['718-7'] })])
  assert.equal(code(result.proposal), '110885-1')
  assert.equal(result.chosenBy, 'ai_assistant')
  assert.equal(result.agreement, 'agrees')
  assert.equal(result.pickRank, 1)
  assert.equal(result.conditional, false)
  assert.deepEqual(sectionCodes(result), {
    pick: ['110885-1'],
    alternates: ['718-7'],
    recommended: [],
    available: ['717-9'],
    lowRanked: ['2823-3'],
    unranked: ['99999-9']
  })
})

test('getRowRecommendation: RECOMMEND of a lower-scored candidate proposes the AI\'s pick, a different pick', () => {
  const result = decide(HEMOGLOBIN, [analysisOf({ recommendation: 'RECOMMEND', pick: '718-7', alternates: ['110885-1', '717-9'] })])
  assert.equal(code(result.proposal), '718-7')
  assert.equal(result.chosenBy, 'ai_assistant')
  assert.equal(result.agreement, 'different_pick')
  assert.equal(code(result.top), '110885-1')
  assert.equal(result.pickRank, 2)
  assert.deepEqual(sectionCodes(result), {
    pick: ['718-7'],
    alternates: ['110885-1', '717-9'],
    recommended: [],
    available: [],
    lowRanked: ['2823-3'],
    unranked: ['99999-9']
  })
})

test('getRowRecommendation: RECOMMEND proposes the AI\'s pick in any score bucket, even Low Ranked', () => {
  // Potassium (Serum): the AI's pick sat under Low Ranked at 44.74%.
  const result = decide([['2824-1', 72.5], ['2823-3', 44.74]], [analysisOf({ recommendation: 'RECOMMEND', pick: '2823-3' })])
  assert.equal(code(result.proposal), '2823-3')
  assert.equal(result.chosenBy, 'ai_assistant')
  assert.equal(result.agreement, 'different_pick')
  assert.equal(result.pickRank, 2)
})

// ---------- The table: CONDITIONAL ----------

test('getRowRecommendation: CONDITIONAL proposes the AI\'s pick, marked conditional', () => {
  const result = decide(HEMOGLOBIN, [analysisOf({ recommendation: 'CONDITIONAL', pick: '718-7', alternates: ['110885-1', '717-9'] })])
  assert.equal(code(result.proposal), '718-7')
  assert.equal(result.chosenBy, 'ai_assistant')
  assert.equal(result.agreement, 'different_pick')
  assert.equal(result.conditional, true)
  assert.equal(result.verdict, 'CONDITIONAL')
})

test('getRowRecommendation: CONDITIONAL of the top score agrees, marked conditional', () => {
  const result = decide(HEMOGLOBIN, [analysisOf({ recommendation: 'CONDITIONAL', pick: '110885-1' })])
  assert.equal(code(result.proposal), '110885-1')
  assert.equal(result.agreement, 'agrees')
  assert.equal(result.conditional, true)
})

// ---------- The table: REJECT and INSUFFICIENT ----------

test('getRowRecommendation: REJECT proposes nothing, even when the top score is Recommended', () => {
  const result = decide(HEMOGLOBIN, [analysisOf({ recommendation: 'REJECT', alternates: ['717-9'] })])
  assert.equal(result.proposal, null)
  assert.equal(result.chosenBy, 'ai_assistant')
  assert.equal(result.agreement, 'no_match')
  assert.equal(result.verdict, 'REJECT')
  assert.equal(code(result.top), '110885-1')
  assert.equal(result.pick, null)
  assert.deepEqual(sectionCodes(result), {
    pick: [],
    alternates: ['717-9'],
    recommended: ['110885-1'],
    available: ['718-7'],
    lowRanked: ['2823-3'],
    unranked: ['99999-9']
  })
})

test('getRowRecommendation: INSUFFICIENT proposes nothing, even when the top score is Recommended', () => {
  const result = decide(HEMOGLOBIN, [analysisOf({ recommendation: 'INSUFFICIENT' })])
  assert.equal(result.proposal, null)
  assert.equal(result.chosenBy, 'ai_assistant')
  assert.equal(result.agreement, 'not_enough')
  assert.equal(result.verdict, 'INSUFFICIENT')
  assert.deepEqual(sectionCodes(result), SCORE_SECTIONS)
})

test('getRowRecommendation: REJECT ignores a primary candidate the AI named anyway', () => {
  const result = decide(HEMOGLOBIN, [analysisOf({ recommendation: 'REJECT', pick: '718-7' })])
  assert.equal(result.proposal, null)
  assert.equal(result.pick, null)
  assert.equal(result.agreement, 'no_match')
})

// ---------- Edge cases ----------

test('getRowRecommendation: an AI pick that isn\'t a target-repo candidate falls back to the score rule', () => {
  const result = decide(HEMOGLOBIN, [analysisOf({ recommendation: 'RECOMMEND', pick: '12345-6', alternates: ['718-7'] })])
  assert.equal(code(result.proposal), '110885-1')
  assert.equal(result.chosenBy, 'score')
  assert.equal(result.agreement, 'pick_not_candidate')
  assert.equal(result.pick, null)
  assert.deepEqual(sectionCodes(result), SCORE_SECTIONS)
})

test('getRowRecommendation: a CONDITIONAL with no primary candidate falls back to the score rule', () => {
  const result = decide(HEMOGLOBIN, [analysisOf({ recommendation: 'CONDITIONAL' })])
  assert.equal(code(result.proposal), '110885-1')
  assert.equal(result.chosenBy, 'score')
  assert.equal(result.agreement, 'pick_not_candidate')
})

test('getRowRecommendation: confidence is reported but doesn\'t change the proposal', () => {
  const result = decide(HEMOGLOBIN, [analysisOf({ recommendation: 'RECOMMEND', pick: '718-7', confidence: 'LOW' })])
  assert.equal(result.confidence, 'LOW')
  assert.equal(code(result.proposal), '718-7')
  assert.equal(result.chosenBy, 'ai_assistant')
})

test('getRowRecommendation: alternates are ordered by score, skip non-candidates and the pick itself', () => {
  const result = decide(HEMOGLOBIN, [analysisOf({ recommendation: 'RECOMMEND', pick: '718-7', alternates: ['2823-3', '12345-6', '718-7', '110885-1'] })])
  assert.deepEqual(codes(result.sections.alternates), ['110885-1', '2823-3'])
  assert.deepEqual(codes(result.alternates), ['110885-1', '2823-3'])
})

test('getRowRecommendation: a pick tied with the top score agrees', () => {
  const result = decide([['110885-1', 99.42], ['718-7', 99.42]], [analysisOf({ recommendation: 'RECOMMEND', pick: '718-7' })])
  assert.equal(result.agreement, 'agrees')
  assert.equal(result.pickRank, 1)
})

test('getRowRecommendation: a pick that has no score yet is a different pick with no rank', () => {
  const result = decide(HEMOGLOBIN, [analysisOf({ recommendation: 'RECOMMEND', pick: '99999-9' })])
  assert.equal(code(result.proposal), '99999-9')
  assert.equal(result.agreement, 'different_pick')
  assert.equal(result.pickRank, null)
})

test('getRowRecommendation: with no scored candidate there is no top score to disagree with', () => {
  const result = decide([['718-7', null], ['717-9', null]], [analysisOf({ recommendation: 'RECOMMEND', pick: '717-9' })])
  assert.equal(code(result.proposal), '717-9')
  assert.equal(result.top, null)
  assert.equal(result.agreement, 'agrees')
})

test('getRowRecommendation: the latest analysis decides, not an earlier one', () => {
  const result = decide(HEMOGLOBIN, [
    analysisOf({ recommendation: 'REJECT' }),
    analysisOf({ recommendation: 'RECOMMEND', pick: '718-7' })
  ])
  assert.equal(code(result.proposal), '718-7')
  assert.equal(result.agreement, 'different_pick')
})

test('getRowRecommendation: accepts a single analysis entry as well as the history', () => {
  const result = decide(HEMOGLOBIN, analysisOf({ recommendation: 'RECOMMEND', pick: '718-7' }))
  assert.equal(code(result.proposal), '718-7')
})

test('getRowRecommendation: resolves the AI\'s pick by its canonical reference when it has no concept_key', () => {
  const entry = analysisOf({ recommendation: 'RECOMMEND' })
  entry.output.primary_candidate = { canonical_reference: { url: LOINC, code: '718-7' } }
  const result = decide(HEMOGLOBIN, [entry])
  assert.equal(code(result.proposal), '718-7')
})

test('getRowRecommendation: an analysis without a known verdict counts as none', () => {
  const result = decide(HEMOGLOBIN, [{ user: 'someone', timestamp: '2026-10-13T00:00:00Z', candidate_pool_fingerprint: FINGERPRINT }])
  assert.equal(result.agreement, 'none')
  assert.equal(result.chosenBy, 'score')
  assert.equal(code(result.proposal), '110885-1')
})

test('getRowRecommendation: no candidates, no proposal', () => {
  const result = decide([], [analysisOf({ recommendation: 'RECOMMEND', pick: '718-7' })])
  assert.equal(result.proposal, null)
  assert.equal(result.agreement, 'pick_not_candidate')
  assert.equal(result.top, null)
})

// ---------- getTargetRepoQualityViews ----------

test('getTargetRepoQualityViews: keeps only the target repo\'s concepts', () => {
  const { rowState, conceptCache } = rowOf([['718-7', 97.39]])
  const bridgeKey = JSON.stringify(['https://CIELterminology.org', '21', null])
  rowState.candidates.b0 = { id: 'b0', concept_key: bridgeKey, algorithm_id: 'ocl-bridge', type: 'bridge', score: 0.9 }
  rowState.concept_rows[bridgeKey] = { concept_key: bridgeKey, rerank_score: 99.9 }
  conceptCache[bridgeKey] = { key: bridgeKey, reference: { url: 'https://CIELterminology.org', code: '21' }, id: '21', ocl_url: '/orgs/CIEL/sources/CIEL/concepts/21/' }
  assert.deepEqual(codes(getTargetRepoQualityViews(rowState, conceptCache, LOINC, '/orgs/Regenstrief/sources/LOINC/')), ['718-7'])
  assert.equal(getTargetRepoQualityViews(rowState, conceptCache).length, 2)
})
