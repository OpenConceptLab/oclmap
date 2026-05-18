import React from 'react';
import TextField from '@mui/material/TextField';
import Autocomplete from '@mui/material/Autocomplete';


const RepoVersionSearchAutocomplete = ({versions, onChange, label, id, required, size, sx, value, error, helperText}) => {
  const [open, setOpen] = React.useState(false)

  const handleChange = (event, id, item) => {
    event.preventDefault()
    event.stopPropagation()
    onChange(id, item)
  }

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
      getOptionLabel={option => option ? (option.version || option.id) : ''}
      fullWidth
      required={required}
      onChange={(event, item) => handleChange(event, id || 'source', item)}
      renderInput={
        params => (
          <TextField
            {...params}
            value={(value?.version || value?.id || '')}
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
