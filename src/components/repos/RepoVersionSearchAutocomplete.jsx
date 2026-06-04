import React from 'react';
import TextField from '@mui/material/TextField';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';


const RepoVersionSearchAutocomplete = ({
  versions,
  onChange,
  label,
  id,
  required,
  size,
  sx,
  value,
  error,
  helperText,
  getOptionDisabled,
  renderOptionLabel,
  getOptionRightText
}) => {
  const [open, setOpen] = React.useState(false)

  const handleChange = (event, id, item) => {
    event.preventDefault()
    event.stopPropagation()
    onChange(id, item)
  }

  const getLabel = option => option ? (option.version || option.id || '') : ''

  return (
    <Autocomplete
      sx={sx}
      filterOptions={x => x}
      openOnFocus
      blurOnSelect
      disableClearable
      open={open}
      onOpen={() => setOpen(true)}
      onClose={() => setOpen(false)}
      isOptionEqualToValue={(option, value) => option.version_url === value?.version_url}
      value={value || ''}
      id={id || 'source-version'}
      size={size || 'medium'}
      options={versions}
      getOptionDisabled={getOptionDisabled}
      getOptionLabel={getLabel}
      fullWidth
      required={required}
      onChange={(event, item) => handleChange(event, id || 'source', item)}
      renderOption={(props, option) => {
        const labelContent = renderOptionLabel ? renderOptionLabel(option) : getLabel(option)
        const rightText = getOptionRightText ? getOptionRightText(option) : ''

        return (
          <li {...props} key={option?.version_url || option?.id || getLabel(option)}>
            <Box sx={{display: 'flex', alignItems: 'center', width: '100%', gap: 1, minWidth: 0}}>
              <Box sx={{display: 'flex', alignItems: 'center', minWidth: 0, flex: 1, gap: 1}}>
                <Box sx={{minWidth: 0}}>
                  {labelContent}
                </Box>
              </Box>
              <Box sx={{display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0}}>
                {
                  rightText &&
                    <Box component='span' sx={{fontSize: '12px', color: 'text.secondary', fontWeight: 500}}>
                      {rightText}
                    </Box>
                }
              </Box>
            </Box>
          </li>
        )
      }}
      renderInput={
        params => (
          <TextField
            {...params}
            value={getLabel(value)}
            required
            label={label || "Source"}
            variant="outlined"
            fullWidth
            size={size || 'medium'}
            error={Boolean(error)}
            helperText={helperText}
          />
        )
      }
    />
  );
}

export default RepoVersionSearchAutocomplete;
