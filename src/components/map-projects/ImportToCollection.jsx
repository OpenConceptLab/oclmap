import React from 'react';
import { useTranslation, Trans } from 'react-i18next';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button'
import FormHelperText from '@mui/material/FormHelperText';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormControl from '@mui/material/FormControl';
import Collapse from '@mui/material/Collapse';
import Tooltip from '@mui/material/Tooltip';
import Badge from '@mui/material/Badge';
import Checkbox from '@mui/material/Checkbox';
import {
  Help as HelpIcon,
  ArrowDropDown as ArrowDropDownIcon,
  ArrowDropUp as ArrowDropUpIcon,
} from '@mui/icons-material'

import { PRIMARY_COLORS } from '../../common/colors';
import { toV3URL } from '../../common/utils'
import HtmlTooltip from '../common/HTMLTooltip';

import RepoSearchAutocomplete from '../repos/RepoSearchAutocomplete'

const ImportToCollection = ({ onImport, onClose, open, rowStatuses }) => {
  const { t } = useTranslation()
  const [collection, setCollection] = React.useState(null)
  const [scope, setScope] = React.useState('approved')

  const [cascadeMethod, setCascadeMethod] = React.useState('none')
  const [transformReferences, setTransformReferences] = React.useState(false)
  const [advancedSettings, setAdvancedSettings] = React.useState(false)

  const approvedCount = rowStatuses.reviewed.length
  const proposedCount = rowStatuses.readyForReview.length
  let count = scope === 'all' ? proposedCount + approvedCount : approvedCount

  const onChange = event => {
    const newValue = event.target.value
    setCascadeMethod(newValue)
    setTransformReferences(newValue === 'OpenMRSCascade')
  }
  const toggleSettings = () => setAdvancedSettings(!advancedSettings)
  const handleClose = (event, reason) => {
    if (reason === 'escapeKeyDown') {
      return
    }
    onClose(event, reason)
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      scroll='paper'
      sx={{
        '& .MuiDialog-paper': {
          borderRadius: '28px',
          minWidth: '312px',
          minHeight: '262px',
          padding: 0
        }
      }}
    >
      <DialogTitle sx={{padding: '12px 24px', color: 'surface.dark', fontSize: '22px', textAlign: 'left'}}>
        {t('map_project.save_to_collection')}
      </DialogTitle>
      <DialogContent sx={{paddingTop: '8px !important'}}>
        <RepoSearchAutocomplete
          label={t('repo.collection')}
          size='small'
          onChange={(id, item) => setCollection(item)}
          value={collection}
          repoType='collections'
          ownRepo
          autoFocus={!collection?.id}
        />
        <FormControl sx={{marginTop: '12px'}}>
          <RadioGroup
            aria-labelledby="import-radio-buttons-group-label"
            defaultValue="all"
            value={scope}
            name="radio-buttons-group"
            onChange={event => setScope(event.target.value)}
          >
            <FormControlLabel size='small' value='approved' control={<Radio size='small' />} label={t('map_project.approved_target_concepts_only')} />
            <FormControlLabel size='small' value='all' control={<Radio size='small' />} label={t('map_project.all_approved_and_proposed_target_concepts')} />
          </RadioGroup>
        </FormControl>

        <h4 style={{marginBottom: '5px'}}>
          {t('map_project.would_you_like_to_cascade')}
          </h4>
          <FormControl style={{marginBottom: '5px'}}>
            <RadioGroup
              aria-labelledby="demo-controlled-radio-buttons-group"
              name="controlled-radio-buttons-group"
              value={cascadeMethod}
              onChange={onChange}
            >
              <FormControlLabel
                value="none"
                control={<Radio size='small' />}
                label={
                  <span className='flex-vertical-center'>
                    <span style={{marginRight: '5px', fontSize: '14px'}}>
                      {t('map_project.no_only_include_the_selected_resources')}
                    </span>
                  </span>
                }
              />
              <FormControlLabel
                value="sourcemappings"
                control={<Radio size='small' />}
                label={
                  <span className='flex-vertical-center'>
                    <span style={{marginRight: '5px', fontSize: '14px'}}>
                      {t('map_project.yes_include_associated_mappings_from_same_source')}
                    </span>
                  </span>
                }
              />
              <FormControlLabel
                value="sourcetoconcepts"
                control={<Radio size='small' />}
                label={
                  <span className='flex-vertical-center'>
                    <span style={{marginRight: '5px', fontSize: '14px'}}>
                      {t('map_project.yes_include_associated_mappings_and_target_concepts_from_same_source')}
                    </span>
                  </span>
                }
              />
              <FormControlLabel
                value="OpenMRSCascade"
                control={<Radio size='small' />}
                label={
                  <span className='flex-vertical-center'>
                    <span style={{marginRight: '5px', fontSize: '14px'}}>
                      {t('map_project.yes_apply_openmrs_cascade')}
                    </span>
                    <Tooltip arrow title={t('map_project.openmrs_cascade_tooltip')}>
                      <HelpIcon fontSize='small' style={{fontSize: '14px'}}/>
                    </Tooltip>
                  </span>
                }
              />
            </RadioGroup>
                <div className='col-xs-12 no-side-padding' style={{marginTop: '10px'}}>
                <Badge badgeContent={transformReferences && !advancedSettings ? 1 : 0} color='primary'>
                  <Button
                    size='small'
                    variant='text'
                    endIcon={
                      advancedSettings ?
                        <ArrowDropUpIcon fontSize='inherit' /> :
                        <ArrowDropDownIcon fontSize='inherit' />
                    }
                    style={{textTransform: 'none', marginLeft: '-4px'}}
                    onClick={toggleSettings}>
                    {t('common.advance_settings')}
                  </Button>
                </Badge>
                  <Collapse in={advancedSettings} timeout="auto" unmountOnExit style={{marginTop: '-15px'}}>
                    {
                      advancedSettings &&
                        <div className='col-xs-12 no-side-padding' style={{margin: '15px 0'}}>
                        <FormControlLabel
                          control={<Checkbox checked={transformReferences} onChange={() => setTransformReferences(!transformReferences)}/>}
                          label={
                            <span className='flex-vertical-center'>
                              <span style={{marginRight: '5px', fontSize: '14px'}}>
                                {t('map_project.transform_to_extensional_references')}
                              </span>
                              <HtmlTooltip
                                placement='right'
                                title={
                                  <span>
                                    <span>
                                      {t('map_project.transform_to_extensional_tooltip_1')}
                                  </span>
                                    <br />
                                    <br />
                                    <span>
                                      <Trans
                                        i18nKey='map_project.transform_to_extensional_tooltip_2'
                                        components={[
                                    <a key={0} href="https://www.youtube.com/watch?v=bl2IilO0Fec&list=PLbjKElEpop-Ubhm5Xz4sQ7u7ugune_CXF&index=2" target="_blank" rel="noopener noreferrer" style={{color: 'inherit', textDecoration: 'underline', fontWeight: 'bold'}}>YouTube video</a>
                                        ]}
                                      />
                                    </span>
                                  </span>
                                }
                                arrow
                              >
                                <HelpIcon fontSize='small' style={{fontSize: '14px'}}/>
                              </HtmlTooltip>
                            </span>
                          }
                        />
                        </div>
                    }
                  </Collapse>
        </div>

          </FormControl>
        {
        collection?.url &&
        <FormHelperText sx={{fontWeight: 'bold', fontSize: '1rem', marginTop: '8px'}}>
          <Trans
            i18nKey='map_project.concepts_will_be_added_to_this_collection'
            components={[
              <a key={collection?.name} className='no-anchor-styles' style={{color: PRIMARY_COLORS.main}} target='_blank' href={toV3URL(collection?.url)} rel="noreferrer">{collection?.name}</a>
            ]}
            values={{
              count: count.toLocaleString(),
              collectionName: collection?.name
            }}
          />
        </FormHelperText>
        }
        </DialogContent>
      <DialogActions sx={{padding: '16px'}}>
        <Button
          color='default'
          variant='contained'
          size='small'
          sx={{textTransform: 'none'}}
          onClick={onClose}
        >
          {t('common.close')}
        </Button>
        <Button
          variant='contained'
          size='small'
          sx={{textTransform: 'none', marginLeft: '12px'}}
          disabled={!collection?.url || !count}
          onClick={() => onImport(collection, scope, cascadeMethod, transformReferences)}
        >
          {t('common.save')}
        </Button>
        </DialogActions>
    </Dialog>
  )
}

export default ImportToCollection
