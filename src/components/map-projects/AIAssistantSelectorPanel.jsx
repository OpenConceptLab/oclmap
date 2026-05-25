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
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';

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
  promptOutputLocale,
  setPromptOutputLocale,
  showSubmit = false,
  disabled = false,
  showLocale = false,
  availableLocales,
  secondaryActionLabel,
  onSecondaryAction,
  sx = {}
}) => {
  const { t } = useTranslation()
  // `availableLocales` is the OCL Locales catalog (see MapProject.jsx
  // `fetchOclLocales`). Defensive fallback (sorted alphabetically by name)
  // covers the rare case where the prop is empty.
  const AUTO_OPTION = {id: 'auto', name: 'auto (experimental)'}
  const FALLBACK_LOCALES = [
    { id: 'en', name: 'English' },
    { id: 'fr', name: 'French' },
    { id: 'pt', name: 'Portuguese' },
    { id: 'es', name: 'Spanish' }
  ]
  const baseLocales = (Array.isArray(availableLocales) && availableLocales.length > 0)
    ? availableLocales
    : FALLBACK_LOCALES
  // `auto` always at the top; rest as-supplied (already sorted upstream).
  const locales = [AUTO_OPTION, ...baseLocales]
  const [checkLocale, setCheckLocale] = React.useState(false)

  if (!promptTemplates?.length) {
    return null
  }

  const selectedModelOption = find(models, { id: selectedModel }) || null
  const selectedLocaleOption = find(locales, { id: promptOutputLocale }) || null

  const getLocaleOptionLabel = option => {
    if (typeof option === 'string') {
      return option
    }

    if (!option?.id) {
      return ''
    }

    return option.id === 'auto' ? option.name : `[${option.id}] ${option.name}`
  }

  const onCheckLocale = event => {
    const newValue = event.target.checked
    setCheckLocale(newValue)
    if(!newValue)
      setPromptOutputLocale(null)
  }

  React.useEffect(() => {
    if (showLocale && promptOutputLocale && !checkLocale) {
      setCheckLocale(true)
    }
  }, [showLocale, promptOutputLocale, checkLocale])

  return (
    <Box
      sx={{
        backgroundColor: 'background.paper',
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
          <FormHelperText sx={{ margin: '4px 0 0 14px' }}>
            {t('common.version')}: {promptTemplate.version || 'N/A'}
          </FormHelperText>
      }
      {
        showLocale &&
          <>
            <FormControlLabel
              label={t('map_project.set_ai_assistant_output_language')}
              control={
                <Checkbox
                  onChange={onCheckLocale}
                  checked={checkLocale} />
              }
            />
            {
              checkLocale &&
                <Autocomplete
                  sx={{marginTop: '12px'}}
                  id="promptTemplateLocale"
                  freeSolo
                  blurOnSelect
                  options={locales}
                  value={selectedLocaleOption}
                  inputValue={selectedLocaleOption ? getLocaleOptionLabel(selectedLocaleOption) : (promptOutputLocale || '')}
                  onInputChange={(event, newInputValue, reason) => {
                    if (reason === 'input') {
                      setPromptOutputLocale(newInputValue || null)
                    }

                    if (reason === 'clear') {
                      setPromptOutputLocale(null)
                    }
                  }}
                  onChange={(event, newValue, reason) => {
                    if (reason === 'clear' || newValue === null || newValue === '') {
                      setPromptOutputLocale(null)
                      return
                    }

                    if (typeof newValue === 'string') {
                      return
                    }

                    setPromptOutputLocale(newValue?.id || null)
                  }}
                  isOptionEqualToValue={(option, current) => {
                    if (typeof current === 'string') {
                      return option?.id === current
                    }

                    return option?.id === current?.id
                  }}
                  getOptionLabel={getLocaleOptionLabel}
                  renderOption={(props, option) => (
                    <li {...props} key={option.id}>
                      {
                        option.id === 'auto' ?
                          <span style={{fontStyle: 'italic'}}>{option.name}</span> :
                          <span style={{display: 'flex', alignItems: 'center'}}>
                            <span style={{marginRight: '6px', fontSize: '14px', color: 'rgba(0, 0, 0, 0.6)'}}>[{option.id}]</span>
                            <span>{option.name}</span>
                          </span>
                      }
                    </li>
                  )}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label={t('map_project.ai_assistant_output_locale')}
                      helperText={t('map_project.ai_assistant_output_locale_helper', 'Pick from the list, or type a regional BCP-47 code (e.g. pt-BR, fr-CA).')}
                    />
                  )}
                />
            }
          </>
      }
      {
        showSubmit &&
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
            {
              secondaryActionLabel && onSecondaryAction &&
                <Button
                  variant='text'
                  size='small'
                  sx={{ textTransform: 'none', marginRight: '8px' }}
                  onClick={onSecondaryAction}
                >
                  {secondaryActionLabel}
                </Button>
            }
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
