import React from 'react';
import { useTranslation } from 'react-i18next';
import {omit, omitBy, isEmpty, isObject, has, map, startCase, includes, get, without, forEach, flatten, values, pickBy, isEqual, filter, reject, cloneDeep, keys, find} from 'lodash';
import InfoIcon from '@mui/icons-material/InfoOutlined';
import MappedIcon from '@mui/icons-material/Link';
import Button from '@mui/material/Button';
import Badge from '@mui/material/Badge';
import Tooltip from '@mui/material/Tooltip';
import DownIcon from '@mui/icons-material/ArrowDropDown';
import UpIcon from '@mui/icons-material/ArrowDropUp';
import List from '@mui/material/List';
import ListItemText from '@mui/material/ListItemText';
import ListSubheader from '@mui/material/ListSubheader';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import Checkbox from '@mui/material/Checkbox';
import CircularProgress from '@mui/material/CircularProgress';
import { URIToParentParams, currentUserHasAccess, toCamelCase } from '../../common/utils'
import { FACET_ORDER } from './ResultConstants';

const SearchFilters = ({filters, resource, onChange, kwargs, bgColor, appliedFilters, fieldOrder, noSubheader, disabledZero, filterDefinitions, nested, onSaveAsDefaultFilters, loading, repoDefaultFilters, propertyFilters, heightToSubtract, open, columns, defaultFilters}) => {
  const { t } = useTranslation()
  const [applied, setApplied] = React.useState({});
  const [count, setCount] = React.useState(0);
  const [expanded, setExpanded] = React.useState([])

  const filterOrder = fieldOrder || FACET_ORDER[resource]
  let blacklisted = ['is_active', 'is_latest_version', 'is_in_latest_source_version'];
  const isConcept = resource === 'concepts'
  const isMapping = resource === 'mappings'
  const isSourceChild = isConcept || isMapping
  let propertyFacets = {}
  const hasValidKwargs = !isEmpty(kwargs) && isObject(kwargs);
  if(hasValidKwargs) {
    if(kwargs.user || kwargs.org)
      blacklisted = [...blacklisted, 'owner', 'ownerType']
    if(kwargs.source)
      blacklisted = [...blacklisted, 'source']
    if(kwargs.collection)
      blacklisted = [...blacklisted, 'collection']
    if(isSourceChild)
      blacklisted = [...blacklisted, 'concept', 'conceptOwner', 'conceptOwnerType', 'conceptSource']
  }

  let uiFilters = omit(omitBy(filters, isEmpty), blacklisted)
  if(isObject(kwargs) && !kwargs.collection && isSourceChild && !isEmpty(uiFilters) && !isEmpty(uiFilters.collection)){
    uiFilters['collection_membership'] = uiFilters.collection
    delete uiFilters.collection
  }

  if(has(uiFilters, 'experimental'))
    uiFilters.experimental = [[(uiFilters.experimental[0][0] === 1).toString(), uiFilters.experimental[0][1], uiFilters.experimental[0][2]]]

  if((!isEmpty(filterOrder) || !isEmpty(propertyFilters)) && !isEmpty(uiFilters)) {
    const orderedUIFilters = {}
    const keysTraversed = []
    let ordered = filterOrder?.length ? filterOrder : propertyFilters?.map(prop => prop?.code)
    forEach(ordered, attr => {
      let key;
      if(has(uiFilters, attr))
        key = attr
      if(has(uiFilters, toCamelCase(attr)))
        key = toCamelCase(attr)
      if(has(uiFilters, `properties__${attr}`))
        key = `properties__${attr}`
      if(key) {
        orderedUIFilters[key] = uiFilters[key]
        keysTraversed.push(attr)
      }
    })
    if(isConcept) {
      let orderedKeys = keys(uiFilters).sort()
      orderedKeys.forEach(key => {
        if(!keysTraversed.includes(keys))
          orderedUIFilters[key] = uiFilters[key]
      })
    }
    uiFilters = orderedUIFilters
  }
  if(isConcept){
    propertyFacets = pickBy(filters, (values, field) => field.startsWith('properties__') && !isEmpty(values))
    if(!isEmpty(propertyFacets)) {
      uiFilters = omit(uiFilters, ['conceptClass', 'datatype', ...keys(propertyFacets)])
    }
  }
  const formattedName = (field, name) => {
    let label;
    if(includes(['locale', 'version', 'source_version', 'nameTypes', 'expansion'], field))
      label = name
    else if(includes(['owner', 'source', 'collection', 'collection_membership'], field))
      label = name.replaceAll('_', '-').toUpperCase()
    else if (field === 'targetRepo') {
      const params = URIToParentParams(name)
      return `${params.owner}:${params.repo}`
    }
    else if(name) {
      name = name.trim()
      if(name === 'n/a')
        label = name.toUpperCase()
      else
        label = get(filterDefinitions, name)?.label || name
    }
    if(!label)
      label = 'None'
    if(isUnApplied(field, [name]))
      label += '*'
    return label
  }

  const formattedListSubheader = field => field.startsWith('properties__') ? startCase(field.split('__')[1]) : startCase(field)

  const getMappedToColumnName = field => {
    let mappedColumnName;
    if(columns?.length) {
      let isProperty = field.startsWith('properties__')
      if(isProperty) {
        let name = field.split('__')[1]
        mappedColumnName = find(columns, column => column.label.toLowerCase() === `Property: ${name}`.toLowerCase() || column.label.toLowerCase().includes(name.toLowerCase()))?.original
        if(!mappedColumnName && name === 'concept_class')
          mappedColumnName = find(columns, column => column.label.toLowerCase() === `Property: Class`.toLowerCase())?.original
      } else {
        mappedColumnName = find(columns, column => column.label.toLowerCase() === field.toLowerCase())?.original
      }
    }
    return mappedColumnName
  }

  const handleToggle = (field, value) => () => {
    const checked = !isApplied(field, value)
    let newApplied = {...cloneDeep(applied)}
    let newCount = count
    if(checked) {
      newApplied[field] = newApplied[field] || {}
      newApplied[field][value[0]] = checked
      newCount += 1
    }
    else {
      newApplied[field] = omit(newApplied[field], value[0])
      newCount -= 1
    }
    if(isEmpty(newApplied[field]))
      newApplied = omit(newApplied, field)
    setCount(newCount)
    setApplied(newApplied)
  };

  const onReset = () => {
    let __filters = defaultFilters || {}
    setApplied(__filters)
    onChange(__filters)
    setCount(flatten(values(__filters).map(v => values(v))).length)
  }

  const onApply = () => {
    onChange(applied)
  }

  const isApplied = (field, value) => Boolean(get(applied[field], value[0]))
  const isUnApplied = (field, value) => isApplied(field, value) && !get(appliedFilters[field], value[0])
  const canResetToDefaultFilters = (!isEqual(applied, repoDefaultFilters) || !isEqual(appliedFilters, repoDefaultFilters)) && !isEmpty(repoDefaultFilters)

  React.useEffect(() => {
    setCount(flatten(values(appliedFilters).map(v => values(v))).length)
    setApplied(appliedFilters)
  }, [filters])

  const getFieldFilters = (field, fieldFilters) => {
    let ordered = [
      ...filter(fieldFilters, _filter => get(appliedFilters, `${field}.${_filter[0]}`)),
      ...reject(fieldFilters, _filter => get(appliedFilters, `${field}.${_filter[0]}`)),
    ]
    if(expanded.includes(field))
      return ordered
    return ordered.slice(0, 5)
  }

  const toggleExpanded = field => {
    if(expanded.includes(field))
      setExpanded(without(expanded, field))
    else
      setExpanded([...expanded, field])
  }

  const unapplied = (!isEmpty(applied) || !isEmpty(appliedFilters)) && !isEqual(applied, appliedFilters)

  const onSetDefaultFilters = () => {
    if(unapplied)
      onChange(applied)
    onSaveAsDefaultFilters(applied)
  }

  const onResetDefaultFilters = () => {
    setApplied(repoDefaultFilters)
    onChange(repoDefaultFilters)
  }


  const getFilterList = (fieldFilters, field) => {
    const shouldShowExpand = fieldFilters.length > 5
    const isExpanded = expanded.includes(field)
    const mappedColumnName = getMappedToColumnName(field)
    return (
      <ListItem key={field} sx={{padding: 0, flexDirection: 'column'}}>
        <List
          dense
          sx={{
            width: '100%',
            position: 'relative',
            padding: 0,
            display: 'inline-block',
          }}
        >
          {
            !noSubheader &&
              <ListSubheader sx={{padding: '0 8px 0 0px', fontWeight: 'bold', backgroundColor: bgColor, lineHeight: '30px', display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
                <span>{formattedListSubheader(field)}</span>
                {
                  mappedColumnName &&
                    <Tooltip title={t('map_project.mapped_to_column', {columnName: mappedColumnName})}>
                      <span style={{fontWeight: 'normal', fontSize: '12px', display: 'flex', alignItems: 'center'}}>
                        <MappedIcon color='warning' sx={{marginRight: '4px', fontSize: '14px'}} />
                        {mappedColumnName}
                      </span>
                    </Tooltip>
                }
              </ListSubheader>
          }
          {
            map(getFieldFilters(field, fieldFilters), value => {
              const labelId = `checkbox-list-label-${value[0]}`;
              const key = `${field}-${value[0]}`

              return (
                <ListItemButton key={key} onClick={handleToggle(field, value)} sx={{p: '0 12px 0 4px'}} disabled={value[3] === true || (disabledZero && value[1] === 0)}>
                  <ListItemIcon sx={{minWidth: '25px'}}>
                    <Checkbox
                      size="small"
                      edge="start"
                      checked={isApplied(field, value)}
                      tabIndex={-1}
                      disableRipple
                      inputProps={{ 'aria-labelledby': labelId }}
                      sx={{padding: '0px 8px', '.MuiSvgIcon-root': {fontSize: '1.1rem'}}}
                      disabled={(disabledZero && value[1] === 0)}
                    />
                  </ListItemIcon>
                  <ListItemText
                    id={labelId}
                    primary={
                      <span style={{display: 'flex', alignItems: 'center'}}>
                        {formattedName(field, value[0])}
                        {
                          get(filterDefinitions, value[0])?.tooltip &&
                            <Tooltip title={filterDefinitions[value[0]].tooltip}>
                              <InfoIcon sx={{marginLeft: '4px', fontSize: '1rem'}} color='primary' />
                            </Tooltip>
                        }
                      </span>
                    }
                    primaryTypographyProps={{style: {fontSize: '0.875rem'}}} style={{margin: 0}} />
                  <span style={{fontSize: '0.7rem'}}>{value[1].toLocaleString()}</span>
                </ListItemButton>
              );
            })}

        </List>
        {
          shouldShowExpand &&
            <ListItem sx={{padding: '4px 4px 0px 0px'}}>
              <Button size='small' onClick={() => toggleExpanded(field)} sx={{textTransform: 'none', fontSize: '11px', padding: '0px 5px 2px 5px'}} color='secondary' startIcon={isExpanded ? <UpIcon fontSize='inherit'/> : <DownIcon fontSize='inherit'/>}>
                {isExpanded ? t('common.hide') : `${t('common.show')} ${fieldFilters.length - 5} ${t('common.more').toLowerCase()}`}
              </Button>
            </ListItem>
        }
      </ListItem>
    )
  }


  const canUpdateDefaultFilters = nested && onSaveAsDefaultFilters && currentUserHasAccess()
  const topBarHeight = canUpdateDefaultFilters ? 60 : 30
  let totalFilters = {...propertyFacets, ...uiFilters}

  return (
    <div className='col-xs-12 padding-0'>
      <div className='col-xs-12 padding-0' style={{zIndex: 2, position: open ? 'absolute' : undefined, top: 0, display: open ? undefined : 'none'}}>
        <div className='col-xs-12 padding-0' style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
          <span>
            <Badge badgeContent={count} color='primary' sx={{'.MuiBadge-badge': {top: '10px', left: '36px'}}}>
              <b>{t('search.filters')}</b>
            </Badge>
          </span>
          <span>
            <Button variant='text' color='primary' style={{textTransform: 'none'}} onClick={onApply} disabled={!unapplied}>
              {t('common.apply')}
            </Button>
            <Button variant='text' style={{textTransform: 'none'}} onClick={onReset} disabled={!count || isEqual(defaultFilters, appliedFilters)} color='error'>
              {t('common.reset')}
            </Button>
          </span>
        </div>
        {
          canUpdateDefaultFilters &&
            <div className='col-xs-12 padding-0' style={{textAlign: 'right'}}>
              <Button size='small' sx={{textTransform: 'none'}} onClick={onSetDefaultFilters} disabled={isEmpty(applied) || isEqual(applied, repoDefaultFilters)}>
                {t('search.save_default_filters')}
              </Button>
              <Button size='small' color='error' sx={{textTransform: 'none'}} onClick={onResetDefaultFilters} disabled={!canResetToDefaultFilters}>
                {t('common.reset')}
              </Button>
            </div>
        }
      </div>
      <div className='col-xs-12 padding-0' style={{marginTop: `${topBarHeight}px`, height: `calc(var(--app-height) - ${heightToSubtract || 0}px - ${topBarHeight}px)`, overflowY: 'auto'}}>
        {
          loading && isEmpty(totalFilters) &&
            <div className='col-xs-12' style={{textAlign: 'center', padding: '16px'}}>
              <CircularProgress />
            </div>
        }
        {
          !isEmpty(propertyFacets) &&
            <List
              dense
              sx={{
                width: '100%',
                position: 'relative',
                padding: 0,
                display: 'inline-block',
                marginTop: '8px'
              }}>
              <ListSubheader sx={{padding: '0 8px 0 0px', fontWeight: 'bold', backgroundColor: bgColor, lineHeight: 'normal', color: '#000'}}>
                {t('repo.properties_filters_subheader')}
              </ListSubheader>
              {
                map(propertyFilters.map(prop => prop.code), code => {
                  let field = `properties__${code}`
                  let __filters = propertyFacets[field]
                  if(!__filters){
                    field = code
                    __filters = propertyFacets[field]
                  }
                  if(__filters)
                    return getFilterList(__filters, field)
                })
              }
            </List>
        }
        {
          !isEmpty(uiFilters) &&
            <List
              dense
              sx={{
                width: '100%',
                position: 'relative',
                padding: 0,
                display: 'inline-block',
                marginTop: isEmpty(propertyFacets) ? 0 : '14px'
              }}
            >
              {
                !isEmpty(propertyFacets) &&
                  <ListSubheader sx={{padding: '0 8px 0 0px', fontWeight: 'bold', backgroundColor: bgColor, lineHeight: 'normal', color: '#000'}}>
                    {t('repo.additional_metadata_filters_subheader')}
                  </ListSubheader>
              }
              {map(uiFilters, getFilterList)}
            </List>
        }
      </div>
    </div>
  )
}

export default SearchFilters;
