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
import { isCapMeter, QUOTA_PRICING_URL, REQUEST_MORE_ACCESS_URL } from './quotaErrors'

const QuotaDialog = ({open, onClose, meter, surface, plan, usage}) => {
  const { t } = useTranslation()
  const isCap = isCapMeter(meter)
  const { used, limit, period } = usage || {}
  const hasCount = Number.isFinite(used) && Number.isFinite(limit) && limit > 0
  const progress = hasCount ? Math.min(100, (used / limit) * 100) : 100
  const linkProps = {target: '_blank', rel: 'noopener noreferrer', endIcon: <OpenInNewIcon />, sx: {textTransform: 'none', borderRadius: '100px', whiteSpace: 'nowrap', flexShrink: 0, '&:hover, &:focus, &:active': {textDecoration: 'none'}, '&:focus:not(:focus-visible)': {outline: 'none'}}}

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
          {
            plan &&
              <div style={{paddingBottom: '12px', marginBottom: '12px', borderBottom: '1px solid rgba(0,0,0,0.12)'}}>
                <Typography variant='caption' sx={{display: 'block', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'text.secondary'}}>
                  {t('quota.your_plan')}
                </Typography>
                <Typography variant='subtitle1' sx={{fontWeight: 600}}>{plan}</Typography>
              </div>
          }
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px'}}>
            <Typography variant='body1'>{t(`quota.meter.${meter}`, {defaultValue: t('quota.meter.generic')})}</Typography>
            {
              hasCount &&
                <Typography variant='body1' sx={{fontWeight: 600}}>{t('quota.used_of', {used, limit})}</Typography>
            }
          </div>
          <LinearProgress variant='determinate' value={progress} sx={{my: 1, height: 8, borderRadius: '4px'}} />
          {
            !isCap && period === 'one_time' &&
              <Typography variant='body2' color='text.secondary'>{t('quota.period_one_time')}</Typography>
          }
        </div>
      </DialogContent>
      <DialogActions disableSpacing sx={{p: 0, pt: 3, gap: 1, justifyContent: 'flex-end', flexDirection: {xs: 'column-reverse', sm: 'row'}, alignItems: {xs: 'stretch', sm: 'center'}}}>
        <Button onClick={onClose} sx={{textTransform: 'none', mr: {sm: 'auto'}}}>
          {t('common.cancel')}
        </Button>
        <Button href={REQUEST_MORE_ACCESS_URL} variant='outlined' {...linkProps} sx={{...linkProps.sx, '&, &:hover, &:focus, &:active': {color: 'primary.main', textDecoration: 'none'}}}>
          {t('quota.request_more_access')}
        </Button>
        <Button href={QUOTA_PRICING_URL} variant='contained' {...linkProps} sx={{...linkProps.sx, '&, &:hover, &:focus, &:active': {color: 'primary.contrastText', textDecoration: 'none'}}}>
          {t('quota.view_pricing')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default QuotaDialog
