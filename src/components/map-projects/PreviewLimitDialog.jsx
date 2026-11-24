import React from 'react'
import { useTranslation } from 'react-i18next'

import LimitDialog from '../common/LimitDialog'
import { getPreviewLimitCopyKey } from './previewLimits'

// Says what the account can't use.
const PreviewLimitDialog = ({open, onClose, errorCode, capability, owner, phase}) => {
  const { t } = useTranslation()
  const kind = getPreviewLimitCopyKey(errorCode, phase)

  return (
    <LimitDialog open={open} onClose={onClose} errorCode={errorCode} capability={capability} owner={owner} title={t('map_project.limit_unavailable_title')}>
      {t([`map_project.limit_unavailable_body_${kind}`, 'map_project.limit_unavailable_body_generic'])}
    </LimitDialog>
  )
}

export default PreviewLimitDialog
