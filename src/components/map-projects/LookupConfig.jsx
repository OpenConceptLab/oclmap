import React from 'react'
import { useTranslation } from 'react-i18next'
import TextField from '@mui/material/TextField'
import Collapse from '@mui/material/Collapse'
import Button from '@mui/material/Button'
import FormHelperText from '@mui/material/FormHelperText'
import IconButton from '@mui/material/IconButton'
import InputAdornment from '@mui/material/InputAdornment'
import UpIcon from '@mui/icons-material/ArrowDropUp';
import DownIcon from '@mui/icons-material/ArrowDropDown';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { lookupTokenHasSpaces, normalizeLookupConfig } from './lookupConfigFields'

const LookupConfig = ({value, onChange}) => {
  const { t } = useTranslation()
  const [open, setOpen] = React.useState(false)
  const [showToken, setShowToken] = React.useState(false)
  const tokenHasSpaces = lookupTokenHasSpaces(value?.token)

  return (
    <div className='col-xs-12 padding-0' style={{marginBottom: '16px', marginTop: '4px'}}>
        <Button size='small' variant='text' color={(value.url || open) ? 'primary' : 'secondary'} endIcon={open ? <UpIcon fontSize='inherit' /> : <DownIcon fontSize='inherit' />} onClick={() => setOpen(!open)} sx={{textTransform: 'none'}}>
          {t('map_project.lookup_configuration')}
        </Button>
      <Collapse in={open}>
        <div className='col-xs-12 padding-0'>
          <FormHelperText sx={{marginBottom: '12px', marginTop: '-4px', paddingLeft: '4px'}}>
            {t('map_project.lookup_configuration_description')}
          </FormHelperText>
          <div className='col-xs-6' style={{padding: '0 4px 0 0'}}>
            <TextField
              label={t('map_project.lookup_configuration_url')}
              fullWidth
              required
              value={value?.url || ''}
              onChange={event => onChange({...value, url: event.target.value.trim()})}
            />
          </div>
          <div className='col-xs-6' style={{padding: '0 0 0 4px'}}>
            <TextField
              type={showToken ? 'text' : 'password'}
              label={t('map_project.lookup_configuration_token')}
              fullWidth
              value={value?.token || ''}
              onChange={event => onChange({...value, token: event.target.value || ''})}
              onBlur={() => onChange(normalizeLookupConfig(value))}
              color={tokenHasSpaces ? 'warning' : 'primary'}
              helperText={tokenHasSpaces ? t('map_project.lookup_configuration_token_has_spaces') : ''}
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position='end'>
                      <IconButton size='small' edge='end' aria-label={showToken ? t('common.hide') : t('common.show')} onClick={() => setShowToken(!showToken)}>
                        {showToken ? <VisibilityOffIcon fontSize='small' /> : <VisibilityIcon fontSize='small' />}
                      </IconButton>
                    </InputAdornment>
                  ),
                },
                formHelperText: {sx: {color: 'warning.main'}},
              }}
            />
          </div>
        </div>
      </Collapse>
    </div>
  )
}

export default LookupConfig
