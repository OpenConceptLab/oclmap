import React from 'react';
import { useTranslation } from 'react-i18next'

import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Dialog from '@mui/material/Dialog'
import DialogContent from '@mui/material/DialogContent'
import Divider from '@mui/material/Divider'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'

import isArray from 'lodash/isArray'
import map from 'lodash/map'
import startCase from 'lodash/startCase'

import { getScoreDetails, ScoreValueChip } from '../map-projects/Score'
import CloseIconButton from '../common/CloseIconButton'

const SearchHighlightsDialog = ({onClose, concept, rawScores, candidatesScore, open}) => {
  const { t } = useTranslation()
  const highlight = concept?.search_meta?.search_highlight || {}
  const { hasPercentile, bucketColor, rerankScore } = getScoreDetails(concept, candidatesScore)

  return (
    <Dialog
      open={Boolean(open)}
      onClose={onClose}
      scroll='paper'
      fullWidth
      maxWidth='sm'
      sx={{
        '& .MuiDialog-paper': {
          backgroundColor: 'surface.n92',
          borderRadius: '28px',
          minWidth: '312px',
          minHeight: '262px',
          padding: 0
        }
      }}
    >
      <DialogContent sx={{padding: 3, maxHeight: 700}}>
        <Stack spacing={2.5}>
          <Stack direction='row' justifyContent='space-between' alignItems='center' spacing={2}>
            <Typography sx={{color: 'surface.dark', fontSize: '22px', lineHeight: 1.2}}>
              {t('search.search_highlight')}
            </Typography>
            <CloseIconButton size='small' onClick={onClose} sx={{alignSelf: 'flex-start'}} />
          </Stack>

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
                  rawScores?.length ? (
                    <Stack spacing={0.75} alignItems='flex-end'>
                      {map(rawScores, (rawScore, index) => (
                        <Stack
                          key={`${rawScore.algorithm}-${rawScore.score}-${index}`}
                          direction='row'
                          spacing={0.75}
                          alignItems='center'
                          sx={{
                            flexWrap: 'nowrap',
                            width: 'fit-content'
                          }}
                        >
                          <Chip size='small' label={rawScore.algorithm} variant='outlined' color='warning' />
                          <ScoreValueChip
                            size='small'
                            showIndicator={false}
                            label={rawScore.score}
                            sx={{
                              backgroundColor: 'rgba(0, 0, 0, 0.08)',
                              color: 'surface.dark',
                              fontWeight: 600
                            }}
                          />
                        </Stack>
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
                    spacing={isArray(values) && key === 'synonyms' ? 1.25 : 0.75}
                    sx={{
                      paddingLeft: 1,
                      '& b': {
                        color: 'surface.dark'
                      }
                    }}
                  >
                    {
                      map(values, value => {
                        const highlightedValue = value.replaceAll('<em>', '<b>').replaceAll('</em>', '</b>')
                        return (
                          <Typography
                            key={value}
                            sx={{
                              color: 'text.primary',
                              fontSize: key === 'synonyms' ? '12px' : '13px',
                              lineHeight: key === 'synonyms' ? 0.95 : 1.3
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
        </Stack>
      </DialogContent>
    </Dialog>
  )
}

export default SearchHighlightsDialog
