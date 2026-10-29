import React from 'react'
import { useTranslation } from 'react-i18next'

import LimitDialog from '../common/LimitDialog'
import { PREVIEW_LIMIT_COPY_KEY } from './previewLimits'

// Says what the account can't use.
const PreviewLimitDialog = ({open, onClose, errorCode}) => {
  const { t } = useTranslation()
  const kind = PREVIEW_LIMIT_COPY_KEY[errorCode] || 'generic'

  return (
    <LimitDialog open={open} onClose={onClose} errorCode={errorCode} title={t('map_project.limit_unavailable_title')}>
      {t([`map_project.limit_unavailable_body_${kind}`, 'map_project.limit_unavailable_body_generic'])}
    </LimitDialog>
  )
}

export default PreviewLimitDialog
