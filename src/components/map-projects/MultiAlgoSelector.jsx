import React, { useMemo, useState } from "react";
import { useTranslation } from 'react-i18next'
import {
  Box,
  Typography,
  Paper,
  Stack,
  IconButton,
  FormControl,
  Select,
  Divider,
  Collapse,
  TextField,
  Button,
  Tooltip,
  InputAdornment,
  ListItemText,
  ListItemIcon,
  ListItemButton,
  Chip
} from "@mui/material";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import TuneRoundedIcon from "@mui/icons-material/TuneRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import MatchingIcon from '@mui/icons-material/DeviceHub';
import countBy from 'lodash/countBy'
import omit from 'lodash/omit'
import filter from 'lodash/filter'
import find from 'lodash/find'
import isString from 'lodash/isString'
import orderBy from 'lodash/orderBy'


import ConceptIcon from '../concepts/ConceptIcon'
import { OperationsContext } from '../app/LayoutContext'
import { isLikelyCanonicalUrl } from './algorithms'
import RepoVersionSearchAutocomplete from '../repos/RepoVersionSearchAutocomplete'
import APIService from '../../services/APIService';
import { dropVersion } from '../../common/utils'
import {
  getDefaultBridgeRepoVersion,
  getLatestReleasedBridgeVersion,
  isLLMBridgeRepoVersion
} from './projectTargetRepo'

// Cached lookup of a bridge source repo's canonical_url. Canonical URLs are
// stable, so a single fetch per relative URL is sufficient for the session.
const bridgeCanonicalCache = new Map()
const bridgeVersionsCache = new Map()

const fetchBridgeCanonical = (url) => {
  if(!url) return Promise.resolve(null)
  if(bridgeCanonicalCache.has(url)) return bridgeCanonicalCache.get(url)
  const promise = APIService.new().overrideURL(url).get()
    .then(r => r?.data?.canonical_url || null)
    .catch(() => null)
  bridgeCanonicalCache.set(url, promise)
  return promise
}

const fetchBridgeVersions = (url) => {
  const baseUrl = dropVersion(url) || url
  if(!baseUrl) return Promise.resolve([])
  if(bridgeVersionsCache.has(baseUrl)) return bridgeVersionsCache.get(baseUrl)
  const promise = APIService.new().overrideURL(baseUrl).appendToUrl('versions/').get()
    .then(r => r?.data || [])
    .catch(() => [])
  bridgeVersionsCache.set(baseUrl, promise)
  return promise
}

/**
 * MultiAlgoSelector (MUI5)
 *
 * Props:
 * - algos: Array<{
 *     id: string,
 *     name: React.ReactNode,      // can be <Trans .../>
 *     type: string,               // e.g. "ocl-scispacy", "ocl-ciel-bridge"
 *     provider?: string,
 *     order?: number,
 *     disabled?: boolean,         // disable picking this algo
 *     batch_size?: number,
 *     concurrent_requests?: number,
 *   }>
 *
 * - value: Array<{
 *     id: string,
 *     // per-selected config overrides:
 *     batch_size?: number,
 *     concurrent_requests?: number,
 *     // custom-match example:
 *     url?: string,
 *     token?: string,
 *   }>
 *
 * - onChange: (nextValue) => void
 *
 * Optional:
 * - title?: string
 * - subtitle?: string
 * - allowDuplicateTypes?: boolean (default false)
 * - getAlgoIcon?: (algo) => ReactNode
 */
export default function MultiAlgoSelector({
  algos,
  value,
  onChange,
  maxAlgos=5,
  repo,
  isCoreUser
}) {
  const { t } = useTranslation()
  const { setAlert } = React.useContext(OperationsContext)
  const [expanded, setExpanded] = useState(() => new Map());
  const [errors, setErrors] = React.useState({})
  const [customAlgoMeta, setCustomAlgoMeta] = React.useState({})
  const [bridgeVersionsByUrl, setBridgeVersionsByUrl] = React.useState({})
  const [bridgeVersionsLoadedByUrl, setBridgeVersionsLoadedByUrl] = React.useState({})

  const normalizedValue = useMemo(() => {
    let changed = false;
    const next = value.map(v => {
      if (v.__key) return v;
      changed = true;
      return { ...v, __key: Math.random(100).toString() };
    });
    if (changed) onChange(next);
    return next;
  }, [value]);

  const algosById = useMemo(() => {
    const m = new Map();
    (algos || []).forEach((a) => m.set(a.id, a));
    return m;
  }, [algos]);

  const selectedIds = useMemo(() => new Set((value || []).map((v) => v.id)), [value]);

  const selectedTypes = useMemo(() => {
    const set = new Set();
    (value || []).forEach((v) => {
      const a = algosById.get(v.id);
      if (a?.type) set.add(a.type);
    });
    return set;
  }, [value, algosById]);
  const addableOptions = useMemo(() => {
    //let sorted = [...(algos || [])].sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999));
    let _algos = algos.map(a => {
      if(a.type === 'ocl-semantic' && (find(value, {type: 'ocl-search'}) || !repo?.match_algorithms?.includes('llm')))
        a.disabled = true
      if(a.type === 'ocl-search' && find(value, {type: 'ocl-semantic'}))
        a.disabled = true
      return a
    })

    let sorted = _algos.filter((a) => {
      if (!a.allow_multiple && a.type && selectedTypes.has(a.type))
        return false;
      return true;
    });
    const isEnabled = (a) => !a.disabled;
    const isDisabled = (a) => !!a.disabled;
    const isOcl = (a) => a.provider === 'ocl';
    const notOcl = (a) => a.provider !== 'ocl';

    return [
      ...orderBy(sorted.filter((a) => isOcl(a) && isEnabled(a)), 'name'),
      ...orderBy(sorted.filter((a) => notOcl(a) && isEnabled(a)), 'name'),
      ...orderBy(sorted.filter((a) => isOcl(a) && isDisabled(a)), 'name'),
      ...orderBy(sorted.filter((a) => notOcl(a) && isDisabled(a)), 'name'),
    ];
  }, [algos, selectedIds, selectedTypes]);

  const canAddMore = addableOptions.length > 0 && value.length < maxAlgos;

  const updateSelected = (key, patch) => {
    const next = normalizedValue.map(v => (v.__key === key ? { ...v, ...patch } : v));
    onChange(next);
    if((patch.id || patch.name)) {
      if(filter(value, patch).length > 0)
        setErrors(prev => ({...prev, [key]: {...prev[key], ...patch}}))
      else if (patch.id)
        setErrors(prev => ({...prev, [key]: {...omit(prev[key], 'id')}}))
      else if (patch.name)
        setErrors(prev => ({...prev, [key]: {...omit(prev[key], 'name')}}))
    }
  };

  // For each selected bridge algo, fetch the source repo's canonical_url from
  // the OCL API and populate `bridge_repo.canonical_url`. Without this, the
  // downstream derivation falls back to https://ns.openconceptlab.org{relurl}
  // even when the repo has a real canonical (e.g. CIEL -> CIELterminology.org).
  // User-typed values are preserved: the sync only runs once per (key, url),
  // so editing the canonical field afterwards is sticky until the source URL
  // changes.
  const syncedBridgeUrlRef = React.useRef(new Map())
  React.useEffect(() => {
    for (const sel of value || []) {
      if(!sel?.type?.includes('bridge')) continue
      const url = sel.target_repo_url
      if(!url) continue
      if(syncedBridgeUrlRef.current.get(sel.__key) === url) continue
      syncedBridgeUrlRef.current.set(sel.__key, url)
      fetchBridgeCanonical(url).then(canonical => {
        if(!canonical) return
        updateSelected(sel.__key, {
          bridge_repo: { canonical_url: canonical, canonical_url_source: 'repo' }
        })
      })
    }
  }, [value])

  React.useEffect(() => {
    for (const sel of value || []) {
      if(!sel?.type?.includes('bridge')) continue
      const url = sel.target_repo_url
      const baseUrl = dropVersion(url) || url
      if(!baseUrl) continue
      const loadedVersions = bridgeVersionsByUrl[baseUrl]
      if(Array.isArray(loadedVersions)) {
        const selectedVersion = loadedVersions.find(version => version?.id === sel?.target_repo_version)
        if(!selectedVersion) {
          const defaultVersion = getDefaultBridgeRepoVersion(loadedVersions)
          if(defaultVersion?.id && defaultVersion.id !== sel?.target_repo_version) {
            const previousVersion = sel?.target_repo_version
            updateSelected(sel.__key, { target_repo_version: defaultVersion.id })
            if(previousVersion && setAlert) {
              setAlert({
                message: t('map_project.bridge_version_reset', {
                  version: defaultVersion.id,
                  previous: previousVersion
                }),
                severity: 'warning'
              })
            }
          }
        }
        continue
      }
      fetchBridgeVersions(baseUrl).then(versions => {
        setBridgeVersionsByUrl(prev => ({...prev, [baseUrl]: versions}))
        setBridgeVersionsLoadedByUrl(prev => ({...prev, [baseUrl]: true}))
      })
    }
  }, [value, bridgeVersionsByUrl])

  const removeSelected = (key) => {
    const next = (value || []).filter((v) => v.__key !== key);
    onChange(next);
    setCustomAlgoMeta(prev => omit(prev, [key]));

    setExpanded((prev) => {
      const n = new Map(prev);
      n.delete(key);
      return n;
    });
  };

  const toggleExpanded = (key) => {
    setExpanded((prev) => {
      const n = new Map(prev);
      n.set(key, !(n.get(key) ?? false));
      return n;
    });
  };

  const addAlgo = (algoId) => {
    if (!algoId) return;
    const algo = algosById.get(algoId);
    if (!algo) return;

    const counts = countBy(value, 'type')[algo.type]
    let id = algo.id
    let name = algo.name
    if(!isString(name)) {
      if(name?.props?.i18nKey) {
        name = t(algo.name?.props?.i18nKey).replace('<0>Premium</0>', '')
      } else
        name = algo.id
    }
    if(counts > 0) {
      id = `${id}-1`
      name = `${name}-1`
    }
    const defaults = {
      ...omit(algo, ['getIcon', 'disabled', 'description', 'url']),
      id: id,
      name: name,
      batch_size: algo.batch_size ?? 10,
      concurrent_requests: algo.concurrent_requests ?? 1,
      __key: Math.random(100).toString()
    };

    onChange([...(value || []), defaults]);
    setExpanded((prev) => {
      const n = new Map(prev);
      n.set(defaults.__key, algo.type === 'custom' || algo.type?.includes('bridge'));
      return n;
    });
  };

  const renderAlgoIcon = (algo) => {
    if (algo?.getIcon) return algo.getIcon({sx: ({fontSize: '1.5rem', color: 'primary.main'})});
    if(algo.type === 'ocl-search' && algo.provider === 'ocl')
      return <MatchingIcon sx={{fontSize: '1.5rem', color: 'primary.main'}} />
    if(algo.type === 'ocl-semantic' && algo.provider === 'ocl')
      return <MatchingIcon sx={{fontSize: '1.5rem', color: 'primary.main'}} />
    if(algo.type?.includes('bridge') && algo.provider === 'ocl')
      return <i className="fa-solid fa-bridge" style={{fontSize: '1.5rem', color: 'primary.main'}} />
    if(algo.type === 'ocl-scispacy' && algo.provider === 'ocl')
      return <img src="https://allenai.github.io/scispacy/scispacy-logo-square.png" style={{objectFit: 'cover', width: '28px', height: '28px'}} />
    if(algo.type === 'custom')
      return <i className="fa-brands fa-connectdevelop" style={{fontSize: '1.5rem', color: 'secondary.main'}} />
    return <TuneRoundedIcon sx={{fontSize: '1.5rem', color: 'warning.main'}} />

  };

  const setCustomAlgoState = (key, patch) => {
    setCustomAlgoMeta(prev => ({...prev, [key]: {...prev[key], ...patch}}));
  };

  const verifyCustomAlgorithm = async (key, tokenOverride) => {
    const selected = normalizedValue.find(v => v.__key === key);
    if(!selected?.url)
      return;

    const token = tokenOverride ?? selected?.token;
    setCustomAlgoState(key, {isLoading: true, requestError: '', requestSuccess: '', tokenRequired: false});

    const service = APIService.new();
    service.URL = selected.url;

    const response = await service.get(token || false, {}, undefined, true);
    const status = response?.response?.status || response?.status;

    if([401, 403].includes(status)) {
      setCustomAlgoState(key, {
        isLoading: false,
        tokenRequired: true,
        requestError: '',
        requestSuccess: '',
      });
      return;
    }

    if(response?.response || response?.detail || response?.message === 'Network Error' || typeof response === 'string') {
      setCustomAlgoState(key, {
        isLoading: false,
        tokenRequired: false,
        requestError: response?.response?.data?.detail || response?.detail || response?.message || response || t('unknown_error'),
        requestSuccess: '',
      });
      return;
    }

    const data = response?.data || response;
    if(!data?.name || !(data?.ID || data?.id)) {
      setCustomAlgoState(key, {
        isLoading: false,
        tokenRequired: false,
        requestError: t('unknown_error'),
        requestSuccess: '',
      });
      return;
    }

    updateSelected(key, {
      id: data.ID || data.id || '',
      name: data.name || '',
      description: data.description || '',
    });
    setCustomAlgoState(key, {
      isLoading: false,
      tokenRequired: false,
      requestError: '',
      requestSuccess: t('common.saved'),
    });
  };
  return (
    <Box sx={{ width: "100%" }}>
      <Stack spacing={1.5}>
        {(value || []).map((sel, i) => {
          const algo = find(algos, {type: sel.type});
          if (!algo) return null;

          const isOpen = expanded.get(sel.__key) ?? false;
          const hasErrors = errors[sel.__key]?.id || errors[sel.__key]?.name
          const customMeta = customAlgoMeta[sel.__key] || {}

          return (
            <Paper
              key={i}
              variant="outlined"
              sx={{
                borderRadius: 2,
                overflow: "hidden",
              }}
            >
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  gap: 1,
                  alignItems: "center",
                  px: 1.25,
                  py: 1,
                }}
              >
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: "auto 1fr auto",
                    alignItems: "center",
                    gap: 1,
                    minWidth: 0,
                  }}
                >
                  {renderAlgoIcon(algo)}

                  <Box sx={{ minWidth: 0 }}>
                    <Typography
                      variant="h6"
                      sx={{
                        fontWeight: 700,
                        lineHeight: 1.2,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {sel.name || algo.name}
                    </Typography>

                    <Typography variant="caption" sx={{ color: "text.secondary", lineHeight: 0 }}>
                      {sel.id}
                    </Typography>
                  </Box>

                  <Tooltip title={isOpen ? "Hide settings" : "Show settings"}>
                    <IconButton
                      size="small"
                      onClick={() => toggleExpanded(sel.__key)}
                      sx={{
                        transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                        transition: "transform 150ms ease",
                      }}
                      color='secondary'
                    >
                      <ExpandMoreRoundedIcon />
                    </IconButton>
                  </Tooltip>
                </Box>

                <Tooltip title={t('common.remove')}>
                  <IconButton
                    onClick={() => removeSelected(sel.__key)}
                    color='error'
                  >
                    <DeleteOutlineRoundedIcon />
                  </IconButton>
                </Tooltip>
              </Box>

              <Collapse in={isOpen} timeout="auto" unmountOnExit>
                <Divider />
                <Box sx={{ p: 2 }}>
                  {/* Common config */}
                  <Stack spacing={2}>
                    {/* Custom Match example: show URL/token fields if type matches */}
                    {algo.type === "custom" ? (
                      <Paper
                        variant="outlined"
                        sx={{
                          borderRadius: 2,
                          p: 2,
                          borderLeftWidth: 4,
                          borderLeftColor: "primary.main",
                          borderLeftStyle: "solid",
                        }}
                      >
                        <Stack spacing={1.5}>
                          <TextField
                            fullWidth
                            required
                            label={t('map_project.api_url')}
                            value={sel.url || ""}
                            onChange={(e) => {
                              updateSelected(sel.__key, { url: e.target.value });
                              if(customMeta.requestError || customMeta.requestSuccess || customMeta.tokenRequired) {
                                setCustomAlgoState(sel.__key, {
                                  requestError: '',
                                  requestSuccess: '',
                                  tokenRequired: false,
                                });
                              }
                            }}
                            onBlur={() => verifyCustomAlgorithm(sel.__key)}
                            placeholder="https://example.com/match"
                            error={Boolean(customMeta.requestError)}
                            helperText={customMeta.requestError || customMeta.requestSuccess || ''}
                          />
                          <TextField
                            fullWidth
                            required={Boolean(customMeta.tokenRequired)}
                            type='password'
                            label={t('map_project.api_token')}
                            value={sel.token || ""}
                            onChange={(e) => {
                              updateSelected(sel.__key, { token: e.target.value });
                              if(customMeta.requestError || customMeta.requestSuccess) {
                                setCustomAlgoState(sel.__key, {
                                  requestError: '',
                                  requestSuccess: '',
                                });
                              }
                            }}
                            onBlur={() => {
                              if(sel.url && eHasValue(sel.token || '')) {
                                verifyCustomAlgorithm(sel.__key, sel.token);
                              }
                            }}
                            placeholder="••••••••"
                            error={Boolean(customMeta.tokenRequired && !sel.token)}
                            helperText={customMeta.tokenRequired && !sel.token ? 'Authentication is required for this algorithm.' : ''}
                          />
                          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                            <TextField
                              sx={{width: '50%'}}
                              required
                              label={t('common.id')}
                              value={sel.id || ''}
                              onChange={(e) =>
                                updateSelected(sel.__key, { id: e.target.value || '' })
                              }
                              error={Boolean(errors[sel.__key]?.id)}
                              helperText={errors[sel.__key]?.id ? t('map_project.algo_conflicting_id') : ''}
                            />
                            <TextField
                              sx={{width: '50%'}}
                              required
                              label={t('common.name')}
                              value={sel.name || ''}
                              onChange={(e) =>
                                updateSelected(sel.__key, {
                                  name: e.target.value || '',
                                })
                              }
                              error={Boolean(errors[sel.__key]?.name)}
                              helperText={errors[sel.__key]?.name ? t('map_project.algo_conflicting_name') : ''}
                            />
                          </Stack>
                          <TextField
                            fullWidth
                            label={t('common.description')}
                            value={sel.description || ''}
                            onChange={(e) =>
                              updateSelected(sel.__key, { description: e.target.value || '' })
                            }
                          />
                          <TextField
                            fullWidth
                            required
                            label={t('map_project.algo_canonical_url', 'Canonical URL')}
                            value={sel.canonical_url || ''}
                            onChange={(e) => updateSelected(sel.__key, { canonical_url: e.target.value || '' })}
                            placeholder="http://loinc.org"
                            helperText={
                              !sel.canonical_url
                                ? t('map_project.algo_canonical_url_required', 'Canonical URL is required for custom algorithms (e.g. http://loinc.org).')
                                : !isLikelyCanonicalUrl(sel.canonical_url)
                                  ? t('map_project.algo_canonical_url_invalid', 'Enter a full URL starting with http:// or https://')
                                  : t('map_project.algo_canonical_url_description', 'Canonical URL of the code system this algorithm matches against (e.g. http://loinc.org).')
                            }
                            error={!isLikelyCanonicalUrl(sel.canonical_url)}
                          />
                          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                            <TextField
                              label={t('map_project.batch_size')}
                              sx={{width: '50%'}}
                              type="number"
                              value={sel.batch_size ?? algo.batch_size ?? 10}
                              onChange={(e) =>
                                updateSelected(sel.__key, { batch_size: clampInt(e.target.value, 1, 1000) })
                              }
                              InputProps={{
                                endAdornment: <InputAdornment position="end">{t('map_project.rows')}</InputAdornment>,
                              }}
                            />

                            <TextField
                              label={t('map_project.concurrent_requests')}
                              sx={{width: '50%'}}
                              type="number"
                              value={sel.concurrent_requests ?? algo.concurrent_requests ?? 1}
                              onChange={(e) =>
                                updateSelected(sel.__key, {
                                  concurrent_requests: clampInt(e.target.value, 1, 50),
                                })
                              }
                            />
                          </Stack>

                          <Stack direction="row" spacing={1} justifyContent="flex-end">
                            <Button size='small' color='error' variant="outlined" onClick={() => toggleExpanded(sel.__key)} sx={{textTransform: 'none'}}>
                              {t('common.close')}
                            </Button>
                            <Button disabled={hasErrors} size='small' variant="contained" onClick={() => toggleExpanded(sel.__key)} sx={{textTransform: 'none'}}>
                              {t('common.save')}
                            </Button>
                          </Stack>
                        </Stack>
                      </Paper>
                    ) : algo.type?.includes('bridge') ? (
                      <Stack spacing={1.5}>
                        {isCoreUser && (
                          <>
                            {(() => {
                              const bridgeSourceUrl = sel.target_repo_url ?? algo.target_repo_url ?? ''
                              const bridgeBaseUrl = dropVersion(bridgeSourceUrl) || bridgeSourceUrl
                              const bridgeVersions = bridgeVersionsByUrl[bridgeBaseUrl] || []
                              const bridgeVersionsLoaded = Boolean(bridgeVersionsLoadedByUrl[bridgeBaseUrl])
                              const latestReleasedBridgeVersion = getLatestReleasedBridgeVersion(bridgeVersions)
                              const hasSelectableBridgeVersions = bridgeVersions.some(isLLMBridgeRepoVersion)
                              const selectedBridgeVersion = bridgeVersions.find(version => version?.id === sel.target_repo_version)
                                || (sel.target_repo_version ? { id: sel.target_repo_version, version: sel.target_repo_version } : null)
                              const bridgeVersionHelperText = bridgeSourceUrl
                                ? (
                                  !bridgeVersionsLoaded
                                    ? t('map_project.loading_versions')
                                    : hasSelectableBridgeVersions
                                    ? t('map_project.bridge_version_description')
                                    : t('map_project.bridge_version_unavailable')
                                )
                                : t('map_project.bridge_version_source_required')

                              return (
                                <>
                            <TextField
                              fullWidth
                              label={t('map_project.bridge_source_url', 'Bridge Source URL')}
                              value={bridgeSourceUrl}
                              onChange={(e) => updateSelected(sel.__key, { target_repo_url: e.target.value, target_repo_version: '' })}
                              placeholder="/orgs/<org>/sources/<source>/"
                              helperText={t('map_project.bridge_source_url_description', 'The interface terminology to search through for bridge matching')}
                            />
                            <TextField
                              fullWidth
                              label={t('map_project.bridge_canonical_url', 'Bridge Canonical URL')}
                              value={sel.bridge_repo?.canonical_url || ''}
                              onChange={(e) => updateSelected(sel.__key, {
                                bridge_repo: {
                                  ...(sel.bridge_repo || {}),
                                  canonical_url: e.target.value || '',
                                  canonical_url_source: e.target.value ? 'repo' : 'derived'
                                }
                              })}
                              placeholder="https://CIELterminology.org"
                              helperText={t('map_project.bridge_canonical_url_description', 'Canonical URL of the bridge code system (leave blank to derive from the relative URL).')}
                            />
                            <RepoVersionSearchAutocomplete
                              versions={bridgeVersions}
                              label={t('common.version')}
                              size='small'
                              value={selectedBridgeVersion}
                              onChange={(id, item) => updateSelected(sel.__key, { target_repo_version: item?.id || '' })}
                              helperText={bridgeVersionHelperText}
                              getOptionDisabled={option => !isLLMBridgeRepoVersion(option)}
                              getOptionRightText={option => {
                                if(option?.id === latestReleasedBridgeVersion?.id)
                                  return t('common.latest')
                                if(!isLLMBridgeRepoVersion(option))
                                  return t('map_project.not_vectorised')
                                return ''
                              }}
                            />
                            {!sel.bridge_repo?.canonical_url && (
                              <Chip size='small' label={t('map_project.canonical_auto_derived', 'Auto-derived')} sx={{alignSelf: 'flex-start'}} />
                            )}
                                </>
                              )
                            })()}
                          </>
                        )}
                        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                          <TextField
                            label={t('map_project.batch_size')}
                            sx={{width: '50%'}}
                            type="number"
                            value={sel.batch_size ?? algo.batch_size ?? 10}
                            onChange={(e) => updateSelected(sel.__key, { batch_size: clampInt(e.target.value, 1, 1000) })}
                          />
                          <TextField
                            label={t('map_project.concurrent_requests')}
                            sx={{width: '50%'}}
                            type="number"
                            value={sel.concurrent_requests ?? algo.concurrent_requests ?? 1}
                            onChange={(e) =>
                              updateSelected(sel.__key, {
                                concurrent_requests: clampInt(e.target.value, 1, 50),
                              })
                            }
                          />
                        </Stack>
                      </Stack>
                    ) : (
                      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                        <TextField
                          label={t('common.id')}
                          sx={{width: '50%'}}
                          value={sel.id || ''}
                          onChange={(e) => updateSelected(sel.__key, { id: e.target.value || '' })}
                          error={Boolean(errors[sel.__key]?.id)}
                          helperText={errors[sel.__key]?.id ? t('map_project.algo_conflicting_id') : ''}
                          disabled={algo.provider === 'ocl'}
                        />
                        <TextField
                          label={t('map_project.batch_size')}
                          sx={{width: '50%'}}
                          type="number"
                          value={sel.batch_size ?? algo.batch_size ?? 10}
                          onChange={(e) => updateSelected(sel.__key, { batch_size: clampInt(e.target.value, 1, 1000) })}
                        />
                        <TextField
                          label={t('map_project.concurrent_requests')}
                          sx={{width: '50%'}}
                          type="number"
                          value={sel.concurrent_requests ?? algo.concurrent_requests ?? 1}
                          onChange={(e) =>
                            updateSelected(sel.__key, {
                              concurrent_requests: clampInt(e.target.value, 1, 50),
                            })
                          }
                        />
                      </Stack>
                    )}
                  </Stack>
                </Box>
              </Collapse>
            </Paper>
          );
        })}

        {/* Add algo row */}
        <Paper
          variant="outlined"
          sx={{
            borderRadius: 2,
            p: 1.25,
            borderStyle: "dashed",
            opacity: canAddMore ? 1 : 0.6,
          }}
        >
          <Stack direction="row" spacing={1} alignItems="center">
            <Box sx={{ display: "grid", placeItems: "center", width: 34, height: 34 }}>
              <AddRoundedIcon />
            </Box>

            <FormControl fullWidth size="small" disabled={!canAddMore}>
              <Select
                displayEmpty
                value=""
                renderValue={(v) => (v ? v : t('map_project.select_an_algo'))}
                MenuProps={{PaperProps: {style: {maxWidth: '350px'}}}}
              >
                {
                  addableOptions.map((a, index) => {
                  return (
                    <ListItemButton id={a.id} key={index} value={a.id} disabled={a.disabled} onClick={() => addAlgo(a.id)}>
                      <ListItemIcon sx={{minWidth: 'auto', marginRight: '16px'}}>
                        {renderAlgoIcon(a)}
                      </ListItemIcon>
                      <ListItemText primary={a.name} secondary={a.description} />
                      {
                        a.provider === 'ocl' &&
                          <Tooltip title="OCL's own match algorithm">
                        <span>
                          <ConceptIcon selected />
                        </span>
                        </Tooltip>
                      }
                    {
                      a.provider === 'external' &&
                        <i className="fa-solid fa-square-arrow-up-right" style={{fontSize: '1.25rem'}} />
                    }
                    </ListItemButton>
                  )
                  })
                }
              </Select>
            </FormControl>
          </Stack>
        </Paper>
      </Stack>
    </Box>
  );
}

function clampInt(value, min, max) {
  const n = Number.parseInt(value, 10);
  if (Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function eHasValue(value) {
  return Boolean(value && String(value).trim());
}
