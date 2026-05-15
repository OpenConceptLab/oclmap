import React from 'react'
import { useTranslation } from 'react-i18next';
import Typography from '@mui/material/Typography'
import Autocomplete from '@mui/material/Autocomplete'
import TextField from '@mui/material/TextField'
import FormHelperText from '@mui/material/FormHelperText'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import CircularProgress from '@mui/material/CircularProgress';

import { styled } from '@mui/material/styles';

import JoinRightIcon from '@mui/icons-material/JoinRight';
import UploadIcon from '@mui/icons-material/Upload';
import SettingsIcon from '@mui/icons-material/Settings';
import SaveIcon from '@mui/icons-material/Save';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';

import Stack from '@mui/material/Stack'
import Alert from '@mui/material/Alert'
import Tooltip from '@mui/material/Tooltip'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'

import isEmpty from 'lodash/isEmpty'
import omit from 'lodash/omit'
import filter from 'lodash/filter'

import { toV3URL } from '../../common/utils'
import { getProjectConfigErrors } from './algorithms'
import NamespaceDropdown from '../common/NamespaceDropdown'
import RepoSearchAutocomplete from '../repos/RepoSearchAutocomplete'
import RepoVersionSearchAutocomplete from '../repos/RepoVersionSearchAutocomplete'
import CloseIconButton from '../common/CloseIconButton';
import ColumnMapTable from './ColumnMapTable'
import ScoreConfiguration from './ScoreConfiguration'
import { SCORES_COLOR } from './constants'
import FilterTable from './FilterTable'
import MultiAlgoSelector from './MultiAlgoSelector'
import LookupConfig from './LookupConfig'
import AdvancedSettings from './AdvancedSettings'
import RerankerConfig from './RerankerConfig'
import AIAssistantSelectorPanel from './AIAssistantSelectorPanel'

const VisuallyHiddenInput = styled('input')({
  clip: 'rect(0 0 0 0)',
  clipPath: 'inset(50%)',
  height: 1,
  overflow: 'hidden',
  position: 'absolute',
  bottom: 0,
  left: 0,
  whiteSpace: 'nowrap',
  width: 1,
});


const deriveCanonicalUrl = relativeUrl => relativeUrl ? `https://ns.openconceptlab.org${relativeUrl}` : ''

const ConfigurationForm = ({ project, handleFileUpload, file, owner, setOwner, name, setName, description, setDescription, repo, onRepoChange, repoVersion, setRepoVersion, versions, mappedSources, targetSourcesFromRows, algosSelected, setAlgosSelected, sx, algos, validColumns, columns, isValidColumnValue, updateColumn, configure, setConfigure, columnVisibilityModel, setColumnVisibilityModel, onSave, isSaving, candidatesScore, onScoreChange, includeDefaultFilter, setIncludeDefaultFilter, filters, setFilters, locales, isLoadingLocales, setAIAssistantColumns, AIAssistantColumns, inAIAssistantGroup, lookupConfig, setLookupConfig, encoderModel, setEncoderModel, isCoreUser, canBridge, canScispacy, promptTemplates, promptTemplate, onPromptTemplateChange, AIModels, AIModel, setAIModel, namespace, setNamespace, promptOutputLocale, setPromptOutputLocale, inputLocale, setInputLocale, oclLocales, useLexicalVariants, setUseLexicalVariants }) => {
  const { t } = useTranslation();
  const isLLMAlgoNotAllowed = !repoVersion?.match_algorithms?.includes('llm')
  const appliedLocales = filters?.locale ? filters?.locale?.split(',') : []
  // PR3-H: effective set of name locales the AI Assistant will receive.
  // Union of (input_locale, filters.locale) deduped on primary subtag.
  // Empty = no filter (backwards-compatible for old projects with neither set).
  const primarySubtag = (loc) => (loc || '').split('-')[0].toLowerCase()
  const effectiveAILocales = (() => {
    const seen = new Set()
    const out = []
    for (const l of [inputLocale, ...appliedLocales].filter(Boolean)) {
      const tag = primarySubtag(l)
      if (!tag || seen.has(tag)) continue
      seen.add(tag)
      out.push(tag)
    }
    return out
  })()
  // PR3-H: Input Language + Output Locale dropdowns both pull from
  // /orgs/OCL/sources/Locales/ (loaded once in MapProject.jsx). Each entry
  // is {id: '<bcp47 subtag>', name: '<English display name>'}.
  const localeOptions = oclLocales || []
  const selectedInputLocaleOption = localeOptions.find(o => o.id === inputLocale) || null
  const inputLocaleOptionLabel = option => {
    if (typeof option === 'string') return option
    if (!option?.id) return ''
    return `[${option.id}] ${option.name}`
  }
  const targetCanonicalFromRepo = repo?.canonical_url
  const targetCanonicalDerived = !targetCanonicalFromRepo && repo?.url ? deriveCanonicalUrl(repo.url) : ''
  const effectiveTargetCanonical = targetCanonicalFromRepo || targetCanonicalDerived
  const bridgeAlgos = filter(algosSelected || [], a => a?.type && a.type.includes('bridge'))
  const defaultNamespace = owner || ''
  const namespaceValue = namespace || ''

  // Project-config validation. Currently flags custom algos with missing /
  // malformed canonical_url. Returned as a structured list so the banner
  // can name the specific algorithms.
  const configErrors = getProjectConfigErrors(algosSelected)
  const hasConfigErrors = configErrors.length > 0
  const getAlgos = () => {
    return algos.map(algo => {
      if(algo.type === 'ocl-semantic')
        algo.disabled = Boolean(isLLMAlgoNotAllowed)
      else if(['ocl-bridge', 'ocl-ciel-bridge'].includes(algo.type))
        algo.disabled = !canBridge
      else if(algo.type === 'ocl-scispacy')
        algo.disabled = !canScispacy
      return algo
    })
  }

  return (
    <div className='col-xs-12' style={{padding: '8px 0', ...sx}}>
      <div className='col-xs-12 padding-0' style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px'}}>
        <Typography component='span' sx={{fontSize: '22px', color: 'surface.dark', fontWeight: 600, display: 'flex', alignItems: 'center'}}>
          {t('map_project.configure_mapping_project')}
          <IconButton sx={{marginLeft: '8px'}} color={configure ? 'primary' : 'secondary'} onClick={() => file?.name ? setConfigure(!configure) : null}>
            <SettingsIcon fontSize='inherit' />
          </IconButton>
        </Typography>
        {
          file?.name &&
            <CloseIconButton color='secondary' onClick={() => setConfigure(false)} />
        }
        </div>
      <Typography component="div" sx={{fontSize: '16px', fontWeight: 'bold', marginTop: '45px'}}>
        {t('map_project.project_ownership_and_name')}
      </Typography>
      <NamespaceDropdown
        required
        id='owner'
        owner={owner}
        label={t('map_project.project_owner')}
        size='small'
        onChange={(event, item) => setOwner(item?.url || '')}
        asOwner
        sx={{marginTop: '12px'}}
      />
      <TextField
        required
        fullWidth
        sx={{marginTop: '12px'}}
        label={t('common.name')}
        value={name}
        onChange={event => setName(event.target.value || '')}
      />
      <TextField
        fullWidth
        sx={{marginTop: '12px'}}
        label={t('common.description')}
        value={description}
        onChange={event => setDescription(event.target.value || '')}
        multiline
        maxRows={3}
      />

      <Typography component="div" sx={{fontSize: '16px', fontWeight: 'bold', marginTop: '20px'}}>
        {t('map_project.input_data')}
      </Typography>
      <FormHelperText sx={{marginTop: 0}}>
        {t('map_project.upload_file_description')}
      </FormHelperText>

      <Button
        component="label"
        role={undefined}
        variant="outlined"
        tabIndex={-1}
        sx={{textTransform: 'none', marginTop: '12px', width: '100%'}}
        startIcon={<JoinRightIcon />}
        endIcon={<UploadIcon />}
        disabled={Boolean(project?.id && project.input_file_name)}
      >
        {
          file?.name ? file.name : t('map_project.upload_file')
        }
        <VisuallyHiddenInput
          type="file"
          accept=".xlsx, .xls, .csv"
          onChange={handleFileUpload}
        />
      </Button>

      <Autocomplete
        size='small'
        id='input-locale'
        options={localeOptions}
        value={selectedInputLocaleOption}
        getOptionLabel={inputLocaleOptionLabel}
        isOptionEqualToValue={(option, current) => option?.id === current?.id}
        onChange={(event, option) => setInputLocale(option?.id || '')}
        sx={{marginTop: '12px'}}
        renderOption={(props, option) => (
          <li {...props} key={option.id}>
            <span style={{display: 'flex', alignItems: 'center'}}>
              <span style={{marginRight: '6px', fontSize: '14px', color: 'rgba(0, 0, 0, 0.6)'}}>[{option.id}]</span>
              <span>{option.name}</span>
            </span>
          </li>
        )}
        renderInput={(params) => (
          <TextField
            {...params}
            size='small'
            label={t('map_project.input_language', 'Input Language')}
            helperText={t('map_project.input_language_helper', 'Language of the input data. Determines which target-repo name locales are sent to the AI Assistant.')}
          />
        )}
      />

      <Typography component="div" sx={{fontSize: '16px', fontWeight: 'bold', marginTop: '20px'}}>
        {t('map_project.target_repository')}
        {
          (repo?.version_url || repo?.url) &&
            <IconButton size='small' sx={{marginLeft: '8px'}} href={toV3URL(repo.version_url || repo.url)} target='_blank' rel='noopener noreferrer' color='primary'>
              <OpenInNewIcon fontSize='inherit' />
            </IconButton>
        }
      </Typography>
      <FormHelperText sx={{marginTop: 0}}>
        {t('map_project.target_repository_description')}
      </FormHelperText>

      <RepoSearchAutocomplete label={t('map_project.repository')} size='small' onChange={(id, item) => onRepoChange(item)} value={repo}  sx={{marginTop: '12px'}}/>
      <RepoVersionSearchAutocomplete versions={versions} label={t('common.version')} size='small' onChange={(id, item) => setRepoVersion(item)} value={repoVersion} sx={{marginTop: '12px'}} />
      {
        effectiveTargetCanonical &&
          <Stack direction='row' spacing={0.75} alignItems='center' sx={{marginTop: '6px', marginLeft: '8px', minWidth: 0}}>
            <InfoOutlinedIcon sx={{fontSize: '14px', color: 'text.secondary', flexShrink: 0}} />
            <Typography component='span' sx={{fontSize: '12px', color: 'text.secondary', flexShrink: 0}}>
              {t('map_project.target_canonical_url', 'Canonical:')}
            </Typography>
            <Tooltip title={effectiveTargetCanonical} placement='top'>
              <Typography
                component='code'
                sx={{
                  fontSize: '12px',
                  fontFamily: 'monospace',
                  color: 'text.primary',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  minWidth: 0
                }}
              >
                {effectiveTargetCanonical}
              </Typography>
            </Tooltip>
            {
              !targetCanonicalFromRepo &&
                <Typography component='span' sx={{fontSize: '11px', color: 'text.secondary', fontStyle: 'italic', flexShrink: 0}}>
                  · {t('map_project.canonical_auto_derived_short', 'derived')}
                </Typography>
            }
          </Stack>
      }
      {
        bridgeAlgos.length > 0 &&
          <Stack spacing={0.25} sx={{marginTop: '4px', marginLeft: '8px', minWidth: 0}}>
            {
              bridgeAlgos.map(b => {
                const bridgeCanonical = b?.bridge_repo?.canonical_url || deriveCanonicalUrl(b?.target_repo_url)
                const isDerived = !b?.bridge_repo?.canonical_url
                const tooltipText = `${b.target_repo_url || ''} → ${bridgeCanonical || ''}`
                return (
                  <Stack key={b.__key || b.id} direction='row' spacing={0.75} alignItems='center' sx={{minWidth: 0}}>
                    <InfoOutlinedIcon sx={{fontSize: '14px', color: 'text.secondary', flexShrink: 0}} />
                    <Typography component='span' sx={{fontSize: '12px', color: 'text.secondary', flexShrink: 0}}>
                      {t('map_project.bridge_canonical_short', 'Bridge:')}
                    </Typography>
                    <Tooltip title={tooltipText} placement='top'>
                      <Typography
                        component='code'
                        sx={{
                          fontSize: '12px',
                          fontFamily: 'monospace',
                          color: 'text.primary',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          minWidth: 0
                        }}
                      >
                        {b.target_repo_url || '—'} → {bridgeCanonical}
                      </Typography>
                    </Tooltip>
                    {
                      isDerived &&
                        <Typography component='span' sx={{fontSize: '11px', color: 'text.secondary', fontStyle: 'italic', flexShrink: 0}}>
                          · {t('map_project.canonical_auto_derived_short', 'derived')}
                        </Typography>
                    }
                  </Stack>
                )
              })
            }
          </Stack>
      }
      {
        isLLMAlgoNotAllowed && repoVersion?.version_url &&
          <FormHelperText sx={{marginTop: '4px', marginLeft: '8px', color: 'warning.main'}}>
            {t('map_project.semantic_search_not_configured', {owner: repo?.owner, repo: repo?.short_code || repo?.id, version: repoVersion?.id || repo?.version || repo?.id})}
          </FormHelperText>
      }
          <Autocomplete
            multiple
            size='small'
            id="locale"
            disabled={isLoadingLocales}
            options={locales}
            getOptionLabel={(option) => option}
            value={appliedLocales}
            onChange={(event, values) => {
              setFilters(values?.length ? {...filters, locale: values.join(',')} : omit(filters, ['locale']))
            }}
            sx={{marginTop: '12px'}}
            renderInput={(params) => (
              <TextField
                {...params}
                size='small'
                label={
                  isLoadingLocales ?
                    <span style={{display: 'flex'}}>
                      {t('map_project.loading_name_locales')}
                      <CircularProgress sx={{marginLeft: '16px', width: '20px !important', height: '20px !important'}} />
                    </span> :
                    t('map_project.filter_name_locales')
                }
                helperText={t('map_project.filter_name_locales_helper')}
              />
            )}
          />
      {
        !isEmpty(repoVersion?.meta?.display?.default_filter) && repoVersion?.meta?.display?.default_filter &&
          <>
          <FormHelperText sx={{marginLeft: '8px'}}>
            <FormControlLabel
              size='small'
              control={
                <Checkbox
                  size='small'
                  checked={includeDefaultFilter}
                  sx={{padding: '8px 4px'}}
                  onChange={() => {
                    const newValue = !includeDefaultFilter
                    setIncludeDefaultFilter(newValue);
                    setFilters(newValue ? {...filters, ...repoVersion.meta.display.default_filter} : omit(filters, Object.keys(repoVersion.meta.display.default_filter)))
                  }}
                />
              }
              label={t('map_project.default_filter')}
            />
          </FormHelperText>
            <FilterTable filters={repoVersion.meta.display.default_filter} order={repoVersion.meta.display.concept_filter_order || []} sx={{marginLeft: '4px'}} />
        </>
      }

      <LookupConfig value={lookupConfig} onChange={setLookupConfig}/>
      {
        setNamespace &&
          <AdvancedSettings namespaceValue={namespaceValue} setNamespace={setNamespace} defaultNamespace={defaultNamespace} isCoreUser={isCoreUser} useLexicalVariants={useLexicalVariants} setUseLexicalVariants={setUseLexicalVariants} />
      }
      {
        inAIAssistantGroup && isCoreUser && promptTemplates?.length > 0 &&
          <>
            <Typography component="div" sx={{fontSize: '16px', fontWeight: 'bold', marginTop: '20px'}}>
              {t('map_project.ai_assistant')}
            </Typography>
            <FormHelperText sx={{marginTop: 0}}>
              {t('map_project.ai_prompt_template_description')}
            </FormHelperText>
            <AIAssistantSelectorPanel
              promptTemplates={promptTemplates}
              promptTemplate={promptTemplate}
              onPromptTemplateChange={onPromptTemplateChange}
              models={AIModels}
              selectedModel={AIModel}
              onModelChange={setAIModel}
              sx={{marginTop: '12px'}}
              showLocale
              promptOutputLocale={promptOutputLocale}
              setPromptOutputLocale={setPromptOutputLocale}
              availableLocales={localeOptions}
            />
            <FormHelperText sx={{marginTop: '8px', marginLeft: '8px'}}>
              {effectiveAILocales.length > 0
                ? t('map_project.ai_effective_locales', {locales: effectiveAILocales.join(', '), defaultValue: 'AI will receive names in: {{locales}}'})
                : t('map_project.ai_all_locales', 'AI will receive names in: all locales (no filter)')}
            </FormHelperText>
          </>
      }

      <Typography component="div" sx={{fontSize: '16px', fontWeight: 'bold', marginTop: '20px'}}>
        {t('map_project.matching_algorithm')}
      </Typography>
      <FormHelperText sx={{marginTop: 0}}>
        {t('map_project.matching_algorithm_description')}
      </FormHelperText>
      <MultiAlgoSelector
        algos={getAlgos()}
        value={algosSelected}
        onChange={setAlgosSelected}
        repo={repoVersion}
        isCoreUser={isCoreUser}
      />
      {
        isCoreUser &&
          <RerankerConfig value={encoderModel} onChange={setEncoderModel} />
      }
      <>
        <Typography component="div" sx={{fontSize: '16px', fontWeight: 'bold', marginTop: '20px'}}>
          {t('map_project.score_configuration')}
        </Typography>
        <FormHelperText sx={{marginTop: 0}}>
          {t('map_project.score_configuration_description')}
        </FormHelperText>
        <ScoreConfiguration scores={candidatesScore} onChange={onScoreChange} />
        <div className='col-xs-12' style={{fontSize: '12px', margin: '-4px 0 16px 0'}}>
          <div className='col-xs-4' style={{padding: '6px 16px', backgroundColor: SCORES_COLOR.low_ranked}}>
            {`${t('map_project.not_recommended')} (<${candidatesScore.available}%)`}
          </div>
          <div className='col-xs-4' style={{padding: '6px 16px', backgroundColor: SCORES_COLOR.available}}>
            {`${t('map_project.available')} (≥${candidatesScore.available}%, <${candidatesScore.recommended}%)`}
          </div>
          <div className='col-xs-4' style={{padding: '6px 16px', backgroundColor: SCORES_COLOR.recommended}}>
            {t('map_project.recommended')} (≥{candidatesScore.recommended}%)
          </div>
        </div>
      </>
      {
        file?.name &&
          <>
            <Typography component="div" sx={{fontSize: '16px', fontWeight: 'bold', marginTop: '20px'}}>
              {t('map_project.field_configuration')}
            </Typography>
            <FormHelperText sx={{marginTop: 0}}>
              {t('map_project.field_configuration_description')}
            </FormHelperText>
            <ColumnMapTable
              sx={{marginTop: '12px'}}
              validColumns={validColumns}
              columns={columns}
              isValid={isValidColumnValue}
              onUpdate={updateColumn}
              columnVisibilityModel={columnVisibilityModel}
              setColumnVisibilityModel={setColumnVisibilityModel}
              mappedSources={mappedSources}
              targetSourcesFromRows={targetSourcesFromRows}
              setAIAssistantColumns={setAIAssistantColumns}
              AIAssistantColumns={AIAssistantColumns}
              inAIAssistantGroup={inAIAssistantGroup}
            />
          </>
      }
      {
        hasConfigErrors &&
          <Alert severity='error' sx={{marginTop: '16px'}}>
            <Typography component='div' sx={{fontSize: '13px', fontWeight: 500, marginBottom: '4px'}}>
              {t('map_project.config_errors_title', 'Project configuration is incomplete')}
            </Typography>
            <ul style={{margin: 0, paddingLeft: '20px', fontSize: '12px'}}>
              {
                configErrors.map(({algo, reason}) => (
                  <li key={algo.__key || algo.id}>
                    {reason === 'missing_canonical_url'
                      ? t('map_project.config_error_missing_canonical', {
                          name: algo.name || algo.id,
                          defaultValue: `Custom algorithm "${algo.name || algo.id}" is missing a valid canonical URL.`
                        })
                      : reason
                    }
                  </li>
                ))
              }
            </ul>
          </Alert>
      }
      <div className='col-xs-12 padding-0' style={{textAlign: 'right'}}>
      <Button
        variant='contained'
        color='primary'
        size='small'
        sx={{textTransform: 'none', margin: '20px 5px 5px 0px'}}
        startIcon={<SaveIcon />}
        onClick={onSave}
        disabled={!name || !file?.name || !owner || hasConfigErrors}
        loading={isSaving}
        loadingPosition="start"
      >
        {
          isSaving ? t('map_project.saving') : t('map_project.save_and_close')
        }
      </Button>
        </div>
    </div>
  )
}

export default ConfigurationForm;
