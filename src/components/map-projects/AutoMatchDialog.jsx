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
  const allRowsCount = rowStatuses.unmapped.length + rowStatuses.readyForReview.length
  const rowsInSelectedScope = {
    unmapped: rowStatuses.unmapped.length,
    all: allRowsCount,
    selected: selectedRowCount
  }
  const rowsToMatchCount = rowsInSelectedScope[autoMatchScope] || 0
  const totalRows = rowStatuses.unmapped.length + rowStatuses.readyForReview.length + rowStatuses.reviewed.length
  const hasSelectedRows = selectedRowCount > 0
  const hasUnmappedRows = rowStatuses.unmapped.length > 0

  React.useEffect(() => {
    if (autoMatchScope === 'unmapped' && !hasUnmappedRows) {
      setAutoMatchScope('all')
    }
  }, [autoMatchScope, hasUnmappedRows, setAutoMatchScope])

  const scopeOptions = [
    {
      value: 'all',
      disabled: false,
      label: `${t('map_project.unmapped_and_proposed')} (${allRowsCount.toLocaleString()})`,
      helperText: t('map_project.auto_match_note', {
        approvedCount: rowStatuses.reviewed.length.toLocaleString(),
        proposedCount: rowStatuses.readyForReview.length.toLocaleString()
      })
    },
    {
      value: 'unmapped',
      disabled: !hasUnmappedRows,
      label: `${t('map_project.unmapped_only')} (${rowStatuses.unmapped.length.toLocaleString()})`,
      helperText: rowStatuses.unmapped.length > 0 ?
        t('map_project.auto_match_unmapped_only_note', {count: rowStatuses.unmapped.length.toLocaleString()}) :
        t('map_project.auto_match_unmapped_only_note_no_count')
    },
    {
      value: 'selected',
      disabled: !hasSelectedRows,
      label: `${t('map_project.selected_rows')} (${selectedRowCount.toLocaleString()})`,
      helperText: hasSelectedRows ?
        t('map_project.auto_match_selected_rows_note', {count: selectedRowCount.toLocaleString()}) :
        t('map_project.auto_match_selected_rows_note_no_count')
    }
  ]

  const isDisabled = !repoVersion?.version_url || rowsToMatchCount === 0 || (!algos && !autoRunAIAnalysis)

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
        <FormControl sx={{marginTop: '16px'}}>
          <FormLabel id="automatch-rows">{`${t('map_project.rows_to_match')}: ${rowsToMatchCount.toLocaleString()} ${t('map_project.out_of')} ${totalRows.toLocaleString()}` }</FormLabel>
          <RadioGroup
            aria-labelledby="automatch-rows"
            name="automatch-rows"
            value={autoMatchScope}
            onChange={event => setAutoMatchScope(event.target.value)}
          >
            {
              scopeOptions.map(option => (
                <div key={option.value} style={{marginBottom: '8px'}}>
                  <FormControlLabel
                    value={option.value}
                    disabled={option.disabled}
                    control={<Radio />}
                    label={option.label}
                    sx={{marginRight: 0}}
                  />
                  {
                    autoMatchScope === option.value &&
                      <FormHelperText sx={{margin: '0 0 0 32px'}}>
                        {option.helperText}
                      </FormHelperText>
                  }
                </div>
              ))
            }
          </RadioGroup>
        </FormControl>

        <FormControl sx={{marginTop: '16px'}}>
          <FormControlLabel control={<Checkbox checked={algos} onChange={() => setAlgos(!algos)} />} label={t('map_project.retrieve_candidates')} />
          <FormLabel id="algorithms">
            {t('map_project.retrieve_candidates_helper_text')}
          </FormLabel>
          <div className='col-xs-12 padding-0'>
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
                sx={{marginTop: '16px', width: '100%'}}
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
                      sx={{marginTop: '12px'}}
                    /> :
                    <AIAssistantButton
                      models={AIModels}
                      selected={AIModel}
                      onClick={() => {}}
                      sx={{marginTop: '12px'}}
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
