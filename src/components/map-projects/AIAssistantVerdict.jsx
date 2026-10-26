import React from 'react'
import { useTranslation } from 'react-i18next';
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import IconButton from '@mui/material/IconButton'
import Link from '@mui/material/Link'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import AssistantIcon from '@mui/icons-material/Assistant';

import { getScoreDetails } from './viewBuilders.js'

// How the grid and the candidates panel put a row's recommendation
// (getRowRecommendation, OpenConceptLab/ocl_issues#2908) into words.

const codeOf = view => view?.conceptDefinition?.id || view?.conceptDefinition?.reference?.code
const outputOf = recommendation => recommendation?.analysis?.output || recommendation?.analysis
// The code the OCL AI Assistant named, also when it isn't one of the candidates.
const pickCodeOf = recommendation => codeOf(recommendation?.pick) || outputOf(recommendation)?.primary_candidate?.canonical_reference?.code

const CONFIDENCES = ['high', 'medium', 'low']
const describeConfidence = (t, recommendation) => {
  const confidence = recommendation?.confidence?.toLowerCase()
  return CONFIDENCES.includes(confidence) ? t(`map_project.ai_confidence_${confidence}`) : null
}

const describeTopScore = (t, top, candidatesScore) => {
  if(!top) return t('map_project.ai_no_top_score')
  const { qualityBucket, rerankScore } = getScoreDetails({candidate: top.candidate, conceptRow: top.conceptRow}, candidatesScore)
  return t('map_project.ai_top_score', {code: codeOf(top), bucket: t(`map_project.${qualityBucket}`), score: rerankScore})
}

const describePickRank = (t, recommendation) => recommendation.pickRank ?
  t('map_project.ai_pick_rank', {code: pickCodeOf(recommendation), rank: recommendation.pickRank}) :
  t('map_project.ai_pick_unscored', {code: pickCodeOf(recommendation)})

const describeVerdict = (t, recommendation) => {
  const code = pickCodeOf(recommendation)
  const confidence = describeConfidence(t, recommendation)
  const withConfidence = text => confidence ? `${text} (${confidence})` : text
  switch(recommendation?.verdict) {
    case 'RECOMMEND': return code ? withConfidence(t('map_project.ai_summary_recommend', {code})) : t('map_project.ai_summary_no_pick')
    case 'CONDITIONAL': return code ? withConfidence(t('map_project.ai_summary_conditional', {code})) : t('map_project.ai_summary_no_pick')
    case 'REJECT': return t('map_project.ai_summary_reject')
    case 'INSUFFICIENT': return t('map_project.ai_summary_insufficient')
    default: return ''
  }
}

const describeRelation = (t, recommendation) => {
  switch(recommendation?.agreement) {
    case 'agrees': return t('map_project.ai_summary_agree')
    case 'different_pick': return recommendation.pickRank ?
      t('map_project.ai_summary_differ_rank', {rank: recommendation.pickRank}) :
      t('map_project.ai_summary_differ_unscored')
    case 'no_match':
    case 'not_enough': return t('map_project.ai_summary_no_proposal')
    case 'out_of_date': return t('map_project.ai_out_of_date_help')
    case 'pick_not_candidate': return t('map_project.ai_pick_not_candidate_help')
    default: return ''
  }
}

// The status label, also the column's value for sorting and filtering.
export const getAIStatusLabel = (t, status, recommendation) => {
  if(!status) return ''
  const label = t(`map_project.ai_status_${status}`)
  return recommendation?.conditional && ['agrees', 'different_pick'].includes(status) ?
    `${label} (${t('map_project.ai_conditional')})` : label
}

const STATUS_COLORS = {
  agrees: 'primary',
  different_pick: 'warning',
  pick_not_candidate: 'warning',
  no_match: 'error',
  not_enough: 'error',
}

// The tooltip names the other side: the top score, and where the pick ranks.
const getStatusTooltip = (t, status, recommendation, candidatesScore) => {
  if(status === 'out_of_date') return t('map_project.ai_out_of_date_help')
  if(status === 'pick_not_candidate') return t('map_project.ai_pick_not_candidate_help')
  const lines = [describeTopScore(t, recommendation?.top, candidatesScore)]
  if(status === 'different_pick') lines.push(describePickRank(t, recommendation))
  const confidence = describeConfidence(t, recommendation)
  if(confidence) lines.push(confidence)
  return lines.map(line => <div key={line}>{line}</div>)
}

/**
 * The grid's "OCL AI Assistant" cell: running, failed (click to retry), or
 * the agreement state, with the other side in its tooltip.
 */
export const AIAssistantStatusCell = ({ status, recommendation, candidatesScore, onRetry }) => {
  const { t } = useTranslation();
  if(!status) return null
  if(status === 'running')
    return (
      <Tooltip title={t('map_project.ai_recommendation_running')}>
        <span style={{display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px'}}>
          <CircularProgress size={14} />
          {getAIStatusLabel(t, status)}
        </span>
      </Tooltip>
    )
  if(status === 'failed')
    return (
      <Tooltip title={t('map_project.ai_recommendation_failed_retry')}>
        <IconButton size='small' sx={{padding: '4px', fontSize: '13px', borderRadius: '8px'}} onClick={event => { event.stopPropagation(); onRetry?.() }}>
          <AssistantIcon color='error' fontSize='small' sx={{marginRight: '4px'}} />
          {getAIStatusLabel(t, status)}
        </IconButton>
      </Tooltip>
    )
  return (
    <Tooltip title={getStatusTooltip(t, status, recommendation, candidatesScore)}>
      <Chip
        size='small'
        label={getAIStatusLabel(t, status, recommendation)}
        color={STATUS_COLORS[status] || 'default'}
        variant='outlined'
      />
    </Tooltip>
  )
}

/**
 * The candidates panel's summary line: the OCL AI Assistant's verdict in plain
 * words, its pick and the top score, and whether they differ. Shown whenever
 * the row has an analysis.
 */
export const AIAssistantSummary = ({ recommendation, candidatesScore, onReadAnalysis, sx }) => {
  const { t } = useTranslation();
  if(!recommendation?.verdict) return null
  const text = t('map_project.ai_summary', {
    verdict: describeVerdict(t, recommendation),
    topScore: describeTopScore(t, recommendation.top, candidatesScore),
    relation: describeRelation(t, recommendation),
  })
  return (
    <div style={{display: 'flex', alignItems: 'flex-start', gap: '6px', padding: '6px 8px', margin: '4px 0', borderRadius: '8px', backgroundColor: 'rgb(238, 238, 238)', ...sx}} id='ai-assistant-summary'>
      <AssistantIcon color='primary' sx={{fontSize: '1rem', marginTop: '1px'}} />
      <Typography component='span' sx={{fontSize: 12, lineHeight: 1.4}}>
        {text}
        {
          onReadAnalysis &&
            <Link component='button' type='button' underline='hover' onClick={onReadAnalysis} sx={{fontSize: 12, marginLeft: '6px', verticalAlign: 'baseline'}}>
              {t('map_project.read_analysis')}
            </Link>
        }
      </Typography>
    </div>
  )
}
