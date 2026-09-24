import React from 'react'
import { useTranslation } from 'react-i18next'
import Tooltip from '@mui/material/Tooltip'
import Chip from '@mui/material/Chip'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'

import { getMapperPreview } from '../../common/utils'

const MapperQuotaChip = ({size = 'small'}) => {
  const { t } = useTranslation()
  const preview = getMapperPreview()
  const { rowsPerProject, matchOperations, aiAssistantCalls, projects } = preview

  if(!preview.hasAccess || rowsPerProject.unlimited || rowsPerProject.limit === null) return null

  // Rows per project is a cap (the first N rows of each project), not a
  // spendable quota, so the warning colors follow match operations.
  const nearLimit = !matchOperations.unlimited && matchOperations.limit > 0 &&
    matchOperations.remaining <= Math.ceil(matchOperations.limit * 0.2)
  const atLimit = !matchOperations.unlimited && matchOperations.limit !== null && matchOperations.remaining === 0

  const meterLine = (labelKey, meter) => meter.unlimited ? null : (
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
          <Typography variant='caption' component='div'>
            {t('map_project.preview_quota_rows')}: {t('map_project.preview_quota_rows_cap', {limit: rowsPerProject.limit})}
          </Typography>
          {meterLine('map_project.preview_quota_match_operations', matchOperations)}
          {meterLine('map_project.preview_quota_ai_calls', aiAssistantCalls)}
        </Box>
      }
    >
      <Chip
        size={size}
        variant='outlined'
        color={atLimit ? 'error' : (nearLimit ? 'warning' : 'default')}
        label={t('map_project.preview_quota_chip', {limit: rowsPerProject.limit})}
      />
    </Tooltip>
  )
}

export default MapperQuotaChip
