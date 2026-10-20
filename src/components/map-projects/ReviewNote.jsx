import React from 'react'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { useTranslation } from 'react-i18next';

const ReviewNote = ({value, onChange}) => {
  const { t } = useTranslation();
  return (
    <div className='col-xs-12 padding-0' style={{display: 'flex', margin: '8px 0', alignItems: 'center'}}>
      <Typography component='span' sx={{color: 'surface.dark', fontWeight: 600, marginRight: '24px', fontSize: '14px', width: '55px'}}>
        {t('map_project.review')}
      </Typography>
      <div style={{display: 'flex', alignItems: 'center', width: 'calc(100% - 80px)'}}>
        <TextField
          fullWidth
          multiline
          maxRows={4}
          value={value || ''}
          onChange={onChange}
          slotProps={{ htmlInput: { inputMode: 'text', autoComplete: 'off', spellCheck: 'false' } }}
          sx={{
            '.MuiInputBase-root': {
              fontSize: '14px',
              padding: '4px 8px',
              '.MuiInputBase-inputMultiline': {
                height: '20px'
              }
            }
          }}
        />
      </div>
    </div>
  )
}

export default ReviewNote;
