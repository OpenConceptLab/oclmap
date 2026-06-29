import React from 'react';
import { useTranslation } from 'react-i18next'
import Autocomplete from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';
import ListItem from '@mui/material/ListItem'
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import InputAdornment from '@mui/material/InputAdornment';
import GlobalIcon from '@mui/icons-material/Language';
import filter from 'lodash/filter';
import { getCurrentUser, getCurrentUserOrgs } from '../../common/utils';
import UserIcon from '../users/UserIcon';
import OrgIcon from '../orgs/OrgIcon';


const OwnerOption = ({ option, selected, ...rest }) => {
  return (
    <ListItem id={option.id} selected={selected} {...rest}>
      <ListItemIcon sx={{minWidth: 'auto', marginRight: '16px'}}>
        {option.icon}
      </ListItemIcon>
      <ListItemText primary={option.id} secondary={option.name} />
    </ListItem>
  )
}


const NamespaceDropdown = ({onChange, label, id, owner, backgroundColor, asOwner, size, disabled, sx}) => {
  const { t } = useTranslation()
  const user = getCurrentUser()
  const [ownerOptions, setOwnerOptions] = React.useState([])
  const prepareOwnerOptions = () => {
      const global = {url: '/', id: t('url_registry.global_registry'), type: '', name: t('url_registry.global_registry'), icon: <GlobalIcon />, group: '' }
    let options = [
      {url: user?.url, id: user?.username, type: user?.type, name: user?.username, icon: <UserIcon authenticated user={user} logoClassName='user-img-xsmall' />, group: ''},
    ]
    if(!asOwner)
      options = [global, ...options]
    getCurrentUserOrgs().forEach(org => {
      options.push({url: org.url, id: org.id, type: org.type, name: org.name, icon: <OrgIcon noLink strict logoClassName='user-img-xsmall' org={org} />, group: t('org.my')})
    })
    setOwnerOptions(options)
  }

  React.useEffect(() => {
    prepareOwnerOptions()
  }, [])

  const filterOptions = (options, { inputValue }) => inputValue ? filter(options, option => option.id.toLowerCase().includes(inputValue.toLowerCase()) || option.name.toLowerCase().includes(inputValue.toLowerCase())) : options;
  const selectedOption = ownerOptions.find(value => value?.url === owner) || ''

  return (
    <Autocomplete
      disabled={disabled}
      size={size || 'medium'}
      filterOptions={filterOptions}
      fullWidth
      disableClearable
      blurOnSelect
      id={id}
      options={ownerOptions}
      value={selectedOption}
      groupBy={option => option.group}
      getOptionLabel={option => option.id || ''}
      renderOption={(props, option, { selected }) => <OwnerOption key={option.id} option={option} dense={size === 'small'} {...props} selected={selected} />}
      onChange={onChange}
      renderInput={
        params => (
          <TextField
            {...params}
            label={label}
            size={size || 'medium'}
            sx={{backgroundColor: backgroundColor || 'primary.contrastText'}}
            slotProps={ selectedOption?.icon ? {
              ...params.slotProps,
              input: {
                ...params.slotProps?.input,
                startAdornment: (
                  <InputAdornment position="start">
                    {selectedOption.icon}
                  </InputAdornment>
                )
              }
            } : params.slotProps}
          />
        )
      }
      sx={sx}
    />
  )
}

export default NamespaceDropdown
