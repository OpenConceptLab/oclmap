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
import Alert from '@mui/material/Alert';

import DoubleArrowIcon from '@mui/icons-material/DoubleArrow';

import map from 'lodash/map'

import CloseIconButton from '../common/CloseIconButton'
import TagCountLabel from '../common/TagCountLabel'
import RepoChip from '../repos/RepoVersionChip'
import AIAssistantSelectorPanel from './AIAssistantSelectorPanel'
import { getMapperPreview } from '../../common/utils'
import { getRowCapByMatchOperations, getAutoMatchBlocker } from './autoMatchRows'


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
  canSelectAIModel,
  previewEligibleRowIndexes,
  matchAlgorithmIds,
  aiOnlyRowCounts,
  onConfigure
}) => {
  const { t } = useTranslation()
  const [algos, setAlgos] = React.useState(true)
  const [confirmAllIncludingApproved, setConfirmAllIncludingApproved] = React.useState(false)
  const previewEligibleRowIndexSet = React.useMemo(
    () => Array.isArray(previewEligibleRowIndexes) ? new Set(previewEligibleRowIndexes.map(id => id?.toString())) : null,
    [previewEligibleRowIndexes]
  )
  const countEligible = React.useCallback(
    rowIndexes => previewEligibleRowIndexSet ?
      rowIndexes.filter(index => previewEligibleRowIndexSet.has(index?.toString())).length :
      rowIndexes.length,
    [previewEligibleRowIndexSet]
  )
  const unmappedRowsCount = countEligible(rowStatuses.unmapped)
  const readyForReviewRowsCount = countEligible(rowStatuses.readyForReview)
  const reviewedRowsCount = countEligible(rowStatuses.reviewed)
  const allRowsCount = unmappedRowsCount + readyForReviewRowsCount
  const totalRows = allRowsCount + reviewedRowsCount
  const rowsInSelectedScope = {
    unmapped: unmappedRowsCount,
    all: allRowsCount,
    allIncludingApproved: totalRows,
    selected: selectedRowCount
  }
  const rowsToMatchCount = rowsInSelectedScope[autoMatchScope] || 0
  const hasSelectedRows = selectedRowCount > 0
  const hasUnmappedRows = unmappedRowsCount > 0
  const hasApprovedRows = reviewedRowsCount > 0
  const isAllIncludingApproved = autoMatchScope === 'allIncludingApproved'
  const hasAlgorithms = algosSelected.length > 0
  const retrieveCandidates = algos && hasAlgorithms
  const runAI = Boolean(inAIAssistantGroup && autoRunAIAnalysis)
  const isAIOnly = runAI && !retrieveCandidates
  const aiRowsToAnalyse = isAIOnly ? (aiOnlyRowCounts?.analyse || 0) : 0

  // One-time allowance (R2, no reset). Each row costs one match operation per
  // selected algorithm that calls $match (TQ6); scispacy, custom algorithms
  // with their own url and a bridge the user can't run don't spend any.
  const preview = getMapperPreview()
  const matchAlgorithmIdSet = React.useMemo(() => new Set(matchAlgorithmIds || []), [matchAlgorithmIds])
  const matchAlgorithmCount = retrieveCandidates ? algosSelected.filter(algo => matchAlgorithmIdSet.has(algo.id)).length : 0
  const operationsRemaining = (preview.matchOperations.unlimited || !matchAlgorithmCount) ? null : preview.matchOperations.remaining
  const rowCap = getRowCapByMatchOperations(preview.matchOperations, matchAlgorithmCount)
  const willTruncate = rowCap !== null && rowsToMatchCount > rowCap
  const isPreviewQuotaExhausted = willTruncate && rowCap <= 0
  const rowsThisRun = willTruncate ? rowCap : rowsToMatchCount
  const estimatedOperations = rowsThisRun * matchAlgorithmCount
  // One $invoke per row. The AI quota never caps rows: once it runs out, the
  // rest of the run is matched without AI recommendations.
  const aiCallsRemaining = preview.aiAssistantCalls.unlimited ? null : preview.aiAssistantCalls.remaining
  const aiRows = isAIOnly ? aiRowsToAnalyse : rowsThisRun
  const aiRowsCovered = (runAI && aiCallsRemaining !== null) ? Math.min(aiCallsRemaining, aiRows) : null
  const getPreviewEstimate = () => {
    if(isPreviewQuotaExhausted)
      return t('map_project.preview_estimate_no_operations_left')
    const parts = []
    if(operationsRemaining !== null)
      parts.push(t('map_project.preview_estimate_match', {
        rows: rowsThisRun.toLocaleString(),
        algorithms: matchAlgorithmCount.toLocaleString(),
        used: estimatedOperations.toLocaleString(),
        remaining: operationsRemaining.toLocaleString()
      }))
    if(willTruncate)
      parts.push(t('map_project.preview_estimate_will_truncate', {
        allowed: rowsThisRun.toLocaleString(),
        requested: rowsToMatchCount.toLocaleString()
      }))
    if(aiRowsCovered !== null && aiRows > 0) {
      if(aiRowsCovered >= aiRows)
        parts.push(t('map_project.preview_estimate_ai_all', {count: aiRows.toLocaleString()}))
      else if(aiRowsCovered === 0) {
        if(!isAIOnly)
          parts.push(t('map_project.preview_estimate_ai_none'))
      }
      else
        parts.push(t(isAIOnly ? 'map_project.preview_estimate_ai_only_partial' : 'map_project.preview_estimate_ai_partial', {
          covered: aiRowsCovered.toLocaleString(),
          rest: (aiRows - aiRowsCovered).toLocaleString()
        }))
    }
    return parts.join(' ')
  }
  const previewEstimate = rowsToMatchCount > 0 && (operationsRemaining !== null || aiRowsCovered !== null) ? getPreviewEstimate() : ''

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
      count: unmappedRowsCount,
      label: t('map_project.unmapped_only'),
      helperText: t('map_project.auto_match_unmapped_only_note')
    },
    {
      value: 'all',
      disabled: false,
      count: allRowsCount,
      label: t('map_project.unmapped_and_proposed'),
      helperText: t('map_project.auto_match_note', {
        approvedCount: reviewedRowsCount.toLocaleString(),
        proposedCount: readyForReviewRowsCount.toLocaleString()
      })
    },
    {
      value: 'allIncludingApproved',
      disabled: !hasApprovedRows,
      count: totalRows,
      label: t('map_project.all_including_approved'),
      warning: true,
      helperText: t('map_project.auto_match_all_including_approved_note', {
        approvedCount: reviewedRowsCount.toLocaleString(),
        proposedCount: readyForReviewRowsCount.toLocaleString()
      })
    }
  ]

  const blocker = getAutoMatchBlocker({
    rowsInScope: rowsToMatchCount,
    hasAlgorithms,
    retrieveCandidates,
    runAI,
    aiRowsToAnalyse,
    aiCallsRemaining
  })
  const blockerMessages = {
    no_rows: t('map_project.auto_match_blocked_no_rows'),
    no_algorithms: t(inAIAssistantGroup ? 'map_project.auto_match_blocked_no_algorithms_ai' : 'map_project.auto_match_blocked_no_algorithms'),
    no_step: t(inAIAssistantGroup ? 'map_project.auto_match_blocked_no_step_ai' : 'map_project.auto_match_blocked_no_step'),
    no_ai_rows: t('map_project.auto_match_blocked_no_ai_rows'),
    no_ai_calls: t('map_project.auto_match_blocked_no_ai_calls'),
  }

  const isDisabled =
    !repoVersion?.version_url ||
    Boolean(blocker) ||
    isPreviewQuotaExhausted ||
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
        {
          previewEstimate &&
            <Alert severity={isPreviewQuotaExhausted ? 'error' : (willTruncate ? 'warning' : 'info')} sx={{marginBottom: '8px'}}>
              {previewEstimate}
            </Alert>
        }
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
                          approvedCount: reviewedRowsCount.toLocaleString()
                        })}
                      />
                  }
                </div>
              ))
            }
          </RadioGroup>
        </FormControl>

        <FormControl sx={{marginTop: '8px'}}>
          <FormControlLabel control={<Checkbox checked={retrieveCandidates} disabled={!hasAlgorithms} onChange={() => setAlgos(!algos)} />} label={t('map_project.retrieve_candidates')} />
          {
            hasAlgorithms ?
              <>
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
              </> :
              <Alert
                severity='warning'
                sx={{marginTop: '4px', marginLeft: '12px'}}
                action={
                  onConfigure &&
                    <Button variant='contained' color='primary' size='small' sx={{textTransform: 'none', whiteSpace: 'nowrap'}} onClick={onConfigure}>
                      {t('map_project.auto_match_configure_algorithms')}
                    </Button>
                }
              >
                {t('map_project.auto_match_no_algorithms')}
              </Alert>
          }
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
                isAIOnly && rowsToMatchCount > 0 && aiOnlyRowCounts &&
                  <Alert severity={aiRowsToAnalyse ? 'info' : 'warning'} sx={{marginTop: '8px'}}>
                    {t('map_project.auto_match_ai_only_rows', {
                      analyse: aiOnlyRowCounts.analyse.toLocaleString(),
                      skip: aiOnlyRowCounts.skip.toLocaleString()
                    })}
                  </Alert>
              }
              {
                autoRunAIAnalysis && canSelectAIModel &&
                  <AIAssistantSelectorPanel
                    promptTemplates={promptTemplates}
                    promptTemplate={promptTemplate}
                    onPromptTemplateChange={setPromptTemplate}
                    models={AIModels}
                    selectedModel={AIModel}
                    onModelChange={setAIModel}
                    sx={{marginTop: '12px', marginLeft: '12px'}}
                  />
              }
            </>
        }
      </DialogContent>
      <DialogActions sx={{padding: '16px'}}>
        {
          blocker &&
            <FormHelperText sx={{margin: 0, color: 'warning.main'}}>
              {blockerMessages[blocker]}
            </FormHelperText>
        }
        <Button
          variant='contained'
          size='small'
          sx={{textTransform: 'none', marginLeft: '12px'}}
          endIcon={<DoubleArrowIcon />}
          disabled={isDisabled}
          onClick={event => onSubmit(event, retrieveCandidates ? map(algosSelected, val => val?.id) : [])}
        >
          {t('common.submit')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default AutoMatchDialog
