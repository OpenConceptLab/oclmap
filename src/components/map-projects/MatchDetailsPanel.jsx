import React from 'react';
import { useTranslation } from 'react-i18next'

import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'

import map from 'lodash/map'
import startCase from 'lodash/startCase'

import { getScoreDetails, ScoreValueChip } from './Score'

// Per-algorithm score chip rendered inline. Used both for the legacy single-
// algorithm case (raw_score = candidate.score) and the multi-algo aggregated
// case (one row per contributingAlgorithm).
const RawScoreRow = ({algorithm, score}) => (
  <Stack direction='row' spacing={0.75} alignItems='center' sx={{flexWrap: 'nowrap', width: 'fit-content'}}>
    <Chip size='small' label={algorithm} variant='outlined' color='warning' />
    <ScoreValueChip
      size='small'
      showIndicator={false}
      label={score}
      sx={{backgroundColor: 'rgba(0, 0, 0, 0.08)', color: 'surface.dark', fontWeight: 600}}
    />
  </Stack>
)

// Content-only — no Dialog wrapper. The wrapping panel owns the dialog chrome.
// Renders:
//   1. Unified score (from getScoreDetails on the primary candidate)
//   2. Per-algorithm raw scores (one row per contributing algorithm — covers
//      multi-algo convergence where both ocl-search and a custom algo found
//      the same concept)
//   3. Matched attributes (search highlights from the primary candidate)
//
// Props:
//   concept           — legacy concept shape with search_meta.search_highlight
//                       (the click target / primary candidate)
//   contributingAlgorithms — optional array of {algorithm_id, rawScore} from
//                       buildQualityRowViews. When present, renders one
//                       chip-row per algorithm; when absent, falls back to
//                       the single algo from concept.search_meta.
//   candidatesScore   — project-level recommended/available thresholds for
//                       qualityBucket lookup
const MatchDetailsPanel = ({concept, contributingAlgorithms, candidatesScore}) => {
  const { t } = useTranslation()
  const highlight = concept?.search_meta?.search_highlight || {}
  const { hasPercentile, bucketColor, rerankScore } = getScoreDetails(concept, candidatesScore)

  // Build the per-algorithm score rows. Prefer the multi-algo enrichment
  // when available; fall back to the single algo on the concept itself for
  // bare clicks (e.g. Search tab → no row enrichment).
  let rawScores = []
  if(contributingAlgorithms && contributingAlgorithms.length) {
    rawScores = contributingAlgorithms
      .map(c => {
        const n = parseFloat(c.rawScore)
        return Number.isFinite(n) ? { algorithm: c.algorithm_id, score: n.toFixed(2) } : null
      })
      .filter(Boolean)
  } else {
    const single = parseFloat(concept?.search_meta?.search_score)
    if(Number.isFinite(single) && concept?.search_meta?.algorithm)
      rawScores = [{ algorithm: concept.search_meta.algorithm, score: single.toFixed(2) }]
  }

  const hasAnyMatchData = hasPercentile || rawScores.length > 0 || Object.keys(highlight).length > 0

  if(!hasAnyMatchData) {
    return (
      <Stack spacing={2.5} sx={{padding: 3}}>
        <Typography sx={{fontSize: '13px', color: 'surface.light', fontStyle: 'italic'}}>
          {t('search.no_match_metrics')}
        </Typography>
      </Stack>
    )
  }

  return (
    <Stack spacing={2.5} sx={{padding: 3, maxHeight: 'calc(100vh - 320px)', overflow: 'auto'}}>
      <Stack
        spacing={1.25}
        sx={{
          alignSelf: 'flex-start',
          minWidth: { xs: '100%', sm: 'auto' },
          maxWidth: '100%',
          padding: '12px 14px',
          borderRadius: '16px',
          backgroundColor: 'rgba(255, 255, 255, 0.4)',
          border: '1px solid rgba(0, 0, 0, 0.08)'
        }}
      >
        {
          hasPercentile &&
            <Stack
              direction='row'
              spacing={1.5}
              alignItems='center'
              justifyContent='space-between'
              sx={{ minWidth: { sm: '260px' } }}
            >
              <Typography sx={{fontSize: '12px', color: 'surface.light', fontWeight: 600, whiteSpace: 'nowrap'}}>
                {t('search.search_score')}
              </Typography>
              <ScoreValueChip size='small' bucketColor={bucketColor} label={rerankScore} />
            </Stack>
        }

        <Stack spacing={0.75}>
          <Stack
            direction='row'
            spacing={1.5}
            alignItems='flex-start'
            justifyContent='space-between'
            sx={{ minWidth: { sm: '260px' } }}
          >
            <Typography sx={{fontSize: '12px', color: 'surface.light', fontWeight: 600, whiteSpace: 'nowrap', paddingTop: '4px'}}>
              {t('search.search_raw_score')}
            </Typography>
            {
              rawScores.length ? (
                <Stack spacing={0.75} alignItems='flex-end'>
                  {map(rawScores, (rawScore, index) => (
                    <RawScoreRow
                      key={`${rawScore.algorithm}-${rawScore.score}-${index}`}
                      algorithm={rawScore.algorithm}
                      score={rawScore.score}
                    />
                  ))}
                </Stack>
              ) : (
                <Typography sx={{fontSize: '13px', color: 'surface.light', textAlign: 'right', paddingTop: '4px'}}>
                  {t('common.none')}
                </Typography>
              )
            }
          </Stack>
        </Stack>
      </Stack>

      {
        Object.keys(highlight).length > 0 && (
          <>
            <Divider />
            <Stack spacing={1.5}>
              <Typography sx={{fontSize: '16px', color: 'surface.dark', fontWeight: 700}}>
                {t('search.matched_attributes')}
              </Typography>
              {
                map(highlight, (values, key) => (
                  <Box key={key}>
                    <Typography sx={{fontSize: '12px', color: 'surface.light', fontWeight: 600, marginBottom: 0.75}}>
                      {startCase(key)}
                    </Typography>
                    <Stack
                      spacing={1}
                      sx={{
                        paddingLeft: 1,
                        '& b': { color: 'surface.dark', fontWeight: 700 }
                      }}
                    >
                      {
                        map(values, value => {
                          const highlightedValue = value.replaceAll('<em>', '<b>').replaceAll('</em>', '</b>')
                          return (
                            // Match the Concept Details Names/Descriptions typography
                            // (Locales.jsx LocalePrimary): 0.875rem, primary text,
                            // normal line-height — was previously cramped (12px / 0.95)
                            // for synonyms, which made multi-line values overlap.
                            <Typography
                              key={value}
                              sx={{
                                color: '#000000de',
                                fontSize: '0.875rem',
                                lineHeight: 1.5
                              }}
                              dangerouslySetInnerHTML={{__html: highlightedValue}}
                            />
                          )
                        })
                      }
                    </Stack>
                  </Box>
                ))
              }
            </Stack>
          </>
        )
      }
    </Stack>
  )
}

export default MatchDetailsPanel
