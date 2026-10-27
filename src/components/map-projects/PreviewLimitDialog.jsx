import React from 'react'
import { useTranslation } from 'react-i18next'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'

import CloseIconButton from '../common/CloseIconButton'
import useLimitAction from '../common/useLimitAction'
import { PREVIEW_LIMIT_COPY_KEY } from './previewLimits'

// Says what the account can't use. Any next step comes from the connected
// service (OpenConceptLab/ocl_online#367) and opens in a new tab.
const PreviewLimitDialog = ({open, onClose, errorCode}) => {
  const { t } = useTranslation()
  const { action, onActionClick } = useLimitAction(open, errorCode)
  const kind = PREVIEW_LIMIT_COPY_KEY[errorCode] || 'generic'

  return (
    <Dialog open={open} onClose={onClose} maxWidth='xs' fullWidth>
      <DialogTitle sx={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
        {t('map_project.limit_unavailable_title')}
        <CloseIconButton onClick={onClose} />
      </DialogTitle>
      <DialogContent>
        <Typography variant='body1'>
          {t([`map_project.limit_unavailable_body_${kind}`, 'map_project.limit_unavailable_body_generic'])}
        </Typography>
        {
          action?.message &&
            <Typography variant='body1' sx={{mt: 2}}>{action.message}</Typography>
        }
      </DialogContent>
      <DialogActions sx={{flexWrap: 'wrap', gap: 1, px: 3, pb: 2}}>
        {
          action &&
            <Button href={action.url} onClick={onActionClick} target='_blank' rel='noopener noreferrer' variant='contained' color='primary' sx={{textTransform: 'none'}}>
              {action.label}
            </Button>
        }
        <Button onClick={onClose} variant='text' color='inherit' sx={{textTransform: 'none', ml: 'auto'}}>
          {t('map_project.preview_limit_dismiss')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default PreviewLimitDialog
