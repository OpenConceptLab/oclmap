import React from 'react'
import { useTranslation } from 'react-i18next';
import { SCORES_COLOR } from './constants'
import ListItem from '@mui/material/ListItem'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import Tooltip from '@mui/material/Tooltip'
import Chip from '@mui/material/Chip'
import Box from '@mui/material/Box'
import AssistantIcon from '@mui/icons-material/Assistant';

import ConceptIcon from '../concepts/ConceptIcon'
import { getScoreDetails as pureGetScoreDetails } from './viewBuilders.js'


// Wrap the pure getScoreDetails (from viewBuilders.js) with the
// SCORES_COLOR mapping. The pure function is testable without React/JSX
// imports; this wrapper layers on the UI color affordance.
export const getScoreDetails = (input, candidatesScore) => {
  const details = pureGetScoreDetails(input, candidatesScore)
  return { ...details, bucketColor: details.qualityBucket ? SCORES_COLOR[details.qualityBucket] : false }
}

export const ScoreValueChip = ({ bucketColor, label, size='medium', showIndicator=true, sx }) => (
  <Chip
    size={size}
    icon={
      showIndicator ? (
        <Box sx={{
               border: '1px solid',
               borderColor: '#FFF',
               borderRadius: '50%',
               display: 'inline-flex',
             }}>
          <ConceptIcon fontSize='small' selected sx={{fill: bucketColor || 'rgba(0, 0, 0, 0.5)', fontSize: '1rem'}} />
        </Box>
      ) : undefined
    }
    label={label}
    sx={sx}
  />
)

const Score = ({candidate, conceptRow, onScoreClick, sx, isAIRecommended, isAIAlternate, candidatesScore, algoScoreFirst, size, secondaryScoreText}) => {
  const { t } = useTranslation();
  const {
    score,
    hasPercentile,
    bucketColor,
    rerankScore,
    algoScore
  } = getScoreDetails({candidate, conceptRow}, candidatesScore)
  const hasRawScore = algoScore !== '' && score !== null

  return (
    <ListItem disablePadding sx={{display: 'inline-flex', width: 'auto'}}>
      <ListItemButton
        sx={{color: bucketColor || 'rgba(0, 0, 0, 0.5)', padding: '0px', ...sx}}
        size='small'
        disabled={!hasRawScore && !hasPercentile}
        onClick={onScoreClick ? (event) => {
          event.preventDefault()
          event.stopPropagation()
          // Opens the unified ConceptDetailsPanel with the Match Details
          // tab focused (caller-supplied).
          onScoreClick(event)
          return false
        } : undefined}
      >
        {
          isAIRecommended || isAIAlternate ?
            <Tooltip title={isAIRecommended ? t('map_project.ai_recommended') : t('map_project.ai_alternate')}>
              <ListItemIcon sx={{minWidth: 'auto', marginRight: '6px'}}>
                <AssistantIcon color={isAIRecommended ? 'primary' : 'warning'} fontSize='small' sx={{marginRight: '4px'}} />
              </ListItemIcon>
            </Tooltip> :
          null
        }
        <ListItemText
          sx={{margin: 0, '.MuiListItemText-primary': {fontSize: '14px'}, '.MuiListItemText-secondary': {fontSize: '12px'}}}
          primary={
            <ScoreValueChip
              size={size || 'medium'}
              bucketColor={bucketColor}
              label={
                <span style={{display: 'flex', alignItems: 'center'}}>
                  <span>
                    {
                      // Unified view normally shows the rerank percentile, but
                      // rerank lands asynchronously after the raw algorithm
                      // search. Until it does, fall back to the raw score so a
                      // candidate isn't shown as a blank "—" — the chip swaps to
                      // the percentile once rerank completes.
                      algoScoreFirst && hasRawScore
                        ? algoScore
                        : (rerankScore || (hasRawScore ? algoScore : <span style={{opacity: 0.4}}>—</span>))
                    }
                  </span>
                  {
                    secondaryScoreText ?
                      <span style={{fontSize: '12px', color: 'rgba(0, 0, 0, 0.6)', marginLeft: '4px', fontStyle: 'italic'}}>
                        {secondaryScoreText}
                      </span> :
                    hasPercentile && hasRawScore ?
                      <span style={{fontSize: '12px', color: 'rgba(0, 0, 0, 0.6)', marginLeft: '4px', fontStyle: 'italic'}}>
                        {`(${algoScoreFirst && hasRawScore ? rerankScore : algoScore})`}
                      </span> :
                    ''
                  }
                </span>
              }
            />
          }
        />
      </ListItemButton>
    </ListItem>
  )
}

export default Score
