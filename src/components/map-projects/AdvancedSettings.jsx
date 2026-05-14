import React from 'react'
import { useTranslation } from 'react-i18next'
import TextField from '@mui/material/TextField'
import Collapse from '@mui/material/Collapse'
import Button from '@mui/material/Button'
import FormControlLabel from '@mui/material/FormControlLabel'
import Checkbox from '@mui/material/Checkbox'
import FormHelperText from '@mui/material/FormHelperText'
import UpIcon from '@mui/icons-material/ArrowDropUp';
import DownIcon from '@mui/icons-material/ArrowDropDown';


const AdvancedSettings = ({ namespaceValue, setNamespace, defaultNamespace, isCoreUser, useLexicalVariants, setUseLexicalVariants }) => {
  const { t } = useTranslation()
  const [open, setOpen] = React.useState(false)

  return (
    <div className='col-xs-12 padding-0' style={{marginBottom: '16px', marginTop: '4px'}}>
      <Button size='small' variant='text' color={open ? 'primary' : 'secondary'} endIcon={open ? <UpIcon fontSize='inherit' /> : <DownIcon fontSize='inherit' />} onClick={() => setOpen(!open)} sx={{textTransform: 'none'}}>
        {t('map_project.advanced_settings')}
      </Button>
      <Collapse in={open}>
        <div className='col-xs-12 padding-0' style={{marginTop: '4px'}}>
          <TextField
            fullWidth
            size='small'
            sx={{marginTop: '4px'}}
            label={t('map_project.resolution_namespace', 'Resolution Namespace')}
            value={namespaceValue}
            onChange={event => setNamespace(event.target.value || '')}
            placeholder={defaultNamespace}
            helperText={t('map_project.resolution_namespace_description', {
              owner: defaultNamespace || 'the project owner',
              defaultValue: 'Namespace passed to $resolveReference. When blank, defaults to {{owner}}. Drives which URL Registry entries apply when resolving canonical URLs.'
            })}
          />
          {
            isCoreUser &&
              <>
                <FormControlLabel
                  sx={{marginTop: '8px'}}
                  control={
                    <Checkbox
                      size='small'
                      checked={Boolean(useLexicalVariants)}
                      onChange={event => setUseLexicalVariants(event.target.checked)}
                    />
                  }
                  label={t('map_project.use_lexical_variants')}
                />
                <FormHelperText sx={{marginTop: 0}}>{t('map_project.use_lexical_variants_description')}</FormHelperText>
              </>
          }
        </div>
      </Collapse>
    </div>
  )
}

export default AdvancedSettings;
