import React from 'react'
import { useTranslation } from 'react-i18next'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import LinearProgress from '@mui/material/LinearProgress'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'

import Dialog from './Dialog'
import DialogTitle from './DialogTitle'
import CloseIconButton from './CloseIconButton'
import { isCapMeter } from './quotaErrors'
import useLimitAction from './useLimitAction'

const QuotaDialog = ({open, onClose, errorCode, meter, surface, usage}) => {
  const { t } = useTranslation()
  const { action, onActionClick } = useLimitAction(open, errorCode)
  const isCap = isCapMeter(meter)
  const { used, limit } = usage || {}
  const hasCount = Number.isFinite(used) && Number.isFinite(limit) && limit > 0
  const progress = hasCount ? Math.min(100, (used / limit) * 100) : 100

  return (
    <Dialog open={open} onClose={onClose} maxWidth='sm' fullWidth>
      <DialogTitle sx={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
        {t(isCap ? 'quota.title_cap' : 'quota.title_quota')}
        <CloseIconButton onClick={onClose} aria-label={t('common.close')} />
      </DialogTitle>
      <DialogContent sx={{px: 0, pb: 0}}>
        <Typography variant='body1' sx={{my: 2}}>
          {t([`quota.consequence.${meter}.${surface}`, `quota.consequence.${meter}.default`, 'quota.consequence.generic'])}
        </Typography>
        <div style={{backgroundColor: '#fff', borderRadius: '20px', padding: '16px 20px'}}>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px'}}>
            <Typography variant='body1'>{t(`quota.meter.${meter}`, {defaultValue: t('quota.meter.generic')})}</Typography>
            {
              hasCount &&
                <Typography variant='body1' sx={{fontWeight: 600}}>{t('quota.used_of', {used, limit})}</Typography>
            }
          </div>
          <LinearProgress variant='determinate' value={progress} sx={{my: 1, height: 8, borderRadius: '4px'}} />
        </div>
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
