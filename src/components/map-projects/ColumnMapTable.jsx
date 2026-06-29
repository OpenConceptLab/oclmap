import React from 'react';
import Table from '@mui/material/Table'
import TableHead from '@mui/material/TableHead'
import TableBody from '@mui/material/TableBody'
import TableRow from '@mui/material/TableRow'
import TableCell from '@mui/material/TableCell'
import Autocomplete from '@mui/material/Autocomplete'
import TextField from '@mui/material/TextField'
import Switch from '@mui/material/Switch'
import ListItemText from '@mui/material/ListItemText'
import ValidIcon from '@mui/icons-material/CheckCircleOutlined';
import InvalidIcon from '@mui/icons-material/CancelOutlined';
import find from 'lodash/find';
import map from 'lodash/map';
import omit from 'lodash/omit';
import get from 'lodash/get'
import orderBy from 'lodash/orderBy'
import { useTranslation } from 'react-i18next';


const HeaderAutocomplete = ({headers, isValid, ...rest}) => {
  const getOptionLabel = option => {
    if(option?.label)
      return option.label
    const header = find(headers, {id: option})
    if(header?.label)
      return header.label
    if(isValid) {
      if(option?.toLowerCase().includes('class')) {
        return find(headers, {id: 'concept_class'})?.label
      }
      return option
    }
    return ''
  }
  return (
    <Autocomplete
      autoHighlight
      autoComplete
      disablePortal
      blurOnSelect
      fullWidth
      getOptionLabel={getOptionLabel}
      isOptionEqualToValue={(option, value) => option?.id === value?.id || option?.id === value || option === value}
      sx={{
        minWidth: '100px',
        '.MuiButtonBase-root': {color: '#000'}
      }}
      renderInput={(params) => <TextField margin='dense' size='small' {...params} />}
      options={headers}
      renderOption={
        (props, option) => {
          return (
            <ListItemText
              {...props}
              sx={{...props.sx, flexDirection: 'column', alignItems: 'flex-start !important'}}
              key={option?.id || 'unknown'}
              primary={option?.label || ''}
              secondary={option?.description || ''}
            />
          )
        }
      }
      {...rest}
    />
  )
}


const TargetSourceAutoComplete = ({sources, possibleValue, selected, onChange, ...rest}) => {
  React.useEffect(() => {
    if(possibleValue && !selected) {
      const possibleSource = find(sources, source => {
        let matched = source.id.toLowerCase().match(possibleValue.toLowerCase())
        if(!matched)
          matched = source.id.toLowerCase().replace('-', '').replace(' ', '').replace('_', '').match(possibleValue.toLowerCase().replace('-', '').replace(' ', '').replace('_', ''))
        return Boolean(matched)
      })
      if(possibleSource?.url)
        onChange(possibleSource?.url)
    }
  }, [])
  return <Autocomplete
           autoHighlight
           autoComplete
           disablePortal
           blurOnSelect
           fullWidth
           getOptionLabel={option => option.id || ''}
           isOptionEqualToValue={(option, value) => option?.url === value}
           sx={{
             minWidth: '100px',
             '.MuiButtonBase-root': {color: '#000'}
           }}
           renderInput={(params) => <TextField margin='dense' size='small' {...params} />}
           options={orderBy(sources, 'id')}
           value={selected ? find(sources, {url: selected}) || '' : ''}
           onChange={(event, val) => onChange(val?.url)}
           {...rest}
         />
}

const ColumnMapTable = ({
  validColumns, columns, isValid, onUpdate, sx, mappedSources, targetSourcesFromRows,
  setColumnVisibilityModel, columnVisibilityModel,
  setAIAssistantColumns, AIAssistantColumns,
  inAIAssistantGroup
}) => {
  const { t } = useTranslation();
  const [random, setRandom] = React.useState(0)
  const onValChange = (position, value, key) => {
    onUpdate(position, value, key)
    setRandom(random + 1)
  }

  return (
    <Table size='small' sx={{'.MuiTableCell-root': {padding: '3px 8px'}, ...sx}}>
      <TableHead>
        <TableRow>
          <TableCell sx={{width: '40%'}}><b>{t('map_project.input_column')}</b></TableCell>
          <TableCell sx={{width: '40%'}}><b>{t('map_project.mapped_field')}</b></TableCell>
          <TableCell align='center'><b>{t('common.show')}</b></TableCell>
          {
            inAIAssistantGroup &&
              <TableCell align='center'><b>{t('map_project.column_send_to_ai_assistant')}</b></TableCell>
          }
        </TableRow>
      </TableHead>
      <TableBody>
        {
          map(columns, (column, position) => {
            const isValidColumn = isValid(column.label)
            const isHidden = columnVisibilityModel[column.dataKey] === false
            const sendToAIAssistant = AIAssistantColumns[column.dataKey] === false
            return (
              <TableRow key={column.original}>
                <TableCell sx={{width: '40%'}}>
                  <span style={{display: 'flex', alignItems: 'center'}}>
                    {
                      isValidColumn ?
                        <ValidIcon sx={{marginRight: '8px'}} fontSize='small' color='success' /> :
                      <InvalidIcon sx={{marginRight: '8px'}} fontSize='small' color='error' />
                    }
                    {column.original}
                  </span>
                </TableCell>
                <TableCell sx={{width: '40%'}}>
                  <>
                    <HeaderAutocomplete
                      headers={validColumns}
                      value={column.label}
                      id={position.toString()}
                      isValid={isValidColumn}
                      onChange={(event, value) => onValChange(position, value?.label || value)}
                    />
                    {
                      'Mapping: List' === column.label &&
                        <div>
                          {
                            map(targetSourcesFromRows[column.dataKey], (target, index) => {
                              return (
                                <div key={index} style={{display: 'flex', alignItems: 'center'}}>
                                  <span style={{marginRight: '8px'}}>
                                    {target}:
                                  </span>
                                  <TargetSourceAutoComplete
                                    sources={mappedSources}
                                    possibleValue={target}
                                    selected={get(column.targetSource, target)}
                                    onChange={value => onValChange(position, {...column.targetSource, [target]: value}, 'targetSource')}
                                  />
                                </div>
                              )
                            })
                          }
                        </div>
                    }
                    {
                      'Mapping: Code' === column.label &&
                        <div style={{display: 'flex', alignItems: 'center'}}>
                          <span style={{marginRight: '8px'}}>
                            {targetSourcesFromRows[column.dataKey]}:
                          </span>
                          <TargetSourceAutoComplete
                            sources={mappedSources}
                            possibleValue={targetSourcesFromRows[column.dataKey]}
                            selected={get(column.targetSource, targetSourcesFromRows[column.dataKey])}
                            onChange={value => onValChange(position, {...column.targetSource, [targetSourcesFromRows[column.dataKey]]: value}, 'targetSource')}
                          />
                        </div>
                    }
                  </>
                </TableCell>
                <TableCell align='center'>
                  <Switch size="small" checked={!isHidden} onChange={() => setColumnVisibilityModel(isHidden ? omit(columnVisibilityModel, [column.dataKey]) : {...columnVisibilityModel, [column.dataKey]: false})}/>
                </TableCell>
                {
                  inAIAssistantGroup &&
                    <TableCell align='center'>
                      <Switch size="small" checked={!sendToAIAssistant} onChange={() => setAIAssistantColumns(sendToAIAssistant ? omit(AIAssistantColumns, [column.dataKey]) : {...AIAssistantColumns, [column.dataKey]: false})}/>
                    </TableCell>
                }
              </TableRow>
            )
          })
        }
      </TableBody>
    </Table>
  )
}

export default ColumnMapTable
