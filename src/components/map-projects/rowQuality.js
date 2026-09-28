/**
 * Match quality per row, for the grid's Match Quality column and its
 * Recommended / Available / Low Ranked counters (ocl_issues#2837).
 *
 * A row with a proposed match is ranked by that match's score; without a
 * score it counts as Low Ranked. A row with candidates but no decision yet is
 * ranked by its best candidate. Auto Match without the AI Assistant only
 * proposes a match at or above Recommended, so without this a run whose
 * candidates all scored lower showed 0 everywhere. Other rows (no candidates,
 * a candidate still waiting for its score, or a decision without a match,
 * such as rejected) are unranked.
 */

const toScore = value => {
  if(value === null || value === undefined || value === '') return null
  const score = parseFloat(value)
  return Number.isFinite(score) ? score : null
}

const getBucket = (score, candidatesScore) => {
  if(score >= candidatesScore.recommended) return 'recommended'
  if(score >= candidatesScore.available) return 'available'
  return 'low_ranked'
}

/**
 * @param {object}  row
 * @param {object}  [row.proposedMatch]      the row's mapSelected entry
 * @param {boolean} [row.hasDecision]        whether the row has a decision
 * @param {number}  [row.bestCandidateScore] its best target-repo candidate's rerank score
 * @param {object}  candidatesScore          {recommended, available} thresholds
 * @returns {{source: 'proposed'|'candidate', score: number|null, bucket: string}|null}
 */
export const getRowQuality = ({ proposedMatch, hasDecision = false, bestCandidateScore } = {}, candidatesScore) => {
  if(proposedMatch) {
    const score = toScore(proposedMatch.search_meta?.search_normalized_score)
    return { source: 'proposed', score, bucket: score === null ? 'low_ranked' : getBucket(score, candidatesScore) }
  }
  const candidateScore = toScore(bestCandidateScore)
  if(hasDecision || candidateScore === null)
    return null
  return { source: 'candidate', score: candidateScore, bucket: getBucket(candidateScore, candidatesScore) }
}

// {rowIndex: quality or null} for the given rows. getBestCandidateScore is
// only asked for rows with no proposed match and no decision.
export const getRowQualities = ({ rowIndexes = [], mapSelected = {}, decisions = {}, getBestCandidateScore = () => undefined }, candidatesScore) => {
  const qualities = {}
  rowIndexes.forEach(index => {
    const proposedMatch = mapSelected[index]
    const hasDecision = Boolean(decisions[index])
    qualities[index] = getRowQuality({
      proposedMatch,
      hasDecision,
      bestCandidateScore: (proposedMatch || hasDecision) ? undefined : getBestCandidateScore(index),
    }, candidatesScore)
  })
  return qualities
}

export const countQualityBuckets = qualities => {
  const counts = { recommended: 0, available: 0, low_ranked: 0 }
  Object.values(qualities).forEach(quality => {
    if(quality) counts[quality.bucket] += 1
  })
  return counts
}

// The rows in a bucket, sorted by score (no score sorts as 0). No bucket, or
// a bucket with no rows anywhere in the project (qualities covers every row),
// leaves the rows as they are.
export const filterRowsByQualityBucket = (rows, qualities, bucket, sortBy) => {
  if(!bucket) return rows
  if(!Object.values(qualities).some(quality => quality?.bucket === bucket)) return rows
  const scoreOf = row => qualities[row.__index].score || 0
  return rows
    .filter(row => qualities[row.__index]?.bucket === bucket)
    .sort((a, b) => sortBy === 'asc' ? scoreOf(a) - scoreOf(b) : scoreOf(b) - scoreOf(a))
}

/**
 * Caches each row's best candidate score across renders. A row is recomputed
 * only when its state object, a concept definition its concept rows use, or
 * the target repo changes; rows state and the concept cache are replaced,
 * never mutated, so identity checks are enough.
 *
 * @returns {{getter: function}} getter({rows, concepts, targetKey, computeScore})
 *   returns rowIndex => score for one render. computeScore (rowIndex => score,
 *   e.g. from pickTopRowView) is the render's own, so it sees that render's
 *   project context.
 */
export const createBestCandidateScoreCache = () => {
  let byRow = new Map()
  let current = { rows: null, concepts: null, targetKey: null }
  let checked = new Set()
  return {
    getter: ({ rows, concepts, targetKey, computeScore }) => {
      if(current.targetKey !== targetKey)
        byRow = new Map()
      if(current.rows !== rows || current.concepts !== concepts || current.targetKey !== targetKey) {
        current = { rows, concepts, targetKey }
        checked = new Set()
      }
      return index => {
        if(checked.has(index))
          return byRow.get(index)?.score
        checked.add(index)
        const rowState = rows?.[index]
        if(!rowState) {
          byRow.delete(index)
          return undefined
        }
        const conceptKeys = Object.keys(rowState.concept_rows || {})
        const entry = byRow.get(index)
        const unchanged = entry && entry.rowState === rowState && entry.defs.length === conceptKeys.length &&
          conceptKeys.every((key, i) => entry.defs[i] === concepts?.[key])
        if(unchanged)
          return entry.score
        const score = computeScore(index)
        byRow.set(index, { rowState, defs: conceptKeys.map(key => concepts?.[key]), score })
        return score
      }
    },
  }
}
