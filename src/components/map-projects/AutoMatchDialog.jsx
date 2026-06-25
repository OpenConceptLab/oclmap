import React from 'react'
import { useTranslation } from 'react-i18next'

import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormControl from '@mui/material/FormControl';
import Checkbox from '@mui/material/Checkbox';
import FormHelperText from '@mui/material/FormHelperText';
import Button from '@mui/material/Button';
import RadioGroup from '@mui/material/RadioGroup';
import Radio from '@mui/material/Radio';
import FormLabel from '@mui/material/FormLabel';
import Chip from '@mui/material/Chip'

import DoubleArrowIcon from '@mui/icons-material/DoubleArrow';

import map from 'lodash/map'

import CloseIconButton from '../common/CloseIconButton'
import TagCountLabel from '../common/TagCountLabel'
import RepoChip from '../repos/RepoVersionChip'
import AIAssistantButton from './AIAssistantButton'
import AIAssistantSelectorPanel from './AIAssistantSelectorPanel'


const AutoMatchDialog = ({
  open,
  onClose,
  autoMatchScope,
  setAutoMatchScope,
  rowStatuses,
  selectedRowCount,
  autoRunAIAnalysis,
  setAutoRunAIAnalysis,
  AIModels,
  AIModel,
  setAIModel,
  promptTemplates,
  promptTemplate,
  setPromptTemplate,
  repoVersion,
  onSubmit,
  inAIAssistantGroup,
  algosSelected,
  isCoreUser
}) => {
  const { t } = useTranslation()
  const [algos, setAlgos] = React.useState(true)
  const [confirmAllIncludingApproved, setConfirmAllIncludingApproved] = React.useState(false)
  const allRowsCount = rowStatuses.unmapped.length + rowStatuses.readyForReview.length
  const totalRows = rowStatuses.unmapped.length + rowStatuses.readyForReview.length + rowStatuses.reviewed.length
  const rowsInSelectedScope = {
    unmapped: rowStatuses.unmapped.length,
    all: allRowsCount,
    allIncludingApproved: totalRows,
    selected: selectedRowCount
  }
  const rowsToMatchCount = rowsInSelectedScope[autoMatchScope] || 0
  const hasSelectedRows = selectedRowCount > 0
  const hasUnmappedRows = rowStatuses.unmapped.length > 0
  const hasApprovedRows = rowStatuses.reviewed.length > 0
  const isAllIncludingApproved = autoMatchScope === 'allIncludingApproved'

  React.useEffect(() => {
    if (autoMatchScope === 'unmapped' && !hasUnmappedRows) {
      setAutoMatchScope('all')
    }
    if (autoMatchScope === 'allIncludingApproved' && !hasApprovedRows) {
      setAutoMatchScope('all')
    }
  }, [autoMatchScope, hasApprovedRows, hasUnmappedRows, setAutoMatchScope])

  React.useEffect(() => {
    if(!open || !isAllIncludingApproved)
      setConfirmAllIncludingApproved(false)
  }, [isAllIncludingApproved, open])

  const scopeOptions = [
    {
      value: 'selected',
      disabled: !hasSelectedRows,
      label: t('map_project.selected_rows'),
      count: hasSelectedRows ? selectedRowCount : false,
      helperText: hasSelectedRows ?
        t('map_project.auto_match_selected_rows_note', {count: selectedRowCount.toLocaleString()}) :
        t('map_project.auto_match_selected_rows_note_no_count')
    },
    {
      value: 'unmapped',
      disabled: !hasUnmappedRows,
      count: rowStatuses.unmapped.length,
      label: t('map_project.unmapped_only'),
      helperText: t('map_project.auto_match_unmapped_only_note')
    },
    {
      value: 'all',
      disabled: false,
      count: allRowsCount,
      label: t('map_project.unmapped_and_proposed'),
      helperText: t('map_project.auto_match_note', {
        approvedCount: rowStatuses.reviewed.length.toLocaleString(),
        proposedCount: rowStatuses.readyForReview.length.toLocaleString()
      })
    },
    {
      value: 'allIncludingApproved',
      disabled: !hasApprovedRows,
      count: totalRows,
      label: t('map_project.all_including_approved'),
      warning: true,
      helperText: t('map_project.auto_match_all_including_approved_note', {
        approvedCount: rowStatuses.reviewed.length.toLocaleString(),
        proposedCount: rowStatuses.readyForReview.length.toLocaleString()
      })
    }
  ]

  const isDisabled =
    !repoVersion?.version_url ||
    rowsToMatchCount === 0 ||
    (!algos && !autoRunAIAnalysis) ||
    (isAllIncludingApproved && !confirmAllIncludingApproved)

  return (
    <Dialog
      open={open}
      onClose={onClose}
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
      <DialogTitle sx={{padding: '12px 24px', color: 'surface.dark', fontSize: '22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
        <span>{t('map_project.auto_match')}</span>
        <CloseIconButton onClick={onClose} />
      </DialogTitle>
      <DialogContent>
        <div className='col-xs-12 padding-0' style={{display: 'flex', alignItems: 'center', fontSize: '1rem'}}>
          {t('map_project.target_repository')}
          {
            repoVersion?.id &&
              <RepoChip repo={repoVersion} hideType sx={{marginLeft: '16px'}} />
          }
        </div>
        <FormControl sx={{marginTop: '10px'}}>
          <FormLabel id="automatch-rows" sx={{color: 'rgba(0, 0, 0, 0.87)'}}>{`${t('map_project.rows_to_match')}: ${rowsToMatchCount.toLocaleString()} ${t('map_project.out_of')} ${totalRows.toLocaleString()}` }</FormLabel>
          <RadioGroup
            sx={{marginLeft: '12px'}}
            aria-labelledby="automatch-rows"
            name="automatch-rows"
            value={autoMatchScope}
            onChange={event => setAutoMatchScope(event.target.value)}
          >
            {
              scopeOptions.map(option => (
                <div key={option.value}>
                  <FormControlLabel
                    value={option.value}
                    disabled={option.disabled}
                    control={<Radio size='small' />}
                    label={<TagCountLabel label={option.label} count={option.count} normal />}
                    sx={{marginRight: 0}}
                  />
                  <FormHelperText sx={{margin: '-8px 0 0 28px', color: option.warning && autoMatchScope === option.value ? 'warning.main' : undefined}}>
                      {option.helperText}
                    </FormHelperText>
                  {
                    autoMatchScope === option.value && option.value === 'allIncludingApproved' &&
                      <FormControlLabel
                        sx={{marginLeft: '17px', marginTop: '-4px', marginRight: 0}}
                        control={
                          <Checkbox
                            size='small'
                            checked={confirmAllIncludingApproved}
                            onChange={event => setConfirmAllIncludingApproved(event.target.checked)}
                          />
                        }
                        label={t('map_project.auto_match_all_including_approved_confirm', {
                          approvedCount: rowStatuses.reviewed.length.toLocaleString()
                        })}
                      />
                  }
                </div>
              ))
            }
          </RadioGroup>
        </FormControl>

        <FormControl sx={{marginTop: '8px'}}>
          <FormControlLabel control={<Checkbox checked={algos} onChange={() => setAlgos(!algos)} />} label={t('map_project.retrieve_candidates')} />
          <FormLabel id="algorithms" sx={{marginTop: '-4px', marginLeft: '12px'}}>
            {t('map_project.retrieve_candidates_helper_text')}
          </FormLabel>
          <div className='col-xs-12 padding-0' style={{marginLeft: '8px'}}>
            {
              algosSelected.map(algo => {
                return (
                  <Chip variant='outlined' size='small' color='warning' label={algo.id} key={algo.id} sx={{margin: '4px'}} />
                )
              })
            }
          </div>
        </FormControl>

        {
          inAIAssistantGroup &&
            <>
              <FormControlLabel
                sx={{marginTop: '8px', width: '100%'}}
                control={
                  <Checkbox
                    checked={autoRunAIAnalysis}
                    onChange={event => setAutoRunAIAnalysis(event.target.checked)}
                  />
                }
                label={
                  <span>{t('map_project.run_ai_analysis')}</span>
                }
              />
              <FormHelperText sx={{marginTop: '-4px'}}>
                {t('map_project.run_ai_analysis_note')}
              </FormHelperText>
              {
                autoRunAIAnalysis && (
                  isCoreUser ?
                    <AIAssistantSelectorPanel
                      promptTemplates={promptTemplates}
                      promptTemplate={promptTemplate}
                      onPromptTemplateChange={setPromptTemplate}
                      models={AIModels}
                      selectedModel={AIModel}
                      onModelChange={setAIModel}
                      sx={{marginTop: '12px', marginLeft: '12px'}}
                    /> :
                    <AIAssistantButton
                      models={AIModels}
                      selected={AIModel}
                      onClick={() => {}}
                      sx={{marginTop: '12px', marginLeft: '12px'}}
                      onModelChange={setAIModel}
                      popperProps={{
                        sx: {zIndex: 1500}
                      }}
                    />
                )
              }
            </>
        }
      </DialogContent>
      <DialogActions sx={{padding: '16px'}}>
        <Button
          variant='contained'
          size='small'
          sx={{textTransform: 'none', marginLeft: '12px'}}
          endIcon={<DoubleArrowIcon />}
          disabled={isDisabled}
          onClick={event => onSubmit(event, algos ? map(algosSelected, val => val?.id) : [])}
        >
          {t('common.submit')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default AutoMatchDialog
