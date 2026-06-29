import React from 'react';
import { TextField, CircularProgress, Divider } from '@mui/material';
import Autocomplete from '@mui/material/Autocomplete';
import { useTranslation } from 'react-i18next';
import { get, debounce, map, find, forEach } from 'lodash'
import APIService from '../../services/APIService';
import AutocompleteLoading from '../common/AutocompleteLoading';
import RepoListItem from './RepoListItem';
import GroupHeader from '../common/GroupHeader'
import GroupItems from '../common/GroupItems'


const RepoSearchAutocomplete = ({onChange, label, id, required, minCharactersForSearch, size, suggested, sx, value, repoType, ownRepo, autoFocus}) => {
  const { t } = useTranslation();
  const minLength = minCharactersForSearch || 2;
  const [input, setInput] = React.useState('')
  const [open, setOpen] = React.useState(false)
  const [repos, setRepos] = React.useState(map(suggested || [], instance => ({...instance, resultType: t('repo.suggested_sources')})))
  const [selected, setSelected] = React.useState(undefined)
  const [loading, setLoading] = React.useState(false)

  React.useEffect(() => {
    if(value?.url !== selected?.url && value?.url) {
      setSelected(value)
      if(!find(repos, {url: value.url})?.url)
        setRepos([value, ...repos])
    }
  }, [value])

  const isSearchable = input && input.length >= minLength;
  const handleInputChange = debounce((event, value, reason) => {
    setInput(value || '')
    if(reason !== 'reset' && value && value.length >= minLength)
      fetchRepos(value)
    else
      setLoading(false)
  }, 300)

  const handleChange = (event, id, item) => {
    event.preventDefault()
    event.stopPropagation()
    setSelected(item)
    onChange(id, item)
  }

  const fetchRepos = searchStr => {
    setLoading(true)
    setRepos([])
    const query = {limit: 25, q: searchStr, includeSummary: true}
    const services = getRepoServices()
    let count = services.length
    forEach(services, service => {
      service.get(null, null, query).then(response => {
        count -= 1
        setRepos(prev => {
          return [...prev, ...map(response.data, repo => ({...repo, resultType: t('search.search_results')}))]
        })
        if(count === 0)
          setLoading(false)
      })
    })
  }

  const getRepoServices = () => {
    if(repoType && ownRepo)
      return [APIService.user()[repoType](), APIService.user()['orgs/' + repoType]()]
    return [APIService.sources()]
  }

  return (
    <Autocomplete
      sx={sx}
      filterOptions={x => x}
      openOnFocus
      blurOnSelect
      open={open}
      onOpen={() => setOpen(true)}
      onClose={() => setOpen(false)}
      isOptionEqualToValue={(option, value) => option.url === get(value, 'url')}
      value={selected || ''}
      id={id || 'repo'}
      size={size || 'medium'}
      options={repos}
      loading={loading}
      loadingText={
        loading ?
          <AutocompleteLoading text={input} /> :
        t('map_project.type_atleast_characters', {count: minLength})
      }
      noOptionsText={(isSearchable && !loading) ? t('map_project.no_results') : t('map_project.start_typing')}
      getOptionLabel={option => option ? (option.name || option.id) : ''}
      fullWidth
      required={required}
      onInputChange={handleInputChange}
      onChange={(event, item) => handleChange(event, id || 'repo', item)}
      groupBy={option => option.resultType}
      renderGroup={params => (
        <li style={{listStyle: 'none'}} key={params.key}>
          <GroupHeader>{params.group}</GroupHeader>
          <GroupItems>{params.children}</GroupItems>
        </li>
      )}
      renderInput={
        params => (
          <TextField
            {...params}
            autoFocus={autoFocus}
            value={input || ''}
            required
            label={label || t('map_project.source')}
            variant="outlined"
            fullWidth
            size={size || 'medium'}
            slotProps={{
              ...params.slotProps,
              input: {
                ...params.slotProps?.input,
                endAdornment: (
                  <React.Fragment>
                    {loading ? <CircularProgress color="inherit" size={20} /> : null}
                    {params.slotProps?.input?.endAdornment}
                  </React.Fragment>
                ),
              },
            }}
          />
        )
      }
      renderOption={
        (props, option) => (
          <React.Fragment key={option.url}>
            <RepoListItem listItemProps={props} option={option} />
            <Divider component="li" style={{listStyle: 'none'}} />
          </React.Fragment>
        )
      }
    />
  );
}

export default RepoSearchAutocomplete;
