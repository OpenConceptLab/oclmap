import React from 'react'
import moment from 'moment'
import { useTranslation } from 'react-i18next';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton'
import Dialog from '@mui/material/Dialog'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import DialogTitle from '@mui/material/DialogTitle'
import Button from '@mui/material/Button'
import Tooltip from '@mui/material/Tooltip'
import Skeleton from '@mui/material/Skeleton'
import Link from '@mui/material/Link'
import CloseIcon from '@mui/icons-material/Close'
import DataObjectIcon from '@mui/icons-material/DataObject';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

import get from 'lodash/get'
import map from 'lodash/map'
import compact from 'lodash/compact'

import { getCurrentUser } from '../../common/utils'
import Comment from './Comment'
import { canSeeAIInternals } from './aiVisibility'
import ReactMarkdown from 'react-markdown'

// Markdown paragraphs/lists inside the 12px clamped narrative: no extra margins, links open safely.
const narrativeComponents = {
  p: ({children}) => <p style={{margin: 0}}>{children}</p>,
  ul: ({children}) => <ul style={{margin: 0, paddingLeft: '18px'}}>{children}</ul>,
  ol: ({children}) => <ol style={{margin: 0, paddingLeft: '18px'}}>{children}</ol>,
  a: ({children, href}) => <a href={href} target='_blank' rel='noopener noreferrer'>{children}</a>
}

const Field = ({ label, children }) => (
  <span style={{marginRight: '8px', display: 'inline-flex'}}>
    <Typography sx={{ color: 'text.secondary', fontSize: 12 }} component='span'>{label}:&nbsp;</Typography>
    <Typography sx={{ color: 'text.primary', fontSize: 12 }} component='span'>{children}</Typography>
  </span>
)


const AICandidatesAnalysis = ({ analysis: analysisProp, onClose, sx, isInProgress, page = 0, onPageChange }) => {
  const { t } = useTranslation();
  const [openDetails, setOpenDetails] = React.useState(false)
  // The model, the prompt template and the raw JSON are staff-only
  // (ocl_online#254); everyone else sees the assessment and candidates.
  const isStaff = canSeeAIInternals(getCurrentUser())

  const analysisArray = Array.isArray(analysisProp) ? analysisProp : (analysisProp ? [analysisProp] : [])
  const total = analysisArray.length
  const effectiveTotal = total + (isInProgress ? 1 : 0)

  const isPendingPage = isInProgress && page >= total
  const analysis = isPendingPage ? undefined : analysisArray[page]
  let output = analysis?.output || analysis

  const rationale = get(output, 'rationale.narrative') || get(output, 'rationale')
  const narrative = typeof rationale === 'string' ? rationale : undefined

  const [expanded, setExpanded] = React.useState(false)
  const [isClamped, setIsClamped] = React.useState(false)
  const narrativeRef = React.useRef(null)

  // Collapse again when paging to another analysis.
  React.useEffect(() => setExpanded(false), [page])
  // Offer "More" only when the clamped text actually overflows.
  React.useLayoutEffect(() => {
    const el = narrativeRef.current
    if(el && !expanded)
      setIsClamped(el.scrollHeight > el.clientHeight + 1)
  }, [narrative, expanded, page])

  const getRecommendationTitle = () => {
    let recommendation = output?.recommendation
    if(recommendation && output?.primary_candidate?.match_strength){
      recommendation += ` (${output.primary_candidate.match_strength})`
    }
    return recommendation
  }

  const getAlternateIds = () => {
    const alternates = output?.alternative_candidates || []
    return compact(map(alternates, a => a?.canonical_reference?.code)).join(', ')
  }

  return (
    <>
      <Comment
        sx={sx}
        headerSx={{backgroundColor: 'rgb(238, 238, 238)', padding: '0 2px 0 6px'}}
        footerSx={{backgroundColor: 'rgb(238, 238, 238)', padding: 0}}
        bodySx={{padding: '4px 6px'}}
        header={
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
            <Typography gutterBottom sx={{ color: 'text.secondary', fontSize: 12, mb: 0 }} component='span'>
              <b style={{color: '#000'}}>{t('map_project.ocl_ai_assistant')}</b>
              <span style={{marginLeft: '4px', fontSize: '12px'}}>
                {[analysis?.user, analysis?.timestamp ? moment(analysis.timestamp).fromNow() : ''].filter(Boolean).join(' ')}
              </span>
            </Typography>
            <IconButton onClick={onClose} size='small' color='secondary' sx={{padding: '4px'}}>
              <CloseIcon sx={{fontSize: '1rem'}} />
            </IconButton>
          </div>
        }
        body={
          analysis === undefined ?
            <Skeleton height={75} sx={{'-webkit-transform': 'none', 'transform': 'none'}} /> :
          <>
            <div style={{display: 'flex', flexWrap: 'wrap', marginBottom: '2px'}}>
              <Field label={t('map_project.assessment')}>
                {output?.recommendation ? getRecommendationTitle() : <i>NA</i>}
              </Field>
              <Field label={t('map_project.primary')}>
                {output?.primary_candidate?.canonical_reference?.code || '-'}
              </Field>
              <Field label={t('map_project.alternates')}>
                {getAlternateIds() || '-'}
              </Field>
            </div>
            <div style={{position: 'relative'}}>
              <Typography
                ref={narrativeRef}
                gutterBottom
                component='div'
                sx={{
                  mb: 0, fontSize: 12, lineHeight: 1.4, marginTop: '-2px',
                  ...(expanded ? {} : {display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden'})
                }}>
                <ReactMarkdown components={narrativeComponents}>{narrative || ''}</ReactMarkdown>
              </Typography>
              {
                // Collapsed: sits over the end of the last visible line, so it adds no extra line.
                (isClamped && !expanded) &&
                  <Link component='button' type='button' underline='hover' onClick={() => setExpanded(true)}
                    sx={{position: 'absolute', right: 0, bottom: 0, fontSize: 12, lineHeight: 1.4, backgroundColor: '#FFF', paddingLeft: '6px', verticalAlign: 'baseline'}}>
                    {t('common.more')}
                  </Link>
              }
            </div>
            {
              expanded &&
                <Link component='button' type='button' underline='hover' sx={{fontSize: 12}} onClick={() => setExpanded(false)}>
                  {t('common.less')}
                </Link>
            }
          </>
        }
        footer={
          <div className='col-xs-12' style={{padding: '0 2px 0 6px', background: 'rgb(238, 238, 238)', display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
            <span>
              {
                isStaff &&
                  <span style={{marginRight: '4px', display: 'inline-flex'}}>
                    <Typography gutterBottom sx={{ color: 'text.secondary', fontSize: 12, mb: 0 }} component='span'>
                      {t('map_project.model')}:&nbsp;
                    </Typography>
                    <Typography gutterBottom sx={{ color: 'text.primary', fontSize: 12, mb: 0 }} component='span'>
                      {analysis?.model_name || analysis?.model || '-'}
                    </Typography>
                  </span>
              }
              {
                isStaff &&
                  <span style={{marginRight: '4px', display: 'inline-flex'}}>
                    <Typography gutterBottom sx={{ color: 'text.secondary', fontSize: 12, mb: 0 }} component='span'>
                      {t('map_project.ai_prompt_template')}:&nbsp;
                    </Typography>
                    <Typography gutterBottom sx={{ color: 'text.primary', fontSize: 12, mb: 0 }} component='span'>
                      {analysis?.prompt_template?.key ? `${analysis.prompt_template.key} (${t('common.version')}: ${analysis.prompt_template.version || '-'})` : '-'}
                    </Typography>
                  </span>
              }
              {
                analysis?.output_locale &&
                  <span style={{marginRight: '4px', display: 'inline-flex'}}>
                    <Typography gutterBottom sx={{ color: 'text.secondary', fontSize: 12, mb: 0 }} component='span'>
                      {t('map_project.output_locale')}:&nbsp;
                    </Typography>
                    <Typography gutterBottom sx={{ color: 'text.primary', fontSize: 12, mb: 0 }} component='span'>
                      {analysis.output_locale}
                    </Typography>
                  </span>
              }
            </span>
            <span style={{display: 'inline-flex', alignItems: 'center'}}>
              {
                effectiveTotal > 1 &&
                  <span style={{display: 'inline-flex', alignItems: 'center', fontSize: '12px', marginRight: '4px'}}>
                    <IconButton size='small' sx={{padding: '2px', color: 'text.primary'}} onClick={() => onPageChange?.(Math.max(0, page - 1))} disabled={page === 0}>
                      <ChevronLeftIcon sx={{fontSize: '1rem'}} />
                    </IconButton>
                    <b style={{fontSize: '12px'}}>{page + 1}/{effectiveTotal}</b>
                    <IconButton size='small' sx={{padding: '2px', color: 'text.primary'}} onClick={() => onPageChange?.(Math.min(effectiveTotal - 1, page + 1))} disabled={page === effectiveTotal - 1}>
                      <ChevronRightIcon sx={{fontSize: '1rem'}} />
                    </IconButton>
                  </span>
              }
              {
                isStaff &&
                  <Tooltip title={t('map_project.view_raw_json')} placement='right'>
                    <span>
                      <IconButton color='primary' size='small' disabled={!analysis} sx={{padding: '4px', marginLeft: '4px', marginTop: '-2px'}} onClick={() => setOpenDetails(!openDetails)}>
                        <DataObjectIcon fontSize='inherit' />
                      </IconButton>
                    </span>
                  </Tooltip>
              }
            </span>
          </div>
        }
      />
      <Dialog
        open={openDetails}
        onClose={() => setOpenDetails(false)}
        scroll='paper'
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

        <DialogTitle sx={{p: 3, color: 'surface.dark', fontSize: '22px', textAlign: 'left'}}>
          {t('map_project.ocl_ai_candidates_analysis')}
        </DialogTitle>
        <DialogContent>
          <pre style={{fontSize: '12px', whiteSpace: 'pre-wrap', wordWrap: 'break-word'}}>
            {JSON.stringify(analysis, undefined, 2)}
          </pre>
        </DialogContent>
        <DialogActions sx={{p: 3}}>
          <Button onClick={() => setOpenDetails(false)}>{t('common.close')}</Button>
        </DialogActions>
      </Dialog>
    </>
)
}

export default AICandidatesAnalysis
