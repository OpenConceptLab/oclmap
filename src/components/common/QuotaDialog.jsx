import React from 'react'
import { useTranslation } from 'react-i18next'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'

import Dialog from './Dialog'
import DialogTitle from './DialogTitle'
import CloseIconButton from './CloseIconButton'
import { isCapMeter } from './quotaErrors'
import useLimitAction from './useLimitAction'

const QuotaDialog = ({open, onClose, errorCode, meter, surface}) => {
  const { t } = useTranslation()
  const { action, onActionClick } = useLimitAction(open, errorCode)

  return (
    <Dialog open={open} onClose={onClose} maxWidth='sm' fullWidth>
      <DialogTitle sx={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
        {t(isCapMeter(meter) ? 'quota.title_cap' : 'quota.title_quota')}
        <CloseIconButton onClick={onClose} aria-label={t('common.close')} />
      </DialogTitle>
      <DialogContent sx={{px: 0, pb: 0}}>
        <Typography variant='body1' sx={{my: 2}}>
          {t([`quota.consequence.${meter}.${surface}`, `quota.consequence.${meter}.default`, 'quota.consequence.generic'])}
        </Typography>
        {
          action?.message &&
            <Typography variant='body1' sx={{mt: 2}}>{action.message}</Typography>
        }
      </DialogContent>
      <DialogActions disableSpacing sx={{p: 0, pt: 3, gap: 1, justifyContent: 'flex-end', flexDirection: {xs: 'column-reverse', sm: 'row'}, alignItems: {xs: 'stretch', sm: 'center'}}}>
        <Button onClick={onClose} sx={{textTransform: 'none', mr: {sm: 'auto'}}}>
          {t('common.close')}
        </Button>
        {
          action &&
            <Button
              href={action.url}
              onClick={onActionClick}
              target='_blank'
              rel='noopener noreferrer'
              variant='contained'
              endIcon={<OpenInNewIcon />}
              sx={{textTransform: 'none', borderRadius: '100px', flexShrink: 0, '&, &:hover, &:focus, &:active': {color: 'primary.contrastText', textDecoration: 'none'}, '&:focus:not(:focus-visible)': {outline: 'none'}}}
            >
              {action.label}
            </Button>
        }
      </DialogActions>
    </Dialog>
  )
}

export default QuotaDialog
