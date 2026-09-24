import React from 'react'
import { useTranslation } from 'react-i18next'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'

import CloseIconButton from '../common/CloseIconButton'
import { PREVIEW_LIMIT_COPY_KEY } from './previewLimits'

const REQUEST_ACCESS_MAILTO = 'mailto:jonathan@openconceptlab.org?subject=' +
  encodeURIComponent('OCL Mapper preview - request more access')
const NOTIFY_ME_MAILTO = 'mailto:jonathan@openconceptlab.org?subject=' +
  encodeURIComponent('OCL Mapper - notify me when plans launch')

// R12: at the limit, offer "request more access" (creates a lead) and "notify me
// when plans launch" - there is no checkout until November, so neither button
// takes a payment. ocl_online#170 has not finalized the shared lead-capture
// destination yet, so these mailto links are the recorded interim choice.
// One-time allowance (R2): no reset date is ever shown here.
const PreviewLimitDialog = ({open, onClose, errorCode, limit, used}) => {
  const { t } = useTranslation()
  const kind = PREVIEW_LIMIT_COPY_KEY[errorCode] || 'generic'

  return (
    <Dialog open={open} onClose={onClose} maxWidth='xs' fullWidth>
      <DialogTitle sx={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
        {t(`map_project.preview_limit_title_${kind}`)}
        <CloseIconButton onClick={onClose} />
      </DialogTitle>
      <DialogContent>
        <Typography variant='body1' sx={{mb: 2}}>
          {
            (limit || limit === 0) ?
              t(`map_project.preview_limit_body_${kind}`, {limit, used}) :
              t(`map_project.preview_limit_body_${kind}_no_count`)
          }
        </Typography>
        <Typography variant='body2' color='text.secondary'>
          {t('map_project.preview_limit_hardship_note')}
        </Typography>
      </DialogContent>
      <DialogActions sx={{flexWrap: 'wrap', gap: 1, px: 3, pb: 2}}>
        <Button href={NOTIFY_ME_MAILTO} variant='contained' color='primary' sx={{textTransform: 'none'}}>
          {t('map_project.preview_limit_notify_me')}
        </Button>
        <Button href={REQUEST_ACCESS_MAILTO} variant='text' sx={{textTransform: 'none'}}>
          {t('map_project.preview_limit_request_access')}
        </Button>
        <Button onClick={onClose} variant='text' color='inherit' sx={{textTransform: 'none', ml: 'auto'}}>
          {t('map_project.preview_limit_dismiss')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default PreviewLimitDialog
