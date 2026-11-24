import React from 'react'
import Chip from '@mui/material/Chip'
import Typography from '@mui/material/Typography'
import CheckIcon from '@mui/icons-material/CheckCircleOutlineOutlined';
import { useTranslation } from 'react-i18next';
import { LockMark, LockTooltip, useEditLock } from '../common/NoticeLock'

const DecisionSelector = ({selected, onChange, disabledMap, disabledPropsed}) => {
  const { t } = useTranslation();
  const lock = useEditLock()
  const locked = chip => <LockTooltip title={lock}>{chip}</LockTooltip>
  let styles = {margin: '0 2px', width: '100px', padding: '4px'}
  return (
    <div className='col-xs-12 padding-0' style={{display: 'flex', margin: '8px 0', alignItems: 'center'}}>
      <Typography component='span' sx={{color: 'surface.dark', fontWeight: 600, marginRight: '24px', fontSize: '14px'}}>
        {t('map_project.decision')}
      </Typography>
      <div style={{display: 'flex', alignItems: 'center', width: 'calc(100% - 80px)'}}>
        {lock && <LockMark sx={{fontSize: '18px', mr: 0.5}} />}
        {locked(<Chip
          size='small'
          sx={{...styles, margin: '0 2px 0 0'}}
          label={t('map_project.decision_none')}
          color='secondary'
          variant={!selected || selected === 'none' ? 'contained' : 'outlined'}
          onClick={event => onChange(event, undefined)}
          icon={!selected || selected === 'none' ? <CheckIcon fontSize='small' /> : undefined}
          disabled={Boolean(lock)}
        />)}
        {locked(<Chip
          size='small'
          sx={styles}
          label={t('map_project.decision_map')}
          color='primary'
          variant={selected === 'map' ? 'contained' : 'outlined'}
          onClick={event => onChange(event, 'map')}
          icon={selected === 'map' ? <CheckIcon fontSize='small' /> : undefined}
          disabled={Boolean(lock) || disabledMap}
        />)}
        {locked(<Chip
          size='small'
          sx={styles}
          label={t('map_project.decision_propose')}
          color='warning'
          variant={selected === 'propose' ? 'contained' : 'outlined'}
          onClick={event => onChange(event, 'propose')}
          icon={selected === 'propose' ? <CheckIcon /> : undefined}
          disabled={Boolean(lock) || disabledPropsed}
        />)}
        {locked(<Chip
          size='small'
          sx={{...styles, margin: '0 0 0 2px'}}
          label={t('map_project.decision_exclude')}
          color='error'
          variant={selected === 'exclude' ? 'contained' : 'outlined'}
          onClick={event => onChange(event, 'exclude')}
          icon={selected === 'exclude' ? <CheckIcon /> : undefined}
          disabled={Boolean(lock)}
        />)}
      </div>
    </div>
  )
}

export default DecisionSelector
