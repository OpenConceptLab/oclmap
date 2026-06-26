import React from 'react'
import { useTranslation } from 'react-i18next';
import Chip from '@mui/material/Chip';
import FormControl from '@mui/material/FormControl';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Typography from '@mui/material/Typography';

import DoneIcon from '@mui/icons-material/Done';
import CloseIcon from '@mui/icons-material/Close';
import ClearIcon from '@mui/icons-material/Clear';

import debounce from 'lodash/debounce'
import filter from 'lodash/filter'
import keys from 'lodash/keys'
import pickBy from 'lodash/pickBy'
import startCase from 'lodash/startCase'
import without from 'lodash/without'

import { SURFACE_COLORS, WHITE } from '../../common/colors';
import ScoreBucketButton from './ScoreBucketButton'
import SearchField from './SearchField'

const getBulkActionMeta = (action, t) => {
  if(action === 'approve')
    return {label: t('map_project.approve'), color: 'primary.main', icon: <DoneIcon fontSize='inherit' />}
  if(action === 'rejected')
    return {label: t('map_project.reject'), color: 'error.main', icon: <CloseIcon fontSize='inherit' />}
  if(action === 'exclude')
    return {label: t('map_project.decision_exclude'), color: 'error.main', icon: <CloseIcon fontSize='inherit' />}
  if(action === 'clear')
    return {label: t('map_project.bulk_clear'), color: 'secondary.main', icon: <ClearIcon fontSize='inherit' />}
  return {label: action, color: 'surface.dark', icon: null}
}

const DataGridControls = ({
  selectedRowStatus,
  selectedCandidatesScoreBucket,
  scoreBucketSortBy,
  onScoreBucketSort,
  onScoreBucketClick,
  recommendedCount,
  availableCount,
  lowRankedCount,
  decisions,
  decisionFilters,
  setDecisionFilters,
  rowStatuses,
  selectedRowsCount,
  bulkDecisionAction,
  onBulkDecisionChange,
  bulkConfirm,
  bulkMapType,
  onBulkMapTypeChange,
  allMapTypes,
  onSearchTextChange
}) => {
  const { t } = useTranslation();
  const raisedBulkSelectSx = {
    height: '34px',
    backgroundColor: '#7F7AF8',
    color: WHITE,
    fontSize: '14px',
    borderRadius: '8px',
    boxShadow: '0 3px 8px rgba(90, 79, 255, 0.32)',
    '.MuiOutlinedInput-notchedOutline': {
      border: 'none'
    },
    '&:hover .MuiOutlinedInput-notchedOutline': {
      border: 'none'
    },
    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
      border: 'none'
    },
    '.MuiSelect-icon': {
      color: WHITE,
      right: '10px'
    },
    '.MuiSelect-select': {
      display: 'flex',
      alignItems: 'center',
      fontWeight: 500,
      fontSize: '14px',
      lineHeight: 1.43,
      color: WHITE,
      padding: '7px 36px 7px 12px !important'
    }
  }

  const debouncedSearchChange = React.useMemo(
    () => debounce(val => onSearchTextChange(val || ''), 300),
    [onSearchTextChange]
  )

  React.useEffect(() => () => debouncedSearchChange.cancel(), [debouncedSearchChange])

  return (
    <>
      <div className='col-xs-12' style={{padding: '12px 14px 8px 14px', display: 'flex', alignItems: 'center', backgroundColor: SURFACE_COLORS.main}}>
        <FormControl sx={{minWidth: '16px'}}>
          <SearchField onChange={debouncedSearchChange} />
        </FormControl>
        <ScoreBucketButton
          selected={selectedCandidatesScoreBucket}
          onSort={onScoreBucketSort}
          sortBy={scoreBucketSortBy}
          onClick={onScoreBucketClick}
          recommended={recommendedCount}
          available={availableCount}
          low_ranked={lowRankedCount}
        />
        <div style={{display: 'inline-block'}}>
          {
            selectedRowStatus === 'unmapped' &&
              <Chip
                label={`${t('map_project.rejected')} (${keys(pickBy(decisions, value => value === 'rejected')).length})`}
                color='error'
                size='small'
                variant={decisionFilters.includes('rejected') ? 'contained' : 'outlined'}
                icon={
                  decisionFilters.includes('rejected') ?
                    <CloseIcon fontSize='inherit' /> :
                    <DoneIcon fontSize='inherit' />
                }
                onClick={
                  () => setDecisionFilters(
                    decisionFilters.includes('rejected') ?
                      without(decisionFilters, 'rejected') :
                      [...decisionFilters, 'rejected']
                  )
                }
                sx={{margin: '4px'}}
              />
          }
          {
            ['reviewed', 'readyForReview'].includes(selectedRowStatus) &&
              <React.Fragment>
                {
                  ['map', 'exclude', 'none', 'propose'].map(_decision => {
                    const isApplied = decisionFilters.includes(_decision)
                    const isExclude = _decision === 'exclude'
                    const isNone = _decision === 'none'
                    const isPropose = _decision === 'propose'
                    const count = filter(keys(pickBy(decisions, value => isNone ? !value : value === _decision)), index => rowStatuses[selectedRowStatus].includes(parseInt(index))).length
                    return (
                      <Chip
                        key={_decision}
                        disabled={!count}
                        label={`${t(`map_project.decision_${_decision}`) || startCase(_decision)} (${count})`}
                        color={isExclude ? 'error' : (isNone ? 'secondary' : (isPropose ? 'warning' : 'primary'))}
                        size='small'
                        variant={isApplied ? 'contained' : 'outlined'}
                        icon={
                          isApplied ?
                            <CloseIcon fontSize='inherit' /> :
                            <DoneIcon fontSize='inherit' />
                        }
                        onClick={
                          () => setDecisionFilters(
                            isApplied ?
                              without(decisionFilters, _decision) :
                              [...decisionFilters, _decision]
                          )
                        }
                        sx={{margin: '4px'}}
                      />
                    )
                  })
                }
              </React.Fragment>
          }
        </div>
      </div>
      {
        selectedRowsCount > 0 &&
          <div className='col-xs-12' style={{padding: '8px 14px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', backgroundColor: '#e9e4ff', borderTop: 'solid 1px rgba(76, 53, 255, 0.15)', borderBottom: 'solid 1px rgba(76, 53, 255, 0.15)'}}>
            <Typography component='span' sx={{fontSize: '14px', fontWeight: 600, color: 'surface.dark', marginRight: '8px'}}>
              {t('map_project.bulk_selected', {count: selectedRowsCount})}
            </Typography>
            <FormControl size='small' variant='outlined'>
              <Select
                displayEmpty
                value={bulkDecisionAction}
                onChange={onBulkDecisionChange}
                renderValue={selected => {
                  if(!selected)
                    return t('map_project.decision')
                  const meta = getBulkActionMeta(selected, t)
                  return (
                    <span style={{display: 'inline-flex', alignItems: 'center', gap: '8px', color: 'inherit', fontSize: '14px', fontWeight: 500, lineHeight: 1.43}}>
                      <span style={{display: 'inline-flex', alignItems: 'center', fontSize: '16px', color: meta.color}}>
                        {meta.icon}
                      </span>
                      <span>{meta.label}</span>
                    </span>
                  )
                }}
                sx={{
                  ...raisedBulkSelectSx,
                }}
              >
                {
                  ['approve', 'rejected', 'exclude', 'clear'].map(action => {
                    const meta = getBulkActionMeta(action, t)
                    return (
                      <MenuItem key={action} value={action} sx={{color: meta.color}}>
                        <ListItemIcon sx={{color: meta.color, minWidth: '36px'}}>
                          {meta.icon}
                        </ListItemIcon>
                        <ListItemText
                          primary={meta.label}
                          primaryTypographyProps={{sx: {fontSize: '1rem', fontWeight: 400, lineHeight: 1.5}}}
                        />
                      </MenuItem>
                    )
                  })
                }
              </Select>
            </FormControl>
            <FormControl size='small' variant='outlined'>
              <Select
                value={bulkConfirm?.action === 'map_type' ? bulkConfirm?.mapType : bulkMapType}
                onChange={onBulkMapTypeChange}
                renderValue={selected => `${t('map_project.map_type')}: ${selected}`}
                sx={{
                  ...raisedBulkSelectSx,
                }}
              >
                {
                  (allMapTypes?.length ? allMapTypes : ['SAME-AS']).map(option => (
                    <MenuItem key={option} value={option} sx={{color: 'surface.dark'}}>
                      {option}
                    </MenuItem>
                  ))
                }
              </Select>
            </FormControl>
          </div>
      }
    </>
  )
}

export default DataGridControls
