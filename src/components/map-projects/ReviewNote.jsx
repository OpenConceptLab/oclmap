import React from 'react'
import TextField from '@mui/material/TextField'
import InputAdornment from '@mui/material/InputAdornment'
import Typography from '@mui/material/Typography'
import { useTranslation } from 'react-i18next';
import { LockMark, LockTooltip, useEditLock } from '../common/NoticeLock'

const ReviewNote = ({value, onChange}) => {
  const { t } = useTranslation();
  const lock = useEditLock()
  return (
    <div className='col-xs-12 padding-0' style={{display: 'flex', margin: '8px 0', alignItems: 'center'}}>
      <Typography component='span' sx={{color: 'surface.dark', fontWeight: 600, marginRight: '24px', fontSize: '14px', width: '55px'}}>
        {t('map_project.review')}
      </Typography>
      <div style={{display: 'flex', alignItems: 'center', width: 'calc(100% - 80px)'}}>
        <LockTooltip title={lock} display='flex' style={{width: '100%'}}>
        <TextField
          disabled={Boolean(lock)}
          fullWidth
          multiline
          maxRows={4}
          value={value || ''}
          onChange={onChange}
          slotProps={{
            htmlInput: { inputMode: 'text', autoComplete: 'off', spellCheck: 'false' },
            input: lock ? { startAdornment: <InputAdornment position='start'><LockMark sx={{fontSize: '18px'}} /></InputAdornment> } : undefined,
          }}
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
        </LockTooltip>
      </div>
    </div>
  )
}

export default ReviewNote;
