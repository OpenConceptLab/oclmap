import React from 'react'
import { useTranslation } from 'react-i18next'

import LimitDialog from './LimitDialog'
import { isCapMeter } from './quotaErrors'

const QuotaDialog = ({open, onClose, errorCode, capability, owner, meter, surface}) => {
  const { t } = useTranslation()

  return (
    <LimitDialog open={open} onClose={onClose} errorCode={errorCode} capability={capability} owner={owner} title={t(isCapMeter(meter) ? 'quota.title_cap' : 'quota.title_quota')}>
      {t([`quota.consequence.${meter}.${surface}`, `quota.consequence.${meter}.default`, 'quota.consequence.generic'])}
    </LimitDialog>
  )
}

export default QuotaDialog
