import React from 'react';
import { useTranslation } from 'react-i18next'
import Drawer from '@mui/material/Drawer'
import Divider from '@mui/material/Divider'
import IconButton from '@mui/material/IconButton'
import InputAdornment from '@mui/material/InputAdornment'
import ListItem from '@mui/material/ListItem'
import ListItemAvatar from '@mui/material/ListItemAvatar'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemText from '@mui/material/ListItemText'
import TextField from '@mui/material/TextField'
import SearchIcon from '@mui/icons-material/Search'
import CloseIcon from '@mui/icons-material/Close'
import EnterIcon from '@mui/icons-material/SubdirectoryArrowLeft'
import UpIcon from '@mui/icons-material/ArrowUpward'
import DownIcon from '@mui/icons-material/ArrowDownward'
import { getV3URL, hasTermBrowser } from '../../common/utils'
import { OperationsContext } from './LayoutContext'
import { headerSearchOptions, oclSearchURL } from './headerSearchOptions'

// Ported from TBv3's SearchInput and SearchInputDrawer, so search looks and
// behaves the same in both apps. A magnifier opens the drawer, which searches
// the open project's rows or all of OCL.

const Key = ({ icon, style }) => (
  <span style={{display: 'flex', padding: '4px', background: '#FFF', color: '#47464f', boxShadow: '0 0 5px 0 rgba(120, 118, 128, 0.6)', borderRadius: '4px', ...(style || {})}}>
    {icon}
  </span>
)

const Option = ({ id, label, hint, selected, onClick }) => (
  <ListItemButton id={id} sx={{padding: '12px'}} selected={selected} onClick={onClick}>
    <ListItemAvatar sx={{minWidth: '32px'}}>
      <SearchIcon color={selected ? 'primary' : undefined} />
    </ListItemAvatar>
    <ListItemText primary={label} sx={{paddingRight: '4px'}} />
    <span style={{display: 'flex', alignItems: 'center', color: '#47464f', fontSize: '12px', textAlign: 'right'}}>
      {
        selected &&
          <Key icon={<EnterIcon style={{fontSize: '12px'}} />} style={{marginRight: '8px', color: 'inherit'}} />
      }
      <span style={{display: 'flex'}}>{hint}</span>
    </span>
  </ListItemButton>
)

const HeaderSearch = () => {
  const { t } = useTranslation()
  const { projectRowSearch } = React.useContext(OperationsContext)
  const [open, setOpen] = React.useState(false)
  const [input, setInput] = React.useState('')
  const [focus, setFocus] = React.useState(0)
  const options = headerSearchOptions({canSearchRows: Boolean(projectRowSearch), canSearchOCL: hasTermBrowser()})

  // Cmd/Ctrl + / opens it, as in TBv3
  React.useEffect(() => {
    if(!options.length)
      return
    const onGlobalKeyDown = event => {
      if((event.metaKey || event.ctrlKey) && event.key === '/') {
        event.preventDefault()
        setOpen(true)
      }
    }
    document.addEventListener('keydown', onGlobalKeyDown)
    return () => document.removeEventListener('keydown', onGlobalKeyDown)
  }, [options.length])

  if(!options.length)
    return null

  const onClose = () => {
    setOpen(false)
    setFocus(0)
  }

  const search = option => {
    onClose()
    if(option === 'rows')
      projectRowSearch.search(input.trim())
    else
      window.location.assign(oclSearchURL(getV3URL(), input))
  }

  const onKeyDown = event => {
    if(event.key === 'Enter') {
      event.preventDefault()
      if(input.trim())
        search(options[focus] || options[0])
    } else if(event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const step = event.key === 'ArrowDown' ? 1 : -1
      setFocus((focus + step + options.length) % options.length)
    }
  }

  const query = <b>{input || '...'}</b>
  const LABELS = {
    rows: {label: <span>{t('search.search_project_rows')}"{query}"</span>, hint: t('search.search_project_rows_hint')},
    ocl: {label: <span>{t('search.search_all_site')}"{query}"</span>, hint: t('search.search_all_concepts')},
  }

  return (
    <React.Fragment>
      <IconButton sx={{marginRight: '8px'}} aria-label={t('common.search')} onClick={() => setOpen(true)}>
        <SearchIcon />
      </IconButton>
      <Drawer
        transitionDuration={0}
        ModalProps={{keepMounted: false}}
        sx={{
          zIndex: '1202',
          '& .MuiDrawer-paper': {
            borderRadius: '20px',
            padding: 0,
            top: 'calc(14px + var(--announcement-height, 0px))',
            width: '600px',
            maxWidth: 'calc(100vw - 32px)',
            margin: '0 auto',
            minHeight: '64px'
          },
        }}
        anchor='top'
        open={open}
        onClose={onClose}
      >
        <TextField
          id='header-search-input'
          autoFocus
          className='rounded-input'
          value={input}
          autoComplete='off'
          placeholder={t('search.input_placeholder_drawer')}
          onChange={event => setInput(event.target.value)}
          onKeyDown={onKeyDown}
          onFocus={event => event.target.select()}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position='start'>
                  <SearchIcon />
                </InputAdornment>
              ),
              endAdornment: (
                input &&
                  <InputAdornment position='end'>
                    <IconButton size='small' aria-label={t('common.clear')} onClick={() => setInput('')}>
                      <CloseIcon style={{color: '#000'}} />
                    </IconButton>
                  </InputAdornment>
              )
            }
          }}
          sx={{
            padding: '12px',
            height: '60px',
            '.MuiInputBase-root': {
              padding: 0
            }
          }}
        />
        {
          Boolean(input) &&
            <React.Fragment>
              {
                options.map((option, index) => (
                  <Option
                    key={option}
                    id={`header_search_${option}`}
                    label={LABELS[option].label}
                    hint={LABELS[option].hint}
                    selected={focus === index}
                    onClick={() => search(option)}
                  />
                ))
              }
              <Divider />
            </React.Fragment>
        }
        <ListItem sx={{padding: '12px', backgroundColor: '#fffbff'}}>
          <ListItemText
            primary={
              <span style={{display: 'flex', alignItems: 'center', fontSize: '12px', color: '#5e5c71', marginLeft: '4px'}}>
                <Key icon={<UpIcon style={{fontSize: '12px'}} />} style={{marginRight: '8px'}} />
                <Key icon={<DownIcon style={{fontSize: '12px'}} />} style={{marginRight: '8px'}} />
                {t('common.navigate')}
                <Key icon={<EnterIcon style={{fontSize: '12px'}} />} style={{margin: '0 8px 0 16px'}} />
                {t('common.select')}
              </span>
            }
          />
        </ListItem>
      </Drawer>
    </React.Fragment>
  )
}

export default HeaderSearch
