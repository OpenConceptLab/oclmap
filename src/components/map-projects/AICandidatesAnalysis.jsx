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
import CloseIcon from '@mui/icons-material/Close'
import DataObjectIcon from '@mui/icons-material/DataObject';

import get from 'lodash/get'
import map from 'lodash/map'
import compact from 'lodash/compact'

import Comment from './Comment'


const AICandidatesAnalysis = ({ analysis, onClose, sx, isCoreUser }) => {
  const { t } = useTranslation();
  const [openDetails, setOpenDetails] = React.useState(false)
  let output = analysis?.output || analysis

  const getRecommendationTitle = () => {
    let recommendation = output?.recommendation
    if(recommendation && output?.primary_candidate?.match_strength){
      recommendation += ` (${output.primary_candidate.match_strength})`
    }
    return recommendation
  }

  const getAlternateIds = () => {
    const alternates = output?.alternative_candidates || []
    return compact(map(alternates, a => a?.concept_id || a?.id)).join(', ')
  }

  return (
    <>
      <Comment
        sx={sx}
        headerSx={{backgroundColor: 'rgb(238, 238, 238)', padding: '0 2px 0 6px'}}
        footerSx={{backgroundColor: 'rgb(238, 238, 238)', padding: 0}}
        bodySx={{padding: '6px'}}
        header={
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
            <Typography gutterBottom sx={{ color: 'text.secondary', fontSize: 12, mb: 0 }} component='span'>
              <b style={{color: '#000'}}>{t('map_project.ocl_ai_assistant')}</b>
              <span style={{marginLeft: '4px', fontSize: '12px'}}>
                {analysis?.timestamp ? moment(analysis.timestamp).fromNow() : ''}
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
            <Typography gutterBottom component='p' sx={{mb: 0, fontSize: 12, marginTop: '-2px'}}>
              {get(output, 'rationale.narrative') || get(output, 'rationale')}
            </Typography>
          </>
        }
        footer={
          <div className='col-xs-12' style={{padding: '0 2px 0 6px', background: 'rgb(238, 238, 238)', display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
            <span>
              <span style={{marginRight: '4px', display: 'inline-flex'}}>
                <Typography gutterBottom sx={{ color: 'text.secondary', fontSize: 12, mb: 0 }} component='span'>
                  {t('map_project.assessment')}:
                </Typography>
                <Typography gutterBottom sx={{ color: 'text.primary', fontSize: 12, mb: 0 }} component='span'>
                  {output?.recommendation ? getRecommendationTitle() : <i>NA</i>}
                </Typography>
              </span>
              <span style={{marginRight: '4px', display: 'inline-flex'}}>
                <Typography gutterBottom sx={{ color: 'text.secondary', fontSize: 12, mb: 0 }} component='span'>
                  {t('map_project.primary')}:
                </Typography>
                <Typography gutterBottom sx={{ color: 'text.primary', fontSize: 12, mb: 0 }} component='span'>
                  {output?.primary_candidate?.concept_id || output?.primary_candidate?.id || '-'}
                </Typography>
              </span>
              <span style={{marginRight: '4px', display: 'inline-flex'}}>
                <Typography gutterBottom sx={{ color: 'text.secondary', fontSize: 12, mb: 0 }} component='span'>
                  {t('map_project.alternates')}:
                </Typography>
                <Typography gutterBottom sx={{ color: 'text.primary', fontSize: 12, mb: 0 }} component='span'>
                  {getAlternateIds() || '-'}
                </Typography>
              </span>
              <span style={{marginRight: '4px', display: 'inline-flex'}}>
                <Typography gutterBottom sx={{ color: 'text.secondary', fontSize: 12, mb: 0 }} component='span'>
                  {t('map_project.model')}:
                </Typography>
                <Typography gutterBottom sx={{ color: 'text.primary', fontSize: 12, mb: 0 }} component='span'>
                  {analysis?.model_name || analysis?.model || '-'}
                </Typography>
              </span>
              <span style={{marginRight: '4px', display: 'inline-flex'}}>
                <Typography gutterBottom sx={{ color: 'text.secondary', fontSize: 12, mb: 0 }} component='span'>
                  {t('map_project.ai_prompt_template')}:
                </Typography>
                <Typography gutterBottom sx={{ color: 'text.primary', fontSize: 12, mb: 0 }} component='span'>
                  {analysis?.prompt_template?.key ? `${analysis.prompt_template.key} (${t('common.version')}: ${analysis.prompt_template.version || '-'})` : '-'}
                </Typography>
              </span>
              {
                analysis?.prompt_template_uri &&
                  <span style={{marginRight: '4px', display: 'inline-flex'}}>
                    <Typography gutterBottom sx={{ color: 'text.secondary', fontSize: 12, mb: 0 }} component='span'>
                      URI:
                    </Typography>
                    <Typography gutterBottom sx={{ color: 'text.primary', fontSize: 12, mb: 0 }} component='span'>
                      {analysis.prompt_template_uri}
                    </Typography>
                  </span>
              }
              <span style={{marginRight: '4px', display: 'inline-flex'}}>
                <Typography gutterBottom sx={{ color: 'text.secondary', fontSize: 12, mb: 0 }} component='span'>
                  {t('map_project.requested_by')}:
                </Typography>
                <Typography gutterBottom sx={{ color: 'text.primary', fontSize: 12, mb: 0 }} component='span'>
                  {analysis?.user || '-'}
                </Typography>
              </span>
            </span>
            <span>
              <>
                {
                  isCoreUser &&
                    <Tooltip title={t('map_project.view_raw_json')} placement='right'>
                      <span>
                        <IconButton color='primary' size='small' disabled={!analysis} sx={{padding: '4px', marginLeft: '4px', marginTop: '-2px'}} onClick={() => setOpenDetails(!openDetails)}>
                          <DataObjectIcon fontSize='inherit' />
                        </IconButton>
                      </span>
                    </Tooltip>
                }
              </>
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
