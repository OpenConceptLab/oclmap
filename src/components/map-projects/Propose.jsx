import React from 'react'
import { useTranslation } from 'react-i18next';
import times from 'lodash/times'
import get from 'lodash/get'
import { find, forEach} from 'lodash'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import { LockMark, LockTooltip, useEditLock } from '../common/NoticeLock'

const Propose = ({onChange, proposed, onSubmit, repo, row, columns}) => {
  const { t } = useTranslation();
  const lock = useEditLock()
  const [attributes, setAttributes] = React.useState(1)
  const repoLabel = `${repo?.short_code || repo?.id}:${repo?.version || repo.id}`

 const getStateFromRow = () => {
    let _state = {id: '', name: '', attributes: []}
   forEach(row, (value, key) => {
     if(!key.startsWith('__')) {
       const col = find(columns, {dataKey: key})
       if(col?.label) {
         if(['id', 'name'].includes(col.label.toLowerCase()))
           _state[col.label.toLowerCase()] = value
         else
           _state.attributes.push({name: col.label, value: value})
       } else {
         _state.attributes.push({name: key, value: value})
       }
     }
    })
   return _state
  }

  const [state, setState] = React.useState({})

  const _onChange = event => {
    event.persist()
    let newState;
    if(event.target.id.includes('attributes.')) {
      const idParts = event.target.id.split('.')
      const attributeIndex = parseInt(idParts[1])
      const attributeType = idParts[2]
      const newAttributes = [...state.attributes]
      newAttributes[attributeIndex][attributeType] = event.target.value
      newState = {...state, attributes: newAttributes}
      setState(newState)
    } else {
      newState = {...state, [event.target.id]: event.target.value}
      setState(newState)
    }
    onChange(newState)
  }

  React.useEffect(() => {
    const stateFromRow = getStateFromRow()
    let _attributes = proposed?.attributes?.length ? [...proposed.attributes] || [] : [...stateFromRow.attributes] || []
    let _proposed = {...proposed}
    _proposed.attributes = [...(proposed?.attributes || [])]
    forEach(_proposed, (value, key) => {
      if(key.includes('attributes.')) {
        let parts = key.split('.')
        _proposed.attributes[parseInt(parts[1])][parts[2]] = value
        delete _proposed[key]
      }
    })
    setState({
      ..._proposed,
      source: proposed?.source || repoLabel || '',
      id: proposed?.id || stateFromRow?.id || '',
      name: proposed?.name || stateFromRow?.name || '',
      attributes: _attributes,
      map_type: proposed?.map_type || 'SAME-AS',
      note: proposed?.note || ''
    })
    setAttributes(_attributes?.length && _attributes.length > 0 ? _attributes.length : 1)
  }, [row])

  const _onSubmit = event => {
    event.persist()
    onSubmit(event, state)
  }

  return (
    <div className='col-xs-12 padding-0' style={{margin: '12px 0'}}>
      <div className='col-xs-12 padding-0'>
        <TextField id='source' sx={{width: 'calc(50% - 12px)', margin: '4px 6px'}} label={t('map_project.target_source')} value={state.source || ''} onChange={_onChange}/>
        <TextField id='id' sx={{width: 'calc(50% - 12px)', margin: '4px 6px'}} label={t('map_project.concept_id')} value={state?.id || ''} onChange={_onChange}/>
        <TextField id='name' sx={{width: 'calc(50% - 12px)', margin: '4px 6px',}} label={t('common.name')} value={state?.name || ''} onChange={_onChange}/>
        <TextField id='map_type' sx={{width: 'calc(50% - 12px)', margin: '4px 6px',}} label={t('map_project.map_type')} value={state?.map_type || 'SAME-AS'} onChange={_onChange}/>
        <Typography sx={{fontWeight: 'bold', margin: '10px 10px 4px'}}>{t('common.attributes')}</Typography>
        {
          times(attributes, i => {
            return (
              <div className='col-xs-12 padding-0' key={i}>
                <TextField id={`attributes.${i}.name`} sx={{width: 'calc(50% - 12px)', margin: '4px 6px'}} label={t('map_project.attribute_name')} value={get(state, `attributes.${i}.name`) || ''} onChange={_onChange}/>
                <TextField id={`attributes.${i}.value`} sx={{width: 'calc(50% - 12px)', margin: '4px 6px'}} label={t('map_project.attribute_value')} value={get(state, `attributes.${i}.value`) || ''} onChange={_onChange}/>
              </div>
            )
          })
        }
        <Button sx={{marginLeft: '8px', textTransform: 'none'}} size='small' variant='text' onClick={() => setAttributes(attributes + 1)}>
          {t('map_project.add_more')}
        </Button>
      </div>
      <div className='col-xs-12 padding-0' style={{margin: '16px 0'}}>
        <TextField
          fullWidth
          id="note"
          label={t('map_project.proposal_note')}
          multiline
          rows={5}
          value={state?.note || ''}
          onChange={_onChange}
        />
      </div>
      <div className='col-xs-12 padding-0' style={{margin: '16px 0', display: 'flex', alignItems: 'center'}}>
        <LockTooltip title={lock}>
        <Button color='primary' onClick={_onSubmit} disabled={Boolean(lock)} startIcon={lock ? <LockMark /> : undefined} variant='contained' sx={{textTransform: 'none'}}>
          {t('map_project.propose')}
        </Button>
        </LockTooltip>
      </div>
    </div>
  )
}

export default Propose
