import React from 'react'
import { useTranslation } from 'react-i18next'
import Autocomplete from '@mui/material/Autocomplete'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import FormHelperText from '@mui/material/FormHelperText'
import ListItemText from '@mui/material/ListItemText'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'

import { PROMPTS_KEY_DEFAULT } from './constants'

const AIPromptTemplateSelector = ({ promptTemplates, promptTemplate, setPromptTemplate }) => {
  const { t } = useTranslation()

  if (!promptTemplates?.length) {
    return null
  }

  return (
    <div className='col-xs-12 padding-0' style={{ marginBottom: '20px' }}>
      <Typography component="div" sx={{ fontSize: '16px', fontWeight: 'bold' }}>
        {t('map_project.ai_prompt_template')}
      </Typography>
      <FormHelperText sx={{ marginTop: 0, marginBottom: '12px' }}>
        {t('map_project.ai_prompt_template_description')}
      </FormHelperText>
      <Autocomplete
        disableClearable
        blurOnSelect
        size='small'
        options={promptTemplates}
        value={promptTemplate || null}
        getOptionLabel={option => option?.name || ''}
        isOptionEqualToValue={(option, current) => option?.key === current?.key}
        onChange={(event, option) => setPromptTemplate(option || null)}
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
      {
        promptTemplate &&
          <Box sx={{ mt: 0, px: 1, py: 0.5, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2 }}>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant='body2' color='text.secondary'>
                {promptTemplate.description}
              </Typography>
              <Typography variant='caption' color='text.secondary'>
                {t('map_project.ai_prompt_template_default_model')}: {promptTemplate.default_model || 'N/A'}
              </Typography>
            </Box>
          </Box>
      }
    </div>
  )
}

export default AIPromptTemplateSelector
