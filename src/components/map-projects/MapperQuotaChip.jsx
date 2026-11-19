import React from 'react'
import { useTranslation } from 'react-i18next'
import Tooltip from '@mui/material/Tooltip'
import Chip from '@mui/material/Chip'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'

import { getMapperPreview } from '../../common/utils'
import { getUsageChipReport } from '../../common/aiAssistantUsage'

// Labels for the units the OCL AI Assistant reports its usage in.
const AI_ASSISTANT_USAGE_LABELS = {calls: 'map_project.preview_quota_ai_calls', tokens: 'map_project.preview_quota_ai_tokens'}

// The OCL AI Assistant's report as one line: the unit and the count, never a
// limit (OpenConceptLab/ocl_online#641). Nothing for a unit it has no label for.
const UsageLine = ({usage, sx}) => {
  const { t } = useTranslation()
  return AI_ASSISTANT_USAGE_LABELS[usage.meter] ? (
    <Typography variant='caption' component='div' sx={sx}>
      {t(AI_ASSISTANT_USAGE_LABELS[usage.meter])}: {t('map_project.preview_quota_used', {used: usage.used})}
    </Typography>
  ) : null
}

// The report on a chip of its own.
const AIAssistantUsageChip = ({usage, size}) => {
  const { t } = useTranslation()
  return (
    <Tooltip title={<UsageLine usage={usage} sx={{p: 0.5}} />}>
      <Chip size={size} variant='outlined' label={t(`map_project.ai_assistant_usage_chip_${usage.meter}`, {used: usage.used})} />
    </Tooltip>
  )
}

// `projectId`: the map project open, whose OCL AI Assistant report it shows.
const MapperQuotaChip = ({size = 'small', projectId}) => {
  const { t } = useTranslation()
  const preview = getMapperPreview({projectId})
  const { rowsPerProject, matchOperations, aiAssistantCalls, aiAssistantUsage, projects } = preview

  if(!preview.hasAccess) return null
  // No Preview chip: the OCL AI Assistant's own report, when it sent one.
  if(rowsPerProject.unlimited || rowsPerProject.limit === null) {
    const usage = preview.hasAIAssistant ? getUsageChipReport(aiAssistantUsage) : null
    return usage ? <AIAssistantUsageChip usage={usage} size={size} /> : null
  }

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
          {
            // The service's own report, when it sends one.
            aiAssistantUsage ?
              <UsageLine usage={aiAssistantUsage} /> :
              meterLine('map_project.preview_quota_ai_calls', aiAssistantCalls)
          }
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
