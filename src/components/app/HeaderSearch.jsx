import React from 'react';
import { useTranslation } from 'react-i18next'
import InputAdornment from '@mui/material/InputAdornment';
import TextField from '@mui/material/TextField';
import SearchIcon from '@mui/icons-material/Search';
import { getV3URL } from '../../common/utils';

const HeaderSearch = () => {
  const { t } = useTranslation()
  const [value, setValue] = React.useState('')

  const onKeyDown = event => {
    const query = value.trim()
    if(event.key === 'Enter' && query)
      window.location.assign(`${getV3URL()}/search/?q=${encodeURIComponent(query)}&type=concepts`)
  }

  return (
    <TextField
      size='small'
      fullWidth
      value={value}
      placeholder={t('search.input_placeholder')}
      onChange={event => setValue(event.target.value)}
      onKeyDown={onKeyDown}
      InputProps={{startAdornment: <InputAdornment position='start'><SearchIcon /></InputAdornment>, sx: {borderRadius: '100px'}}}
    />
  )
}

export default HeaderSearch
