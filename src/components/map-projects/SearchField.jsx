import React from 'react'
import OutlinedInput from '@mui/material/OutlinedInput';
import InputAdornment from '@mui/material/InputAdornment';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import { useFormControl } from '@mui/material/FormControl';

const SearchField = ({onChange, value}) => {
  const [input, setInput] = React.useState('')
  const { focused } = useFormControl() || {};

  // Text set from outside, such as the header's search: {text}
  React.useEffect(() => {
    if(value)
      setInput(value.text)
  }, [value])
  const _onChange = event => {
    const value = event.target.value
    setInput(value)
    onChange(value)
  }

  const comp = React.useMemo(() => Boolean(focused || input), [focused, input]);

  const style = comp ? {height: '31px', paddingLeft: '7px'} : {padding: 0, height: '31px', justifyContent: 'flex-start'}

  return <OutlinedInput
           color='primary'
           value={input}
           onChange={_onChange}
           startAdornment={
             <InputAdornment position="start">
               <SearchIcon color={comp || !focused ? 'primary' : undefined} fontSize='small' />
             </InputAdornment>
           }
           inputProps={{ inputMode: 'text', autoComplete: 'off', spellCheck: 'false' }}
           endAdornment={
             input ?
             <InputAdornment position="end">
               <ClearIcon
                 fontSize='small'
                 sx={{cursor: 'pointer'}}
                 onClick={() => {
                 setInput('')
                 onChange('')
               }}
               />
             </InputAdornment> : undefined
           }
           sx={{
             ...style,
             width: comp ? '200px' : '20px',
             '.MuiOutlinedInput-notchedOutline': comp ? {borderColor: 'primary.main'} : {display: 'none'},
             '.MuiInputBase-input': comp ? {marginLeft: '-4px'} : {marginLeft: '-30px'}
           }}
           size='small'
         />
}

export default SearchField;
