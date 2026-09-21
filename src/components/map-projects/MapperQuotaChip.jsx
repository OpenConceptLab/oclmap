import React from 'react'
import { useTranslation } from 'react-i18next'
import Tooltip from '@mui/material/Tooltip'
import Chip from '@mui/material/Chip'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'

import { getMapperPreview } from '../../common/utils'

// One-time allowance (no reset date, R2/R18) across four independent caps.
// A null limit on any meter means unlimited (grandfathered/manually-granted users).
const MapperQuotaChip = ({size = 'small'}) => {
  const { t } = useTranslation()
  const preview = getMapperPreview()
  const { rowsPerProject, matchOperations, aiAssistantCalls, projects } = preview

  if(!preview.hasAccess || rowsPerProject.limit === null) return null

  const nearLimit = rowsPerProject.limit > 0 && rowsPerProject.remaining <= Math.ceil(rowsPerProject.limit * 0.2)
  const atLimit = rowsPerProject.remaining === 0

  const meterLine = (labelKey, meter) => meter.limit === null ? null : (
    <Typography key={labelKey} variant='caption' component='div'>
      {t(labelKey)}: {t('map_project.preview_quota_used_of_limit', {used: meter.used, limit: meter.limit})}
    </Typography>
  )

  return (
    <Tooltip
      title={
        <Box sx={{p: 0.5}}>
          <Typography variant='caption' component='div' sx={{fontWeight: 600, mb: 0.5}}>
            {t('map_project.preview_quota_tooltip_title')}
          </Typography>
          {meterLine('map_project.preview_quota_projects', projects)}
          {meterLine('map_project.preview_quota_rows', rowsPerProject)}
          {meterLine('map_project.preview_quota_match_operations', matchOperations)}
          {meterLine('map_project.preview_quota_ai_calls', aiAssistantCalls)}
        </Box>
      }
    >
      <Chip
        size={size}
        variant='outlined'
        color={atLimit ? 'error' : (nearLimit ? 'warning' : 'default')}
        label={t('map_project.preview_quota_chip', {remaining: rowsPerProject.remaining, limit: rowsPerProject.limit})}
      />
    </Tooltip>
  )
}

export default MapperQuotaChip
