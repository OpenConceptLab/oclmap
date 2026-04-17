import React from 'react'
import { useTranslation } from 'react-i18next'
import Autocomplete from '@mui/material/Autocomplete'
import TextField from '@mui/material/TextField'
import Collapse from '@mui/material/Collapse'
import Button from '@mui/material/Button'
import FormHelperText from '@mui/material/FormHelperText'
import ListItemText from '@mui/material/ListItemText'
import UpIcon from '@mui/icons-material/ArrowDropUp';
import DownIcon from '@mui/icons-material/ArrowDropDown';
import { CUSTOM_ENCODER_MODEL_OPTION, DEFAULT_ENCODER_MODEL, ENCODER_MODEL_OPTIONS } from './rerankerModels'

const RerankerConfig = ({ value, onChange }) => {
  const { t } = useTranslation()
  const [open, setOpen] = React.useState(false)
  const presetOptions = ENCODER_MODEL_OPTIONS.map(model => ({
    id: model.id,
    label: model.description,
    isDefault: Boolean(model.default),
    disabled: Boolean(model.disabled)
  }))
  const options = [
    ...presetOptions,
    { id: CUSTOM_ENCODER_MODEL_OPTION, label: t('map_project.reranker_configuration_custom_option') }
  ]
  const isKnownOption = ENCODER_MODEL_OPTIONS.map(option => option.id).includes(value)
  const selectedOption = isKnownOption ?
    presetOptions.find(option => option.id === value) :
    options.find(option => option.id === CUSTOM_ENCODER_MODEL_OPTION)
  const isCustomSelected = selectedOption?.id === CUSTOM_ENCODER_MODEL_OPTION

  return (
    <div className='col-xs-12 padding-0' style={{ marginBottom: '16px', marginTop: '4px' }}>
      <Button
        size='small'
        variant='text'
        color={(value || open) ? 'primary' : 'secondary'}
        endIcon={open ? <UpIcon fontSize='inherit' /> : <DownIcon fontSize='inherit' />}
        onClick={() => setOpen(!open)}
        sx={{ textTransform: 'none' }}
      >
        {t('map_project.reranker_configuration')}
      </Button>
      <Collapse in={open}>
        <div className='col-xs-12 padding-0'>
          <FormHelperText sx={{ marginBottom: '12px', marginTop: '-4px', paddingLeft: '4px' }}>
            {t('map_project.reranker_configuration_description')}
          </FormHelperText>
          <Autocomplete
            disableClearable
            options={options}
            value={selectedOption || null}
            getOptionLabel={option => option?.id || ''}
            isOptionEqualToValue={(option, current) => option.id === current.id}
            getOptionDisabled={(option) => option?.disabled}
            onChange={(event, option) => {
              if(option?.id === CUSTOM_ENCODER_MODEL_OPTION) {
                onChange(isKnownOption ? '' : value)
                return
              }
              onChange(option?.id || DEFAULT_ENCODER_MODEL)
            }}
            renderInput={params => (
              <TextField
                {...params}
                label={t('map_project.reranker_configuration_model')}
                fullWidth
              />
            )}
            renderOption={(props, option) => (
              <li {...props} key={option.id}>
                <ListItemText
                  sx={{flexDirection: 'column', alignItems: 'flex-start !important'}}
                  primary={`${option.id}${option.isDefault ? ` (${t('common.default')})` : ''}`}
                  secondary={option.label}
                />
              </li>
            )}
          />
          {
            isCustomSelected &&
              <TextField
                sx={{ marginTop: '12px' }}
                label={t('map_project.reranker_configuration_custom_model')}
                fullWidth
                value={value || ''}
                placeholder={t('map_project.reranker_configuration_placeholder')}
                onChange={event => onChange(event.target.value || '')}
              />
          }
        </div>
      </Collapse>
    </div>
  )
}

export default RerankerConfig
