import React from 'react'
import { useTranslation, Trans } from 'react-i18next'

import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
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
import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';

import DoubleArrowIcon from '@mui/icons-material/DoubleArrow';

import map from 'lodash/map'

import CloseIconButton from '../common/CloseIconButton'
import TagCountLabel from '../common/TagCountLabel'
import RepoChip from '../repos/RepoVersionChip'
import AIAssistantSelectorPanel from './AIAssistantSelectorPanel'
import { getAutoMatchBlocker } from './autoMatchRows'
// A private package can fill this checkpoint in; see autoMatchCheck.js.
import useAutoMatchCheck from 'ocl-online-mapper'

// Lines an option's sub-text up with its checkbox label.
const SUBTEXT_SX = {margin: '-6px 0 0 32px'}

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
  runnableAlgos,
  retrieveCandidates: retrieveCandidatesChecked,
  setRetrieveCandidates,
  canSelectAIModel,
  eligibleRowIndexes,
  matchAlgorithmIds,
  aiOnlyRowCounts,
  onConfigure
}) => {
  const { t } = useTranslation()
  // Rows a run may include; null means every row.
  const eligibleRowIndexSet = React.useMemo(
    () => Array.isArray(eligibleRowIndexes) ? new Set(eligibleRowIndexes.map(id => id?.toString())) : null,
    [eligibleRowIndexes]
  )
  const countEligible = React.useCallback(
    rowIndexes => eligibleRowIndexSet ?
      rowIndexes.filter(index => eligibleRowIndexSet.has(index?.toString())).length :
      rowIndexes.length,
    [eligibleRowIndexSet]
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
  // Only the algorithms this user can run retrieve candidates (ocl_issues#2872).
  const hasAlgorithms = runnableAlgos.length > 0
  const retrieveCandidates = retrieveCandidatesChecked && hasAlgorithms
  const runAI = Boolean(inAIAssistantGroup && autoRunAIAnalysis)
  const isAIOnly = runAI && !retrieveCandidates
  const aiRowsToAnalyse = isAIOnly ? (aiOnlyRowCounts?.analyse || 0) : 0

  // Selected algorithms that call $match.
  const matchAlgorithmIdSet = React.useMemo(() => new Set(matchAlgorithmIds || []), [matchAlgorithmIds])
  const matchAlgorithmCount = retrieveCandidates ? runnableAlgos.filter(algo => matchAlgorithmIdSet.has(algo.id)).length : 0
  const check = useAutoMatchCheck({
    open, autoMatchScope, rowsToMatchCount, totalRows, retrieveCandidates, matchAlgorithmCount,
    runAI, isAIOnly, aiRowsToAnalyse, inAIAssistantGroup
  })

  React.useEffect(() => {
    if (autoMatchScope === 'unmapped' && !hasUnmappedRows) {
      setAutoMatchScope('all')
    }
    if (autoMatchScope === 'allIncludingApproved' && !hasApprovedRows) {
      setAutoMatchScope('all')
    }
  }, [autoMatchScope, hasApprovedRows, hasUnmappedRows, setAutoMatchScope])

  // A notice that changes what the run does needs a tick before Submit. Any
  // change to the selection clears the ticks.
  const [confirmed, setConfirmed] = React.useState({})
  const confirmationKey = [open, autoMatchScope, retrieveCandidates, runAI, rowsToMatchCount, ...(check.notices || []).map(notice => notice.text)].join('|')
  React.useEffect(() => setConfirmed({}), [confirmationKey])

  const scopeOptions = [
    {
      value: 'selected',
      disabled: !hasSelectedRows,
      label: t('map_project.auto_match_scope_selected'),
      count: hasSelectedRows ? selectedRowCount : false,
      disabledTooltip: t('map_project.auto_match_selected_rows_note_no_count')
    },
    {value: 'unmapped', disabled: !hasUnmappedRows, label: t('map_project.auto_match_scope_unmapped'), count: unmappedRowsCount},
    {value: 'all', disabled: false, label: t('map_project.auto_match_scope_unmapped_proposed'), count: allRowsCount},
    {value: 'allIncludingApproved', disabled: !hasApprovedRows, label: t('map_project.auto_match_scope_all'), count: totalRows}
  ]

  const blocker = getAutoMatchBlocker({
    rowsInScope: rowsToMatchCount,
    hasAlgorithms,
    retrieveCandidates,
    runAI,
    aiRowsToAnalyse
  })
  const blockerMessages = {
    no_rows: t('map_project.auto_match_blocked_no_rows'),
    no_algorithms: t(inAIAssistantGroup ? 'map_project.auto_match_blocked_no_algorithms_ai_v2' : 'map_project.auto_match_blocked_no_algorithms'),
    no_step: t(inAIAssistantGroup ? 'map_project.auto_match_blocked_no_step_ai_v2' : 'map_project.auto_match_blocked_no_step'),
    no_ai_rows: t('map_project.auto_match_blocked_no_ai_rows'),
  }

  // What the selection will do, shown by Submit rather than next to each option.
  const notices = []
  if(blocker)
    notices.push({key: 'blocker', severity: 'warning', text: blockerMessages[blocker]})
  if(autoMatchScope === 'all' && readyForReviewRowsCount > 0)
    notices.push({key: 'replaces_proposed', severity: 'info', text: t('map_project.auto_match_notice_replaces_proposed', {count: readyForReviewRowsCount})})
  if(isAllIncludingApproved)
    notices.push({
      key: 'overwrites_approved',
      severity: 'warning',
      text: t('map_project.auto_match_notice_overwrites', {approved: reviewedRowsCount.toLocaleString(), proposed: readyForReviewRowsCount.toLocaleString()}),
      confirm: t('map_project.auto_match_all_including_approved_confirm', {approvedCount: reviewedRowsCount.toLocaleString()})
    })
  if(isAIOnly && rowsToMatchCount > 0 && aiOnlyRowCounts && aiRowsToAnalyse > 0)
    notices.push({
      key: 'ai_only_rows',
      severity: 'info',
      text: t('map_project.auto_match_ai_only_rows', {analyse: aiOnlyRowCounts.analyse.toLocaleString(), skip: aiOnlyRowCounts.skip.toLocaleString()})
    })

  notices.push(...(check.notices || []))

  const isDisabled =
    !repoVersion?.version_url ||
    Boolean(blocker) ||
    notices.some(notice => notice.blocks || (notice.confirm && !confirmed[notice.key]))

  return (
    <Dialog
      open={open}
      onClose={onClose}
      scroll='paper'
      disableEnforceFocus
      sx={{
        '& .MuiDialog-paper': {
          borderRadius: '28px',
          minWidth: '312px',
          minHeight: '262px',
          padding: 0,
          margin: {xs: '16px', sm: '32px'},
          maxHeight: {xs: 'calc(100% - 32px)', sm: 'calc(100% - 64px)'}
        }
      }}
    >
      <DialogTitle sx={{padding: '12px 24px', color: 'surface.dark', fontSize: '22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
        <span>{t('map_project.auto_match')}</span>
        <CloseIconButton onClick={onClose} />
      </DialogTitle>
      <DialogContent sx={{paddingBottom: '12px'}}>
        <div className='col-xs-12 padding-0' style={{display: 'flex', alignItems: 'center', fontSize: '1rem'}}>
          {t('map_project.auto_match_target_repository')}
          {
            repoVersion?.id &&
              <RepoChip repo={repoVersion} hideType sx={{marginLeft: '12px'}} />
          }
        </div>
        <FormControl sx={{marginTop: '12px', width: '100%'}}>
          <FormLabel id="automatch-rows" sx={{color: 'rgba(0, 0, 0, 0.87)', '&.Mui-focused': {color: 'rgba(0, 0, 0, 0.87)'}}}>
            <Trans
              i18nKey='map_project.auto_match_input_rows'
              values={{rows: rowsToMatchCount.toLocaleString(), total: totalRows.toLocaleString()}}
              components={{b: <b />}}
            />
          </FormLabel>
          <RadioGroup
            sx={{marginLeft: {xs: '12px', sm: '35px'}, marginTop: '2px'}}
            aria-labelledby="automatch-rows"
            name="automatch-rows"
            value={autoMatchScope}
            onChange={event => setAutoMatchScope(event.target.value)}
          >
            {
              scopeOptions.map(option => {
                const control = (
                  <FormControlLabel
                    key={option.value}
                    value={option.value}
                    disabled={option.disabled}
                    control={<Radio size='small' sx={{padding: '5px 8px'}} />}
                    label={<TagCountLabel label={option.label} count={option.count} normal />}
                    sx={{marginRight: 0}}
                  />
                )
                return option.disabled && option.disabledTooltip ?
                  <Tooltip key={option.value} title={option.disabledTooltip} placement='top-start'><span style={{width: 'fit-content'}}>{control}</span></Tooltip> :
                  control
              })
            }
          </RadioGroup>
        </FormControl>

        <FormControl sx={{marginTop: '8px', width: '100%'}}>
          <FormControlLabel
            sx={{marginRight: 0}}
            control={<Checkbox checked={retrieveCandidates} disabled={!hasAlgorithms} onChange={event => setRetrieveCandidates(event.target.checked)} />}
            label={t('map_project.auto_match_retrieve_candidates')}
          />
          {
            hasAlgorithms ?
              <>
                <FormHelperText sx={SUBTEXT_SX}>
                  {t('map_project.retrieve_candidates_helper_text')}
                </FormHelperText>
                <Box sx={{display: 'flex', flexWrap: 'wrap', gap: '4px', margin: '4px 0 0 32px'}}>
                  {
                    runnableAlgos.map(algo => (
                      <Chip variant='outlined' size='small' color='warning' label={algo.id} key={algo.id} />
                    ))
                  }
                </Box>
              </> :
              <Alert
                severity='warning'
                sx={{margin: '4px 0 0 32px'}}
                action={
                  onConfigure &&
                    <Button variant='contained' color='primary' size='small' sx={{textTransform: 'none', whiteSpace: 'nowrap'}} onClick={onConfigure}>
                      {t('map_project.auto_match_configure_algorithms')}
                    </Button>
                }
              >
                {t(algosSelected.length ? 'map_project.auto_match_no_runnable_algorithms' : 'map_project.auto_match_no_algorithms')}
              </Alert>
          }
        </FormControl>

        {
          inAIAssistantGroup &&
            <FormControl sx={{marginTop: '8px', width: '100%'}}>
              <FormControlLabel
                sx={{marginRight: 0}}
                control={
                  <Checkbox
                    checked={autoRunAIAnalysis}
                    onChange={event => setAutoRunAIAnalysis(event.target.checked)}
                  />
                }
                label={t('map_project.auto_match_ai_label')}
              />
              <FormHelperText sx={SUBTEXT_SX}>
                {t('map_project.auto_match_ai_description')}
              </FormHelperText>
              {
                autoRunAIAnalysis && canSelectAIModel &&
                  <AIAssistantSelectorPanel
                    promptTemplates={promptTemplates}
                    promptTemplate={promptTemplate}
                    onPromptTemplateChange={setPromptTemplate}
                    models={AIModels}
                    selectedModel={AIModel}
                    onModelChange={setAIModel}
                    sx={{marginTop: '12px', marginLeft: '32px'}}
                  />
              }
            </FormControl>
        }
      </DialogContent>
      <Box sx={{borderTop: '1px solid', borderColor: 'divider', padding: '12px 16px 16px 24px'}}>
        {
          notices.length > 0 &&
            <Box sx={{display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px'}}>
              {
                notices.map(notice => (
                  <Alert
                    key={notice.key}
                    severity={notice.severity}
                    sx={{padding: '0 12px', fontSize: '13px', '& .MuiAlert-icon': {padding: '6px 0', marginRight: '8px', fontSize: '20px'}, '& .MuiAlert-message': {padding: '7px 0'}}}
                  >
                    {notice.text}
                    {
                      notice.confirm &&
                        <FormControlLabel
                          sx={{display: 'flex', alignItems: 'flex-start', margin: '2px 0 0 -6px', '& .MuiCheckbox-root': {marginTop: '-1px'}}}
                          control={
                            <Checkbox
                              size='small'
                              sx={{padding: '3px'}}
                              checked={Boolean(confirmed[notice.key])}
                              onChange={event => setConfirmed(prev => ({...prev, [notice.key]: event.target.checked}))}
                            />
                          }
                          label={<span style={{fontSize: '13px', fontWeight: 500}}>{notice.confirm}</span>}
                        />
                    }
                  </Alert>
                ))
              }
            </Box>
        }
        <Box sx={{display: 'flex', alignItems: 'flex-end', flexWrap: 'wrap', gap: '12px'}}>
          {check.summary && <Box sx={{flex: '1 1 300px', minWidth: 0}}>{check.summary}</Box>}
          <Button
            variant='contained'
            size='small'
            sx={{textTransform: 'none', marginLeft: 'auto'}}
            endIcon={<DoubleArrowIcon />}
            disabled={isDisabled}
            onClick={event => onSubmit(event, retrieveCandidates ? map(runnableAlgos, val => val?.id) : [])}
          >
            {t('common.submit')}
          </Button>
        </Box>
      </Box>
    </Dialog>
  )
}

export default AutoMatchDialog
