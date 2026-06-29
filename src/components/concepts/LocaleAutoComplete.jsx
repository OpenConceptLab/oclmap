import React from 'react';
import {
  Alert, TextField, Box, Divider, Autocomplete, Dialog, DialogContent, DialogActions, DialogTitle, Button, Chip, Tooltip, Skeleton
} from '@mui/material';
import { createFilterOptions } from '@mui/material/Autocomplete';
import { Add as AddIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { get, isEmpty, uniqBy, compact, map, find, filter } from 'lodash'
import GroupHeader from '../common/GroupHeader';
import GroupItems from '../common/GroupItems';

const CustomLocaleDialog = ({ open, onClose, onSave, isMultiple }) => {
  const { t } = useTranslation();
  const [input, setInput] = React.useState('')
  const config = isMultiple ? {
    title: t('locale.add_custom_language_codes'),
    warning: t('locale.custom_language_code_warning'),
    label: t('locale.custom_language_codes'),
    helperText: t('locale.custom_language_code_helper_multiple'),
    validation: t('locale.custom_language_code_validation_multiple'),
    tooltip: t('locale.custom_language_code_tooltip')
  } : {
    title: t('locale.add_custom_language_code'),
    warning: t('locale.custom_language_code_warning'),
    label: t('locale.custom_language_code'),
    helperText: t('locale.custom_language_code_helper_single'),
    validation: t('locale.custom_language_code_validation_single'),
    tooltip: t('locale.custom_language_code_tooltip')
  }
  const [error, setError] = React.useState(false)
  const onChange = event => {
    const isValid = event.target.checkValidity()
    const newValue = event.target.value || ''
    setInput(newValue)
    if(!isValid) {
      setError(true)
    } else {
      const values = newValue.trim().split(/[\s,]+/)
      setError(Boolean(!values || (!isMultiple && values.length > 1)))
    }
  }
  const pattern = isMultiple ? "[a-zA-Z-, ]+" : "[a-zA-Z-]+"
  return (
    <Dialog open={open}>
      <DialogTitle>{config.title}</DialogTitle>
      <DialogContent>
        <Alert severity="warning">
          {config.warning}
        </Alert>
        <div className='col-xs-12 no-side-padding flex-vertical-center' style={{marginTop: '20px'}}>
          <TextField
            size='small'
            autoFocus
            margin="dense"
            label={config.label}
            fullWidth
            variant="outlined"
            InputLabelProps={{
              shrink: true,
            }}
            value={input}
            onChange={onChange}
            helperText={config.helperText}
            inputProps={{ pattern: pattern }}
            error={error}
          />
        </div>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} variant='text'>{t('common.cancel')}</Button>
        <Button onClick={() => onSave(input)} variant='contained' disabled={error}>{t('common.save')}</Button>
      </DialogActions>
    </Dialog>
  )
}

const LocaleAutoComplete = ({ cachedLocales, id, multiple, required, onChange, label, error, size, fullWidth, placeholder, custom, limit, disabled, value, optionsLimit, ...rest }) => {
  const { t } = useTranslation();
  const [locales, setLocales] = React.useState(cachedLocales || [])
  const _fullWidth = !(fullWidth === false)
  const [input, setInput] = React.useState('')
  const [customDialog, setCustomDialog] = React.useState(false)

  React.useEffect(() => {
    _setLocales()
  }, [cachedLocales])

  const getSelectedLocales = () => {
    if(!isEmpty(locales)) {
      if(value) {
        const locale = value?.locale || value?.id || value
        if(multiple)
          return filter(locales, locale => locale.includes(locale.locale))
        return find(locales, {locale: locale}) || {id: locale, locale: locale, name: locale}
      }
    }
    return multiple ? [] : '';
  }

  const _setLocales = () => {
    const selectedLocales = getSelectedLocales()
    if(!multiple && value && isEmpty(selectedLocales)) {
      const locale = value?.locale || value?.id || value
      setLocales([{id: locale, locale: locale, name: locale}, ...cachedLocales]);
    }
    else
      setLocales(cachedLocales);
  }

  const getOptionLabel = option => {
    if(option?.displayName) {
      let label = option.locale
      const name = option.displayName || option.name
      const suffix = option.id.length > 3 ? option.id : ''
      if(name)
        label = `${label} - ${name}`
      if(suffix)
        label = `${label} - ${suffix}`

      return label
    } else
      return option?.name || option?.id || ''
  }

  const isValidOption = option => Boolean(option.displayName)

  const _value = value || (multiple ? [] : '')
  const isLimitReached = limit && Boolean(multiple) && _value.length === limit

  const onCustomAdd = newValues => {
    setCustomDialog(false)
    onChange(
      id || 'localesAutoComplete',
      compact([
        ..._value,
        ...map(newValues.split(/[\s,]+/), val => {
          const _val = val.trim()
          return _val ? {id: _val} : false
        })
      ])
    )
  }

  const defaultFilterOptions = createFilterOptions();

  const filterLocales = (options, inputValue) => {
    const idFiltered = [...options.filter(option => option?.id?.toLowerCase().startsWith(inputValue?.toLowerCase())), ...options.filter(option => option?.id?.toLowerCase().match(inputValue?.toLowerCase()))];
    const nameFiltered = [...options.filter(option => option?.name?.toLowerCase().startsWith(inputValue?.toLowerCase())), ...options.filter(option => option?.name?.toLowerCase().match(inputValue?.toLowerCase()))];
    return uniqBy([...idFiltered, ...nameFiltered], 'id');
  }
  const filterOptions = (options, state) => {
    const inputValue = state?.inputValue
    let result = filterLocales(defaultFilterOptions(options, state), inputValue)
    if(optionsLimit) {
      let _limit = optionsLimit
      if(custom)
        _limit += 1

      result = result.slice(0, _limit)

      if(custom)
        result.push({id: 'custom', name: t('locale.add_custom_code')})
    }
    return result
  };

  const onCustomAddOptionClick = event => {
    event.preventDefault()
    event.stopPropagation()
    setCustomDialog(true)
  }

  const selectedLocales = getSelectedLocales()

  return (
    <React.Fragment>
      {
        locales?.length ?
          <Autocomplete
            openOnFocus
            filterOptions={filterOptions}
            fullWidth={_fullWidth}
            blurOnSelect={!multiple}
            disableCloseOnSelect={Boolean(multiple)}
            multiple={Boolean(multiple)}
            required={required}
            isOptionEqualToValue={(option, value) => get(value, 'uuid') ? (option.uuid === get(value, 'uuid')) : (option.id === get(value, 'id'))}
            value={selectedLocales}
            id={id || 'localesAutoComplete'}
            options={locales}
            getOptionLabel={getOptionLabel}
            onChange={(event, item) => onChange(id || 'localesAutoComplete', item)}
            groupBy={option => option.resultType}
            renderGroup={params => (
              <li style={{listStyle: 'none'}} key={params.key || params.group || 'locale-group'}>
                <GroupHeader>{params.group}</GroupHeader>
                <GroupItems>{params.children}</GroupItems>
              </li>
            )}
            renderOption={(props, option) => {
              const isCustom = option.id === 'custom'
              const suffix = ((option?.id?.length || 0) > 3 && !isCustom) ? option?.id || '' : false
              const boxProps = isCustom ? {...props, onClick: onCustomAddOptionClick} : props
              return (
                <React.Fragment key={option?.id || '' + option?.name || ''}>
                  <Box component='li' {...boxProps} id={option?.id || '' + option?.name || ''}>
                    {
                      isCustom ?
                        <span className='flex-vertical-center' style={{cursor: 'pointer'}}>
                          <AddIcon fontSize='small' style={{marginRight: '5px'}}/>
                          <span>
                            {t('locale.add_custom_code')}
                          </span>
                        </span> :
                      <span style={{width: '100%', display: 'flex'}}>
                        <span style={{minWidth: '10%', marginRight: '16px'}} className='form-text-gray'>
                          {option?.locale}
                        </span>
                        <span style={{minWidth: suffix ? '75%' : '85%'}}>
                          {option?.name}
                        </span>
                        {
                          suffix &&
                            <span style={{minWidth: '10%'}} className='form-text-gray'>
                              {suffix}
                            </span>
                        }
                      </span>
                    }
                  </Box>
                  <Divider style={{width: '100%'}}/>
                </React.Fragment>
              )
            }}
            renderInput={
              params => (
                <TextField
                  {...params}
                  size={size || 'small'}
                  required={required}
                  label={label}
                  placeholder={isLimitReached ? undefined : placeholder}
                  error={error}
                  variant="outlined"
                  fullWidth={_fullWidth}
                  value={input}
                  onChange={event => setInput(event.target.value || '')}
                  slotProps={{
                    ...params.slotProps,
                    input: {
                      ...params.slotProps?.input,
                      endAdornment: (
                        <React.Fragment>
                          {params.slotProps?.input?.endAdornment}
                        </React.Fragment>
                      ),
                    },
                  }}
                />
              )
            }
            renderTags={(tagValue, getTagProps) =>
              tagValue.map((option, index) => {
                const isValid = isValidOption(option)
                return (
                  <Tooltip key={index} title={isValid ? t('locale.iso_639_1_language_code') : t('locale.iso_639_1_support_note')}>
                    <Chip
                      size='small'
                      label={getOptionLabel(option)}
                      {...getTagProps({ index })}
                      disabled={disabled}
                      color={isValid ? 'primary' : 'default'}
                      className={isValid ? '' : 'invalid-locale-chip'}
                      style={{margin: '4px'}}
                    />
                  </Tooltip>
                )
              })
            }
            disabled={disabled || isLimitReached}
            {...rest}
          /> :
      <Skeleton variant="rounded" width='100%' height={40} />

      }
      <CustomLocaleDialog isMultiple={multiple && (!limit || limit > 1) } open={customDialog} searchText={input} onClose={() => setCustomDialog(false)} onSave={onCustomAdd}/>
    </React.Fragment>
);
}

export default LocaleAutoComplete;
