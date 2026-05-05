import React from 'react'
import { useTranslation } from 'react-i18next'
import Autocomplete from '@mui/material/Autocomplete'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import FormHelperText from '@mui/material/FormHelperText'
import ListItemText from '@mui/material/ListItemText'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'

import find from 'lodash/find'

import { PROMPTS_KEY_DEFAULT } from './constants'

const AIAssistantSelectorPanel = ({
  promptTemplates,
  promptTemplate,
  onPromptTemplateChange,
  models,
  selectedModel,
  onModelChange,
  onSubmit,
  submitLabel,
  showSubmit = false,
  disabled = false,
  sx = {}
}) => {
  const { t } = useTranslation()

  if (!promptTemplates?.length) {
    return null
  }

  const selectedModelOption = find(models, { id: selectedModel }) || null

  return (
    <Box
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: '12px',
        backgroundColor: 'background.paper',
        padding: '12px',
        minWidth: '320px',
        ...sx
      }}
    >
      <Autocomplete
        disableClearable
        blurOnSelect
        disabled={disabled}
        size='small'
        options={promptTemplates}
        value={promptTemplate || null}
        getOptionLabel={option => option?.name || ''}
        isOptionEqualToValue={(option, current) => option?.key === current?.key}
        onChange={(event, option) => onPromptTemplateChange(option || null)}
        renderInput={params => (
          <TextField
            {...params}
            label={t('map_project.ai_prompt_template_field')}
            fullWidth
          />
        )}
        renderOption={(props, option) => (
          <li {...props} key={option.key || option.id}>
            <Box sx={{ width: '100%', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2 }}>
              <ListItemText
                sx={{ my: 0, '.MuiListItemText-primary': { whiteSpace: 'normal' }, '.MuiListItemText-secondary': { whiteSpace: 'normal' } }}
                primary={option.name}
                secondary={
                  <React.Fragment>
                    <Typography component='span' variant='body2' color='text.secondary' sx={{ display: 'block' }}>
                      {option.description}
                    </Typography>
                    <Typography component='span' variant='caption' color='text.secondary'>
                      {t('map_project.ai_prompt_template_default_model')}: {option.default_model || 'N/A'}
                    </Typography>
                  </React.Fragment>
                }
              />
              {
                option.key === PROMPTS_KEY_DEFAULT &&
                  <Chip
                    label={t('common.default')}
                    size='small'
                    color='primary'
                    variant='outlined'
                    sx={{ mt: 0.5, flexShrink: 0 }}
                  />
              }
            </Box>
          </li>
        )}
      />
      <Autocomplete
        disableClearable
        blurOnSelect
        disabled={disabled}
        size='small'
        options={models || []}
        value={selectedModelOption}
        sx={{ marginTop: '12px' }}
        getOptionLabel={option => option?.name || option?.id || ''}
        isOptionEqualToValue={(option, current) => option?.id === current?.id}
        onChange={(event, option) => onModelChange(option?.id || '')}
        renderInput={params => (
          <TextField
            {...params}
            label={t('map_project.model')}
            fullWidth
          />
        )}
        renderOption={(props, option) => (
          <li {...props} key={option.id}>
            <ListItemText
              primary={option.name}
              secondary={option.id}
              sx={{ my: 0, '.MuiListItemText-primary': { whiteSpace: 'normal' }, '.MuiListItemText-secondary': { whiteSpace: 'normal' } }}
            />
          </li>
        )}
      />
      {
        promptTemplate &&
          <FormHelperText sx={{ marginTop: '8px', marginBottom: 0 }}>
            {t('common.version')}: {promptTemplate.version || 'N/A'}
          </FormHelperText>
      }
      {
        showSubmit &&
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
            <Button
              variant='contained'
              size='small'
              sx={{ textTransform: 'none' }}
              disabled={disabled || !promptTemplate?.key || !selectedModel}
              onClick={onSubmit}
            >
              {submitLabel || t('common.run')}
            </Button>
          </Box>
      }
    </Box>
  )
}

export default AIAssistantSelectorPanel
