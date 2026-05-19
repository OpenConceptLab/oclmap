/*eslint no-process-env: 0*/

import React from 'react'
import { useTranslation } from 'react-i18next';
import * as XLSX from 'xlsx';
import moment from 'moment'
import Split from 'react-split';
import BridgeMatch from '../../services/LazyLoader'

import { useParams, useHistory, useLocation } from 'react-router-dom'

import Paper from '@mui/material/Paper'
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Dialog from '@mui/material/Dialog';
import IconButton from '@mui/material/IconButton'
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Chip from '@mui/material/Chip';
import FormControl from '@mui/material/FormControl';
import Tooltip from '@mui/material/Tooltip';
import Alert from '@mui/material/Alert';
import Collapse from '@mui/material/Collapse';
import Divider from '@mui/material/Divider';
import { DataGrid } from '@mui/x-data-grid';


import DoubleArrowIcon from '@mui/icons-material/DoubleArrow';
import DoneIcon from '@mui/icons-material/Done';
import CloseIcon from '@mui/icons-material/Close';
import AutoMatchIcon from '@mui/icons-material/MotionPhotosAutoOutlined';
import ClearIcon from '@mui/icons-material/Clear';
import AssistantIcon from '@mui/icons-material/Assistant';
import PendingIcon from '@mui/icons-material/HourglassBottom';

import orderBy from 'lodash/orderBy'
import filter from 'lodash/filter'
import map from 'lodash/map'
import forEach from 'lodash/forEach'
import snakeCase from 'lodash/snakeCase'
import startCase from 'lodash/startCase'
import values from 'lodash/values'
import find from 'lodash/find'
import without from 'lodash/without'
import has from 'lodash/has'
import chunk from 'lodash/chunk'
import get from 'lodash/get'
import omit from 'lodash/omit'
import omitBy from 'lodash/omitBy'
import reject from 'lodash/reject'
import uniq from 'lodash/uniq'
import compact from 'lodash/compact'
import flatten from 'lodash/flatten'
import debounce from 'lodash/debounce'
import keys from 'lodash/keys'
import pickBy from 'lodash/pickBy'
import every from 'lodash/every'
import isEmpty from 'lodash/isEmpty'
import findIndex from 'lodash/findIndex'
import isString from 'lodash/isString'
import isNaN from 'lodash/isNaN'
import isArray from 'lodash/isArray'
import isBoolean from 'lodash/isBoolean'
import isNumber from 'lodash/isNumber'
import times from 'lodash/times'
import pick from 'lodash/pick'

import { OperationsContext } from '../app/LayoutContext';

import APIService from '../../services/APIService';
import { highlightTexts, dropVersion, getCurrentUser, URIToParentParams, hasAuthGroup, downloadObject, currentUserToken } from '../../common/utils';
import { WHITE, SURFACE_COLORS } from '../../common/colors';

import { useDoubleClick } from '../common/useDoubleClick'
import CloseIconButton from '../common/CloseIconButton';
import SearchHighlightsDialog from '../search/SearchHighlightsDialog'
import ConceptHome from '../concepts/ConceptHome'
import DraggablePaperComponent from '../common/DraggablePaperComponent'
import LoaderDialog from '../common/LoaderDialog'
import Error403 from '../errors/Error403'
import { HEADERS, SEMANTIC_SEARCH_HEADERS, ROW_STATES, VIEWS, DECISION_TABS, ROW_STAGES, PROMPTS_KEY_DEFAULT, PROMPTS_ACTION_TYPE_DEFAULT } from './constants'
import MapProjectDeleteConfirmDialog from './MapProjectDeleteConfirmDialog';
import ConfigurationForm from './ConfigurationForm'
import Controls from './Controls'
import MatchSummaryCard from './MatchSummaryCard'
import SearchField from './SearchField'
import MappingDecisionResult from './MappingDecisionResult'
import DecisionSelector from './DecisionSelector'
import ReviewNote from './ReviewNote'
import Propose from './Propose'
import Candidates from './Candidates'
import Search from './Search'
import Discuss from './Discuss'
import ScoreBucketButton from './ScoreBucketButton'
import Concept from './Concept'
import ImportToCollection from './ImportToCollection'
import ProjectLogs from './ProjectLogs';
import { useAlgos, CONCEPT_IDENTITY_BY_TYPE, ensureConceptIdentity } from './algorithms'
import AutoMatchDialog from './AutoMatchDialog'
import { DEFAULT_ENCODER_MODEL } from './rerankerModels'
import { normalizeAlgorithmInvocation, lookupStatusRank, normalizeLegacyAllCandidates, buildRecommendableConceptEntry, stripConstantClassAndDatatype } from './normalizers'
import { parseConceptKey } from './conceptKey'
import { buildQualityRowViews, conceptForMapping, resolveAICandidateID } from './viewBuilders.js'

import './MapProject.scss'
import '../common/ResizablePanel.scss'

/**
 * Feature flag for the unified candidate/concept data model
 * (plans/unified-mapper-model.md, ocl_issues#2337). Flipped to true in PR2b
 * once: (a) the write-side parallel state was wired up in PR1, (b) PR2a
 * routed all algorithm types (bridge, scispacy, AI payload v2) through the
 * normalizer, and (c) PR2b flipped reads (Candidates / Concept / Score /
 * setAutoMatched / setStateViews) to consume rowMatchState + conceptCache
 * via structured tuples. The legacy allCandidates write path is still
 * populated so save/load works with the existing schema; PR3 drops it
 * along with the legacy `candidates` field in the AI payload and the
 * `concept_id` / `id` response shims.
 */
const UNIFIED_MODEL_ENABLED = true

// const LOG = {
//   action: '',
//   user: '',
//   description: '',
//   extras: {},
//   created_at: ''
// }

const MapProject = () => {
  const { t } = useTranslation();
  const { toggles, setAlert: baseSetAlert } = React.useContext(OperationsContext);
  const user = getCurrentUser()
  const params = useParams()
  const history = useHistory()
  const location = useLocation()
  const templateFromProjectURL = React.useMemo(() => {
    const queryParams = new URLSearchParams(location.search)
    return queryParams.get('templateFrom')
  }, [location.search])

  const bridgeRef = React.useRef()
  const facetsRequestsRef = React.useRef({})
  const latestFacetRequestRef = React.useRef({})
  // project state
  const [project, setProject] = React.useState(null)
  const [name, setName] = React.useState('')
  const [owner, setOwner] = React.useState(user?.url)
  const [description, setDescription] = React.useState('')
  const [file, setFile] = React.useState(false)
  const [data, setData] = React.useState(false)
  const [columns, setColumns] = React.useState([])
  const [rowStatuses, setRowStatuses] = React.useState({reviewed: [], readyForReview: [], unmapped: []})
  const [decisions, setDecisions] = React.useState({})
  const [decisionFilters, setDecisionFilters] = React.useState([])
  const [matchedConcepts, setMatchedConcepts] = React.useState([]);

  // Algo Candidates
  const [allCandidates, setAllCandidates] = React.useState({}); // ocl-scispacy-loinc

  // Unified candidate/concept model (plans/unified-mapper-model.md). Populated
  // in parallel with allCandidates when UNIFIED_MODEL_ENABLED is true. Shape:
  //   { [rowIndex]: {
  //       algorithm_responses: { [id]: AlgorithmResponse },
  //       candidates:          { [id]: Candidate },
  //       concept_rows:        { [concept_key]: ConceptRow },
  //   } }
  // ConceptDefinitions live in the project-wide conceptCache. The legacy
  // population of conceptCache is URL-keyed; new ConceptDefinitions written
  // via mergeIntoRowMatchState / ensureLoaded are keyed by the opaque
  // concept_key (makeConceptKey output). The two key namespaces don't
  // collide — opaque keys are JSON.stringify'd arrays, URLs start with '/'.
  // PR3 collapses to key-only when legacy save/load is dropped.
  const [, setRowMatchState] = React.useState({})
  const rowMatchStateRef = React.useRef({})

  const [searchedConcepts, setSearchedConcepts] = React.useState({});
  const [fetchedFacets, setFetchedFacets] = React.useState({});
  const [rowFacetKeys, setRowFacetKeys] = React.useState({});
  const [appliedFacets, setAppliedFacets] = React.useState({});
  const [searchResponse, setSearchResponse] = React.useState({});
  const [algosSelected, setAlgosSelected] = React.useState([])
  const [notes, setNotes] = React.useState({})
  const [mapTypes, setMapTypes] = React.useState({})
  const [proposed, setProposed] = React.useState({})
  const [mapSelected, setMapSelected] = React.useState({})
  const [startMatchingAt, setStartMatchingAt] = React.useState(false)
  const [endMatchingAt, setEndMatchingAt] = React.useState(false)
  const [bulkAIAnalysisStartedAt, setBulkAIAnalysisStartedAt] = React.useState(false)
  const [bulkAIAnalysisEndedAt, setBulkAIAnalysisEndedAt] = React.useState(false)
  const [bridgeCandidatesStartedAt, setBridgeCandidatesStartedAt] = React.useState(false)
  const [bridgeCandidatesEndedAt, setBridgeCandidatesEndedAt] = React.useState(false)
  const [scispacyCandidatesStartedAt, setScispacyCandidatesStartedAt] = React.useState(false)
  const [scispacyCandidatesEndedAt, setScispacyCandidatesEndedAt] = React.useState(false)
  const [searchStr, setSearchStr] = React.useState('') // concept search
  const [candidatesScore, setCandidatesScore] = React.useState({recommended: 99, available: 70})
  const [filters, setFilters] = React.useState({})
  const [AIModel, setAIModel] = React.useState('')
  const [promptTemplate, setPromptTemplate] = React.useState(false)
  const [promptTemplates, setPromptTemplates] = React.useState(false)
  const [projectPromptTemplateKey, setProjectPromptTemplateKey] = React.useState('')
  const promptTemplatesFetchedRef = React.useRef(false)

  const abortRef = React.useRef(false);
  const isBulkMatchRunningRef = React.useRef(false);
  const bulkMatchAlgoIdsRef = React.useRef([]);

  const [row, setRow] = React.useState(false)
  const [loadingMatches, setLoadingMatches] = React.useState(false)
  const [isLoadingInDecisionView, setIsLoadingInDecisionView] = React.useState(false)
  const [edit, setEdit] = React.useState([]);
  const [configure, setConfigure] = React.useState(!params.projectId);
  const [selectedRowStatus, setSelectedRowStatus] = React.useState('all')
  const [decisionTab, setDecisionTab] = React.useState('candidates')
  const [searchText, setSearchText] = React.useState('')  // csv row search
  const [selectedCandidatesScoreBucket, setSelectedCandidatesScoreBucket] = React.useState(false)
  const [scoreBucketSortBy, setScoreBucketSortBy] = React.useState('desc')

  const [matchDialog, setMatchDialog] = React.useState(false)
  const [showHighlights, setShowHighlights] = React.useState(false)
  const [showItem, setShowItem] = React.useState(false)
  const [autoMatchUnmappedOnly, setAutoMatchUnmappedOnly] = React.useState(true)
  const [autoRunAIAnalysis, setAutoRunAIAnalysis] = React.useState(false)
  const [alert, setAlert] = React.useState(false)
  const [columnVisibilityModel, setColumnVisibilityModel] = React.useState({})
  const [AIAssistantColumns, setAIAssistantColumns] = React.useState({})
  const [columnWidth, setColumnWidth] = React.useState({})
  const [logs, setLogs] = React.useState({})
  const [projectLogs, setProjectLogs] = React.useState([])
  const [filterModel, setFilterModel] = React.useState({ items: [] });
  const [retired, setRetired] = React.useState(false)
  const [showProjectLogs, setShowProjectLogs] = React.useState(false)

  // repo state
  const [repo, setRepo] = React.useState(false)
  const [repoVersion, setRepoVersion] = React.useState(false)
  const [mappedSources, setMappedSources] = React.useState([])
  const [bridgeMappedSources, setBridgeMappedSources] = React.useState({})
  const [locales, setLocales] = React.useState([])
  const [isLoadingLocales, setIsLoadingLocales] = React.useState(false)
  const [versions, setVersions] = React.useState([])
  const [conceptCache, setConceptCache] = React.useState({})
  const [allMapTypes, setAllMapTypes] = React.useState([])
  // PR3-H: OCL Locales source provides the canonical language picker for
  // both Input Language and AI Output Locale. Fetched once per session.
  // Each concept: {id: 'por' (ISO 639-3), locale: 'pt' (BCP-47 subtag),
  // display_name: 'Portuguese'}. We use the BCP-47 `locale` field as the
  // stored value and `display_name` for the label.
  // Initial state is the fallback list so the dropdowns are usable
  // immediately on mount and on fetch failure. All language lists in the
  // app sort alphabetically by display name (English collation).
  const LOCALE_FALLBACK = [
    { id: 'en', name: 'English' },
    { id: 'fr', name: 'French' },
    { id: 'pt', name: 'Portuguese' },
    { id: 'es', name: 'Spanish' }
  ]
  const [oclLocales, setOclLocales] = React.useState(LOCALE_FALLBACK)
  const [random, setRandom] = React.useState(0)
  const [deleteProject, setDeleteProject] = React.useState(false)
  const [loadingProject, setLoadingProject] = React.useState(false)
  const [isSaving, setIsSaving] = React.useState(false)
  const [includeDefaultFilter, setIncludeDefaultFilter] = React.useState(true)
  const [analysis, setAnalysis] = React.useState({})
  const [AIModels, setAIModels] = React.useState([])
  const [lookupConfig, setLookupConfig] = React.useState({})
  const [encoderModel, setEncoderModel] = React.useState(DEFAULT_ENCODER_MODEL)
  const [promptOutputLocale, setPromptOutputLocale] = React.useState(null)
  // PR3-H: project-level input language. Default 'en' for new projects so
  // the auto-populate rule for target-repo name filter (see ConfigurationForm)
  // produces a useful starting set. Existing projects load whatever the
  // backend has stored (null for projects created before this field existed
  // — they observe the zero-regression "no filter" path).
  const [inputLocale, setInputLocale] = React.useState('en')
  const [useLexicalVariants, setUseLexicalVariants] = React.useState(false)
  // Project canonical-resolution context (plans/unified-mapper-model.md
  // "Project configuration: explicit canonical context"). Empty = use the
  // project owner as the default resolution namespace.
  const [namespace, setNamespace] = React.useState('')

  // import
  const [openImportToCollection, setOpenImportToCollection] = React.useState(false)
  const [imports, setImports] = React.useState([])

  const [permissionDenied, setPermissionDenied] = React.useState(false)

  const rowStageRef = React.useRef([]);
  const [, _setRowStage] = React.useState({})  // {'0': {'algo1': -2, -1, 0, 1, 'rerank': -2, -1, 0, 1}} --> -2: failed, -1: not run yet, 0: running, 1: done
  const setRowStage = React.useCallback((updater) => {
    const next = typeof updater === "function" ? updater(rowStageRef.current) : updater;
    // Keep the ref in lockstep with imperative consumers like rerank checks.
    rowStageRef.current = next;
    _setRowStage(next);
  }, []);

  /**
   * Merge a normalized invocation into the row's RowMatchState (in-place on
   * the ref, then setState to trigger renders once read paths are flipped).
   * Concept definitions are merged into conceptCache (project-wide). Concept
   * rows are merged per-row, preferring existing rerank_score over undefined.
   */
  const mergeIntoRowMatchState = React.useCallback((rowIndex, normalized, options = {}) => {
    if(!normalized) return
    const { append = false } = options
    const { algorithm_response, candidates, concept_definitions, concept_rows } = normalized
    const incomingAlgoId = algorithm_response?.algorithm_id

    const prevAll = rowMatchStateRef.current
    const prevRow = prevAll[rowIndex] || {
      algorithm_responses: {},
      candidates: {},
      concept_rows: {},
    }

    // For fresh invocations (offset===0), drop existing candidates from
    // THIS algorithm before merging incoming ones — a re-run replaces the
    // previous results for the same (rowIndex, algorithmId). The legacy
    // onResponse path does the same via `reject(...)` on allCandidates.
    // Without this guard, repeated invocations stack candidates with
    // fresh UUIDs but identical concept_keys (same concept appears N
    // times in algorithm view).
    //
    // For pagination append (offset>0), pass append=true to preserve the
    // earlier page's candidates and just stack the new ones on top.
    const survivingCandidates = {}
    Object.entries(prevRow.candidates || {}).forEach(([id, c]) => {
      if(append || c?.algorithm_id !== incomingAlgoId) survivingCandidates[id] = c
    })

    const nextRow = {
      algorithm_responses: {
        ...prevRow.algorithm_responses,
        [algorithm_response.id]: algorithm_response,
      },
      candidates: {
        ...survivingCandidates,
        ...candidates.reduce((acc, c) => { acc[c.id] = c; return acc }, {}),
      },
      concept_rows: { ...prevRow.concept_rows },
    }

    // Prune concept_rows whose concept_key is no longer referenced by any
    // surviving candidate (only meaningful for the replace path; append
    // keeps everything). Without this, stale concept_rows from the prior
    // run keep appearing in quality view even though their candidates
    // were dropped.
    if(!append) {
      const referencedKeys = new Set(Object.values(nextRow.candidates).map(c => c?.concept_key))
      Object.keys(nextRow.concept_rows).forEach(k => {
        if(!referencedKeys.has(k)) delete nextRow.concept_rows[k]
        else if(nextRow.concept_rows[k]?.rerank_score !== undefined)
          nextRow.concept_rows[k] = { ...nextRow.concept_rows[k], rerank_score: undefined }
      })
    }

    concept_rows.forEach(cr => {
      const existing = nextRow.concept_rows[cr.concept_key]
      // On a fresh (non-append) run scores are already cleared above; on
      // append (pagination) preserve any existing rerank_score so partial
      // pages don't clobber scores from earlier pages.
      nextRow.concept_rows[cr.concept_key] = existing && existing.rerank_score !== undefined
        ? existing
        : cr
    })

    rowMatchStateRef.current = { ...prevAll, [rowIndex]: nextRow }
    setRowMatchState(rowMatchStateRef.current)

    // Merge ConceptDefinitions into the project-wide conceptCache, keyed by
    // the opaque concept_key. Prefer richer (lookup_status='full') over
    // stubs ('pending'/'partial'). Update conceptCacheRef synchronously so
    // same-tick consumers (setStateViews / setAutoMatched) read the just-
    // merged entries before React commits the setState.
    const nextCache = { ...conceptCacheRef.current }
    let cacheChanged = false
    concept_definitions.forEach(def => {
      const existing = nextCache[def.key]
      if(!existing || lookupStatusRank(def.lookup_status) > lookupStatusRank(existing.lookup_status)) {
        nextCache[def.key] = def
        cacheChanged = true
      }
    })
    if(cacheChanged) {
      conceptCacheRef.current = nextCache
      setConceptCache(nextCache)
    }

    // Auto-trigger ensureLoaded for any newly-arrived ConceptDefinitions
    // that aren't yet 'full' (bridge cascade targets land as 'pending';
    // sparse algorithm results land as 'partial'). The plan calls $lookup
    // "state-driven on ConceptDefinition" — this is the trigger point.
    // ensureLoaded is idempotent + in-flight-deduped so an extra call is
    // free. Forward-ref pattern because ensureLoaded is declared later.
    if(ensureLoadedRef.current) {
      const keysToLoad = concept_definitions
        .filter(d => d && d.lookup_status !== 'full')
        .map(d => d.key)
      if(keysToLoad.length) {
        ensureLoadedRef.current(keysToLoad).then(() => {
          if(scheduleRerankRef.current) scheduleRerankRef.current(rowIndex)
        })
      }
    }

    // Trigger a rerank if any newly-arrived ConceptRow lacks a rerank_score
    // (plans/unified-mapper-model.md — rerank trigger is debounce +
    // in-flight check, not "wait for all algos").
    const anyPending = concept_rows.some(cr => !isNumber(cr.rerank_score))
    if(anyPending && scheduleRerankRef.current)
      scheduleRerankRef.current(rowIndex)
  }, [])

  const allCandidatesRef = React.useRef({})
  const conceptCacheRef = React.useRef({})

  // In-flight $lookup tracking (plans/unified-mapper-model.md "$lookup —
  // built on $resolveReference"). Map<concept_key, Promise>. ensureLoaded
  // dedupes concurrent calls for the same key by awaiting the existing
  // Promise instead of issuing a duplicate fetch.
  const inFlightLookupsRef = React.useRef(new Map())

  // Rerank scheduling (plans/unified-mapper-model.md "Rerank — debounce +
  // in-flight check"). Replaces the legacy "wait for every algo to
  // complete" trigger with: any ConceptRow with rerank_score === undefined
  // makes its row eligible; debounce coalesces rapid algo completions;
  // in-flight set prevents double-firing.
  const inFlightRerankRef = React.useRef(new Set())
  const rerankDebounceRef = React.useRef({})
  const rerankRerunNeededRef = React.useRef(new Set())
  // Forward-ref pointer for mergeIntoRowMatchState (declared earlier in
  // the component) to call scheduleRerank (declared later). The ref is
  // wired up via useEffect once scheduleRerank exists.
  const scheduleRerankRef = React.useRef(null)
  // Same forward-ref pattern for ensureLoaded — mergeIntoRowMatchState
  // calls it to auto-fill 'pending'/'partial' ConceptDefinitions as they
  // arrive, but ensureLoaded is defined later in the component.
  const ensureLoadedRef = React.useRef(null)

  /*eslint no-undef: 0*/
  const AI_ASSISTANT_API_URL = window.AI_ASSISTANT_API_URL || process.env.AI_ASSISTANT_API_URL
  const SCISPACY_API_URL = window.SCISPACY_LOINC_API_URL || process.env.SCISPACY_LOINC_API_URL
  const OCL_ONLINE_API_URL = window.OCL_ONLINE_API_URL || process.env.OCL_ONLINE_API_URL
  const inAIAssistantGroup = Boolean(hasAuthGroup(user, 'mapper_ai_assistant') && AI_ASSISTANT_API_URL)
  const isCoreUser = hasAuthGroup(user, 'core_user')
  const CANDIDATES_LIMIT = 15
  const canBridge = bridgeRef?.current?.canBridge()
  const canScispacy = Boolean(canBridge && SCISPACY_API_URL && toggles.SCISPACY_LOINC_TOGGLE === true)
  const isMultiAlgo = algosSelected.length > 1
  const scispacyEnabled = find(algosSelected, {type: 'ocl-scispacy'})
  const bridgeAlgo = find(algosSelected, a => ['ocl-bridge', 'ocl-ciel-bridge'].includes(a.type))
  const bridgeEnabled = Boolean(bridgeAlgo)

  // Build projectContext for the unified-model normalizer. Reads target repo
  // canonical_url from repo metadata; if absent, derives
  // 'https://ns.openconceptlab.org' + relative URL (per OCL canonical
  // conventions — see plans/unified-mapper-model.md). When a bridge algo is
  // selected, includes bridge_repo derived from algo.target_repo_url.
  const buildProjectContext = React.useCallback(() => {
    if(!repo?.url) return null
    const targetCanonical = repo.canonical_url || `https://ns.openconceptlab.org${repo.url}`
    const ctx = {
      namespace: namespace || get(project, 'owner_url') || owner,
      target_repo: {
        relative_url: repo.url,
        canonical_url: targetCanonical,
        canonical_url_source: repo.canonical_url ? 'repo' : 'derived',
        version: repoVersion?.id || repo.version
      }
    }
    // bridge_repo when a bridge algo is in use. Prefer the explicit canonical
    // URL captured on the algo's bridge_repo metadata (set via the
    // MultiAlgoSelector bridge canonical_url field, PR2b); fall back to the
    // derived form (https://ns.openconceptlab.org + relative_url) when only
    // the relative URL is known. If target_repo_url is missing entirely —
    // the algo was added without ever editing the bridge source URL field —
    // fall back to the type's well-known default (matches the placeholder
    // shown in MultiAlgoSelector). Without this fallback, normalization
    // silently produces zero candidates for bridge-only flows.
    const BRIDGE_DEFAULT_RELATIVE_URL = { 'ocl-ciel-bridge': '/orgs/CIEL/sources/CIEL/' }
    const bridgeRelativeUrl = bridgeAlgo?.target_repo_url
      || BRIDGE_DEFAULT_RELATIVE_URL[bridgeAlgo?.type]
    if(bridgeAlgo && bridgeRelativeUrl) {
      const explicitBridgeCanonical = bridgeAlgo?.bridge_repo?.canonical_url
      ctx.bridge_repo = {
        relative_url: bridgeRelativeUrl,
        canonical_url: explicitBridgeCanonical || `https://ns.openconceptlab.org${bridgeRelativeUrl}`,
        canonical_url_source: explicitBridgeCanonical ? 'repo' : 'derived'
      }
    }
    return ctx
  }, [project, owner, repo, repoVersion, bridgeAlgo, namespace])

  const baseAlgos = useAlgos(t, toggles)
  const [apiAlgos, setApiAlgos] = React.useState([]);
  React.useEffect(() => {
    if (!OCL_ONLINE_API_URL) return;

    const controller = new AbortController();

    (async () => {
      try {
        const service = APIService.new();
        service.URL = OCL_ONLINE_API_URL;
        service.appendToUrl('/match-algorithms/');

        const response = await service.get();
        const _algos = response?.data?.results || []
        setApiAlgos(_algos);
        const bridgeAlgoFromApi = find(_algos, a => ['ocl-bridge', 'ocl-ciel-bridge'].includes(a.type))
        if(bridgeAlgoFromApi) {
          const bridgeUrl = bridgeAlgoFromApi.target_repo_url || '/orgs/CIEL/sources/CIEL/'
          fetchMappedSources(bridgeUrl + 'latest/', sources =>
            setBridgeMappedSources(prev => ({...prev, [bridgeUrl]: sources})))
        }
      } catch {
        // pass
      }
    })();

    return () => controller.abort();
  }, [OCL_ONLINE_API_URL]);

  const algos = React.useMemo(() => {
    const keyOf = (a) => `${a.id}::${a.type}`;

    const map = new Map();
    for (const a of baseAlgos || []) map.set(keyOf(a), a);
    for (const a of apiAlgos || []) map.set(keyOf(a), a); // API overrides

    return Array.from(map.values());
  }, [baseAlgos, apiAlgos]);

  const [targetSourcesFromRows, setTargetSourcesFromRows] = React.useState({}) //{dataKey: [source1_original_name, source2_original_name]}

  let headers = find(algosSelected, {type: 'ocl-semantic'})?.id ? SEMANTIC_SEARCH_HEADERS : HEADERS
  if(repoVersion?.properties)
    headers = [...headers, ...compact(repoVersion?.filters?.map(_filter => {
      if(_filter?.code && !['concept_class', 'datatype'].includes(_filter.code))
        return {id: `property__${_filter.code}`, label: `Property: ${_filter.code}`, description: _filter.description || ''}
    }))]

  React.useEffect(() => {
    if(!isEmpty(decisions)) {
      window.addEventListener("beforeunload", alertUser);
      return () => window.removeEventListener("beforeunload", alertUser);
    }
  }, [decisions]);

  React.useEffect(() => {
    fetchMapTypes()
    fetchOclLocales()
    fetchAIModels()

    if(params.projectId && params.owner) {
      fetchAndSetProject()
      return
    }
    if(templateFromProjectURL) {
      createProjectFromTemplate()
    }
  }, [])

  React.useEffect(() => {
    setPermissionDenied(false)
  }, [params.projectId])

  React.useEffect(() => {
    const isDefaultApplied = isRepoDefaultFilterApplied(repoVersion)
    if(project?.id)
      setIncludeDefaultFilter(Boolean(isDefaultApplied))
    else if(!isDefaultApplied && !isEmpty(repoVersion?.meta?.display?.default_filter || {})) {
      setProject({...project, filters: repoVersion?.meta?.display?.default_filter})
      setIncludeDefaultFilter(true)
    }
  }, [repoVersion, project])


  const createProjectFromTemplate = () => {
    setLoadingProject(true)
    APIService.new().overrideURL(templateFromProjectURL).appendToUrl('configurations/').get().then(response => {
      const copiedProject = response.data
      setProject(null)
      setProjectPromptTemplateKey(copiedProject.prompt_template_key || '')
      setName(copiedProject.name ? t('map_project.create_similar_name', {name: copiedProject.name}) : '')
      setFilters(copiedProject.filters || {})
      setLookupConfig(copiedProject.lookup_config || {})
      setNamespace(copiedProject.namespace || '')
      setCandidatesScore(copiedProject.score_configuration || {recommended: 99, available: 70})
      setRetired(Boolean(copiedProject.include_retired || false))
      setAlgosSelected(copiedProject.algorithms || [])
      setEncoderModel(copiedProject.encoder_model || DEFAULT_ENCODER_MODEL)
      setUseLexicalVariants(Boolean(copiedProject.use_lexical_variants))
      setInputLocale((copiedProject.input_locales || [])[0] || '')
      if(copiedProject.target_repo_url) {
        const repoParams = URIToParentParams(copiedProject.target_repo_url, true)
        fetchRepo(dropVersion(copiedProject.target_repo_url))
        fetchVersions(copiedProject.target_repo_url, repoParams?.repoVersion || 'HEAD')
      }
      setConfigure(true)
    }).finally(() => setLoadingProject(false))
  }

  const fetchAndSetProject = () => {
    setLoadingProject(true)
    let url = ['', params.ownerType, params.owner, 'map-projects', params.projectId, ''].join('/')
    APIService.new().overrideURL(url).get().then(response => {
      if(response?.detail) {
        setPermissionDenied(true)
        baseSetAlert({message: response.detail, severity: 'error'})
        setLoadingProject(false)
        return
      }
      setFilters(response.data?.filters || {})
      if(response.data?.url) {
        APIService.new().overrideURL(response.data.url).appendToUrl('logs/').get().then(response => {
          setLogs(response.data.logs?.row_logs || [])
          setProjectLogs(response.data.logs?.project_logs || [])
          projectLog({action: 'Opened'})
        })
      }
      if(response.data?.file_url) {
        fetch(response.data.file_url).then(res => res.text()).then(csvText => {
          const workbook = XLSX.read(csvText, { type: "string", raw: true });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          const data = XLSX.utils.sheet_to_json(sheet, { raw: false, defval: '' })
          setProjectFromData(data, response.data)
          setAlgosSelected(response?.data?.algorithms || [])
          if (response?.data.columns?.length > 0) {
            const _columns = response.data.columns.map(col => ({...omit(col, ['hidden'])}))
            setColumns(_columns)
            setTargetSourcesFromRows(getTargetSourcesFromRows(_columns, data))
            let AIAssistantColVisibility = {}
            let colVisibility = {}
            let colWidth = {}
            response.data.columns.forEach(col => {
              if(col.hidden)
                colVisibility[col.dataKey] = false
              if(col.ai_assistant_hidden)
                AIAssistantColVisibility[col.dataKey] = false
              if(col.width) {
                if(isString(col.width)) {
                  let _width = parseInt(col.width.replace('px'))
                  if(!isNaN(_width))
                    col.width = _width
                }
                colWidth[col.dataKey] = col.width
              }
            })
            setColumnVisibilityModel(colVisibility)
            setAIAssistantColumns(AIAssistantColVisibility)
            setColumnWidth(colWidth)
          }
          setTimeout(() => {
            let _file = getFileObjectFromRows(response.data.input_file_name)
            setFile(_file)
            setName(response.data?.name || name || file?.name || '')
          }, 500)
          setLoadingProject(false)
        })
      } else {
        setLoadingProject(false)
      }
      let _rowStage = {}
      let _allCandidates = {}
      let _cache = {}
      forEach((response?.data?.candidates || []), candidate => {
        forEach(candidate.results, concept => {
          if(!_rowStage[candidate.row.__index]?.rerank)
            _rowStage[candidate.row.__index] = {...(_rowStage[candidate.row.__index] || {}), rerank: isNumber(concept?.search_meta?.search_rerank_score) ? 1 : -1}
          if(concept?.url && concept?.id && concept.display_name && concept.owner)
            _cache[concept.url] = concept
          forEach(concept?.mappings, mapping => {
            if(mapping?.target_code?.id)
              _cache[mapping.target_code.url] = mapping.target_code
          })
        })
        if(!_rowStage[candidate.row.__index]?.recommend)
          _rowStage[candidate.row.__index] = {...(_rowStage[candidate.row.__index] || {}), recommend: isEmpty(response.data.analysis[candidate.row.__index]) ? -1 : 1}
        if(!get(_rowStage[candidate.row.__index]?.recommend))
          _rowStage[candidate.row.__index] = {...(_rowStage[candidate.row.__index] || {}), recommend: isEmpty(response.data.analysis[candidate.row.__index]) ? -1 : 1}
        let algo = candidate.algorithm || get(candidate.results, '0.search_meta.algorithm')
        if(algo) {
          _rowStage[candidate.row.__index] = {..._rowStage[candidate.row.__index], [algo]: 1}
          if(has(_allCandidates, algo)) {
            let _index = findIndex(_allCandidates[algo], c => c.row.__index === candidate.row.__index)
            if(_index > -1) {
              _allCandidates[algo][_index].results = [...(_allCandidates[algo][_index].results || []), ...(candidate.results || [])]
              _allCandidates[algo][_index].filter = {...(_allCandidates[algo][_index].filter || {}), ...(candidate.filter || {})}
              _allCandidates[algo][_index].map_config = [...(_allCandidates[algo][_index].map_config || []), ...(candidate.map_config || [])]
            } else {
              _allCandidates[algo] = [...(_allCandidates[algo] || []), candidate]
            }
          }
          else {
            _allCandidates[algo] = [candidate]
          }
        }
      })
      setConceptCache(_cache)
      setAllCandidates(_allCandidates)
      setAlgosSelected(response.data.algorithms)
      setRowStage(_rowStage)

      // Backfill rowMatchState + conceptCache (keyed by concept_key) from
      // the legacy `_allCandidates` we just hydrated. Required so that
      // reloaded projects render correctly under UNIFIED_MODEL_ENABLED=true.
      // PR3's normalizeLegacy.js will subsume this when schema-v2 load
      // arrives. See plans/unified-mapper-model.md "Migration / Save-Load".
      const loadedRelativeURL = dropVersion(response.data?.target_repo_url || '') || response.data?.target_repo_url
      const loadedTargetCanonical = response.data?.target_repo?.canonical_url ||
        (loadedRelativeURL ? `https://ns.openconceptlab.org${loadedRelativeURL}` : null)
      const loadedAlgos = response.data?.algorithms || []
      const loadedBridge = find(loadedAlgos, a => ['ocl-bridge', 'ocl-ciel-bridge'].includes(a.type))
      const loadProjectContext = loadedTargetCanonical ? {
        namespace: response.data?.namespace || response.data?.owner_url || '',
        target_repo: {
          relative_url: loadedRelativeURL,
          canonical_url: loadedTargetCanonical,
          canonical_url_source: response.data?.target_repo?.canonical_url ? 'repo' : 'derived',
          version: URIToParentParams(response.data?.target_repo_url, true)?.repoVersion || undefined
        },
        ...(loadedBridge?.target_repo_url ? {
          bridge_repo: {
            relative_url: loadedBridge.target_repo_url,
            canonical_url: loadedBridge?.bridge_repo?.canonical_url || `https://ns.openconceptlab.org${loadedBridge.target_repo_url}`,
            canonical_url_source: loadedBridge?.bridge_repo?.canonical_url ? 'repo' : 'derived'
          }
        } : {})
      } : null

      if(loadProjectContext) {
        // Enrich loadedAlgos with concept_identity (built-ins, API-loaded
        // bridge/scispacy, custom). The normalizer reads algo.concept_identity
        // directly; algos that can't be enriched fall through unchanged and
        // the normalizer skips them.
        const enrichedAlgos = loadedAlgos.map(a => ensureConceptIdentity(a) || a)
        const { rowMatchState: loadedRowMatchState, conceptDefinitionsByKey: loadedDefsByKey } =
          normalizeLegacyAllCandidates(_allCandidates, loadProjectContext, enrichedAlgos, CONCEPT_IDENTITY_BY_TYPE)
        rowMatchStateRef.current = loadedRowMatchState
        setRowMatchState(loadedRowMatchState)
        if(loadedDefsByKey.size > 0) {
          const next = { ..._cache }
          loadedDefsByKey.forEach((def, key) => {
            const existing = next[key]
            if(!existing || lookupStatusRank(def.lookup_status) > lookupStatusRank(existing.lookup_status))
              next[key] = def
          })
          conceptCacheRef.current = next
          setConceptCache(next)
        } else {
          conceptCacheRef.current = _cache
        }
      } else {
        conceptCacheRef.current = _cache
        // No target canonical means the saved project is missing the
        // load-bearing target_repo configuration. Under UNIFIED_MODEL_ENABLED
        // the read path needs this canonical to resolve candidates, so the
        // candidate list will be empty until the user fixes it. Block-and-
        // banner: surface an error alert and pop the configuration drawer
        // open. Only warn when there's actually saved match data — a
        // brand-new project loading with empty allCandidates is normal.
        if(!isEmpty(_allCandidates)) {
          setAlert({
            message: t(
              'map_project.target_repo_required_on_load',
              'This project is missing a target repository. Configure the target repository to see saved candidates.'
            ),
            severity: 'error',
            duration: 10
          })
          setConfigure(true)
        }
      }

      setName(response.data?.name || '')
      setDescription(response.data?.description || '')
      setOwner(response.data?.owner_url)
      setRetired(Boolean(response.data?.include_retired))
      setCandidatesScore(response.data?.score_configuration)
      setLookupConfig(response.data?.lookup_config)
      setNamespace(response.data?.namespace || '')
      setEncoderModel(response.data?.encoder_model || DEFAULT_ENCODER_MODEL)
      setProjectPromptTemplateKey(response.data?.prompt_template_key || '')
      setPromptOutputLocale(response.data?.prompt_output_locale || null)
      // PR3-H: backend stores `input_locales` as a list; UI is single-select
      // for now, so we hydrate from the first element. Empty/missing on
      // older projects keeps the zero-regression "no filter" path active
      // until the user opens config and picks a language.
      setInputLocale((response.data?.input_locales || [])[0] || '')
      setUseLexicalVariants(Boolean(response.data?.use_lexical_variants))
      const rawAnalysis = response.data?.analysis || {}
      setAnalysis(Object.fromEntries(Object.entries(rawAnalysis).map(([k, v]) => [k, Array.isArray(v) ? v : [v]])))
      setProject(response.data)
      setConfigure(false)
    })
  }

  const isRepoDefaultFilterApplied = version => {
    const defaultFilter = version?.meta?.display?.default_filter || {};
    return !isEmpty(defaultFilter) && Object.keys(defaultFilter).every(key => has((project?.filters || {}), key));
  }

  const fetchMapTypes = () => APIService.orgs('OCL').sources('MapTypes').appendToUrl('concepts/lookup/').get().then(response => setAllMapTypes(response.data?.map(d => d.id)))

  // PR3-H: fetch the canonical locale catalog from /orgs/OCL/sources/Locales/.
  // ~486 concepts, each mapping a 3-letter ISO 639-3 id to a 2-letter BCP-47
  // `locale` and human-readable `display_name`. Concepts missing a `locale`
  // (e.g. macro-language groupings like "Creoles and pidgins") are filtered
  // out so the dropdown only offers usable filter values. The list is
  // sorted alphabetically by display name (English collation) to match the
  // convention used by browser/OS language pickers. On fetch failure the
  // state keeps the initial fallback list.
  const fetchOclLocales = () => APIService.orgs('OCL').sources('Locales').appendToUrl('concepts/').get(null, null, {limit: 500}).then(response => {
    const valid = (response?.data || []).filter(c => c?.locale && !c?.retired)
    if (valid.length === 0) return
    const sorted = valid.map(c => ({id: c.locale, name: c.display_name}))
      .sort((a, b) => a.name.localeCompare(b.name, 'en'))
    setOclLocales(sorted)
  })

  const alertUser = (e) => {
    e.preventDefault();
    e.returnValue = "";
  };

  const rowIndex = row?.__index

  const getColumns = row => {
    let _columns = []
    if(row) {
      _columns = map(row, (value, key) => {
        let width;
        if(['id', 'code'].includes(key.toLowerCase()))
          width = '60px'
        if(['changed by', 'creator'].includes(key.toLowerCase()))
          width = '75px'
        else if(['class', 'concept class', 'datatype'].includes(key.toLowerCase()))
          width = '100px'
        return {label: key, dataKey: key, width: width, original: key }
      })
    }
    return _columns
  }

  const getColumnsForTable = () => {
    let cols = []
    forEach(columns, (column, idx) => {
      const isValidColumn = isValidColumnValue(column.label)
      let headerClass = 'header-valid'
      if(!isValidColumn)
        headerClass = 'header-invalid'
      let widthParams = {}
      if(columns.length < 2)
        widthParams.flex = 1
      if (columnWidth[column.dataKey])
        widthParams.width = columnWidth[column.dataKey]
      else if(column.label.toLowerCase().includes('name') || column.label.toLowerCase().includes('description') || column.label.toLowerCase().includes('synonyms'))
        widthParams.width = 300
      else if(column.label.toLowerCase().includes('uuid') || column.label.toLowerCase().includes('external'))
        widthParams.width = 300
      else
        widthParams.width = 150
      cols.push({
        field: column.dataKey,
        headerName: column.label || column.original,
        headerClassName: headerClass,
        renderHeader: () => {
          if(isValidColumn) {
            const isFiltered = filterModel.items.some((item) => item.field === column.dataKey && item.value);
            return <div>
                     <div>
                       <span style={{ flexGrow: 1 }}>{column.original}</span>
                       {
                       isFiltered &&
                           <Tooltip title={t('map_project.clear_filter')}>
                             <IconButton
                               size="small"
                               onClick={(e) => {
                                 e.stopPropagation(); // prevent sorting on click
                                 const updatedItems = filterModel.items.filter((item) => item.field !== column.dataKey);
                                 setFilterModel({ ...filterModel, items: updatedItems });
                               }}
                             >
                               <ClearIcon fontSize="small" />
                             </IconButton>
                           </Tooltip>
                       }
                     </div>
                     <div><Chip color='warning' variant='outlined' size='small' label={column.label} sx={{fontSize: '12px', margin: '2px 0'}} /></div>
                   </div>
          }
        },
        renderCell: (params) => {
          if(parseInt(idx) === 0) {
            let val = has(params.row, column.dataKey + '__updated') ? params?.row[column.dataKey + '__updated'] : params.value
            const _state = VIEWS[getStateFromIndex(params.row.__index)]
            return <span style={{display: 'flex'}}>
                     <Tooltip title={_state.label}>
                       <Typography component='span' sx={{marginRight: '8px', color: _state.color + '.main'}}>
                         {_state.icon}
                       </Typography>
                     </Tooltip>
                     <span>{val}</span>
                   </span>
          }
        },
        valueGetter: (value, _row) => has(_row, column.dataKey + '__updated') ? _row[column.dataKey + '__updated'] : value,
        ...widthParams
      })
    })
    cols.push({
      field: '_targetCode_',
      headerName: t('map_project.target_code'),
      width: columnWidth['_targetCode_'] || 300,
      renderCell: params => {
        const targetConcept = getConcept(mapSelected[params.row.__index])
        if(targetConcept?.id) {
          return <Concept key={`${params.row.__index}-${targetConcept.id}`} sx={{padding: 0}} repoVersion={repoVersion} notClickable firstChild concept={targetConcept} noScore onCardClick={false} noSynonymPrefix asTarget />
        }
      }
    })
    return cols
  }

  const getTargetSourcesFromRows = (cols, _data) => {
    let sources = {};
    let __data = _data || data
    filter(cols, {label: 'Mapping: List'})?.forEach(col => {
      let values = map(__data, row => row[col.dataKey].split(',').map(source => get(source?.trim()?.split(':'), '0')))
      sources[col.dataKey] = uniq(compact(flatten(values)))
    })
    filter(cols, {label: 'Mapping: Code'})?.forEach(col => {
      sources[col.dataKey] = col.dataKey.toLowerCase().replace('_code', '')
    })
    return sources
  }

  const getMapConfigs = () => {
    let configs = []
    forEach(filter(columns, col => ['Mapping: Code', 'Mapping: List'].includes(col?.label)), col => {
      const isList = col.label === 'Mapping: List'
      let config = {
        type: isList ? 'mapping-list' : 'mapping-code',
        input_column: col.dataKey,
      }
      if(isList)
        config.target_urls = col.targetSource
      else
        config.target_source_url = get(values(col.targetSource), '0')
      if((isList && !isEmpty(config.target_urls)) || (!isList && config.target_source_url))
        configs.push(config)
    })
    return configs
  }

  const updateColumn = (position, newValue, key) => {
    let cols = {...columns}
    cols[position][key || 'label'] = newValue || ''
    setColumns(cols)
    if(key !== 'targetSource')
      setTargetSourcesFromRows(getTargetSourcesFromRows(cols))
  }

  const resetState = () => {
    facetsRequestsRef.current = {}
    latestFacetRequestRef.current = {}
    setRowStatuses({reviewed: [], readyForReview: [], unmapped: []})
    setDecisions({})
    setDecisionFilters([])
    setMatchedConcepts([])
    setAllCandidates({})
    setSearchedConcepts({})
    setFetchedFacets({})
    setRowFacetKeys({})
    setSearchResponse({})
    setNotes({})
    setMapTypes({})
    setProposed({})
    setMapSelected({})
    setStartMatchingAt(false)
    setEndMatchingAt(false)
    setBulkAIAnalysisStartedAt(false)
    setBulkAIAnalysisEndedAt(false)
    setBridgeCandidatesStartedAt(false)
    setBridgeCandidatesEndedAt(false)
    setScispacyCandidatesStartedAt(false)
    setScispacyCandidatesEndedAt(false)
    setSearchStr('')
    setRow(false)
    setLoadingMatches(false)
    setEdit([])
    setSelectedRowStatus('all')
    setDecisionTab('candidates')
    setSearchText('')
    setShowItem(false)
    setAutoMatchUnmappedOnly(true)
    setAlert(false)
    setSelectedCandidatesScoreBucket(false)
    setScoreBucketSortBy('desc')
    setRowStage({})
  }

  const handleFileUpload = event => {
    resetState()
    const file = event.target.files[0];
    setFile(file)
    if(!name)
      setName(file?.name || '')
    const reader = new FileReader();
    reader.onload = (e) => {
      const workbook = XLSX.read(e.target.result, { type: 'binary', raw: true, cellText: true, codepage: 65001 });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      setProjectFromData(XLSX.utils.sheet_to_json(sheet, { raw: false, defval: '' }))
    };
    reader.readAsBinaryString(file);
  };

  const setProjectFromData = (jsonData, projectData) => {
    let _data = []

    const reservedKeys = [
      '__Concept ID__', '__Concept URL__', '__Match Score__', '__Match Type__', '__Decision__', '__Note__', '__State__', '__Proposed__', '__Repo Version__', '__Repo ID__', '__Repo URL__', '__Map Type__',
      '__map_concept_id__',
      '__map_concept_name__',
      '__map_concept_url__',
      '__map_type__',
      '__map_score__',
      '__map_unified_score__',
      '__map_raw_score__',
      '__Match Type__',
      '__oclai_match_quality__',
      '__oclai_assessment__',
      '__oclai_confidence_score__',
      '__oclai_rec_concept_id__',
      '__oclai_rec_concept_name__',
      '__oclai_alt_concepts__',
      '__oclai_oos_suggestions__',
      '__oclai_rationale__',
      '__row_decision__',
      '__row_status__',
      '__row_map_status__',
      '__proposed__',
      '__map_repo_id__',
      '__map_repo_url__',
      '__match_type__',
      '__map_algorithm__'
    ]
    const optionalReservedKeys = ['__Concept Name__', '__map_concept_name__']
    let columns = keys(jsonData[0])
    let isResuming = params?.projectId || every(reservedKeys, key => columns.includes(key))
    let _decisions = {}
    let _mapSelected = {}
    let _notes = {}
    let _mapTypes = {}
    let _proposed = {}
    let _repo = null
    let _states = {...rowStatuses}
    const repoVersionURL = data['__Repo URL__'] || data['__map_repo_url__']
    const repoURL = dropVersion(repoVersionURL)
    const repoParams = URIToParentParams(repoVersionURL, true)
    const repoVersion = data['__Repo Version__'] || repoParams.repoVersion
    forEach(jsonData, (data, index) => {
      data.__index = index
      if(isResuming) {
        let repo = {
          id: data['__Repo ID__'] || data['__map_repo_id__'],
          version: repoVersion,
          url: repoURL,
          version_url: repoVersionURL
        }
        let concept = {
          id: data['__Concept ID__'] || data['__map_concept_id__'],
          display_name: data['__Concept Name__'] || data['__map_concept_name__'],
          url: data['__Concept URL__'] || data['__map_concept_url__'],
          search_meta: {
            search_normalized_score: data['__Match Score__'] || data['__map_score__'] || data['__map_unified_score__'],
            search_score: data['__map_raw_score__'],
            algorithm: data['__map_algorithm__']
          },
          repo: repo
        }
        if(concept?.id) {
          _mapSelected[index] = concept
          _repo = repo
        }
        let rowStateLabel = data['__State__'] || data['__row_status__'] || data['__row_map_status__']
        let state = keys(pickBy(VIEWS, info => info.label === rowStateLabel))[0]
        _states[state] = _states[state] || []
        _states[state].push(index)
        _decisions[index] = (data['__Decision__'] || data['__row_decision__']) === t('map_project.none') ? undefined : (data['__Decision__'] || data['__row_decision__'])
        _notes[index] = data['__Note__']
        _mapTypes[index] = data['__Map Type__'] || data['__map_type__']
        _proposed[index] = (data['__Proposed__'] || data['__proposed__']) ? JSON.parse(data['__Proposed__'] || data['__proposed__']) : undefined
        data = omit(data, [...reservedKeys, ...optionalReservedKeys])
      }
      _data.push(data)
    })
    if(isResuming) {
      setNotes(_notes)
      setMapTypes(_mapTypes)
      setDecisions(_decisions)
      setMapSelected(_mapSelected)
      setRowStatuses(_states)
      setProposed(_proposed)

      let repoURL = projectData?.target_repo_url || _repo?.url
      let repoVersion = projectData?.target_repo_url ? URIToParentParams(projectData?.target_repo_url, true)?.repoVersion || 'HEAD' : _repo?.version
      if(repoURL) {
        fetchRepo(repoURL, _repo)
        fetchVersions(repoURL, repoVersion)
      }
    }

    setData(_data);
    if(!isResuming)
      setRowStatuses(prev => {
        prev.unmapped = map(_data, '__index')
        return prev
      })

    let cols = getColumns(omit(_data[0], ['__index']))
    setColumns(cols)
  }

  const getReferencesForImport = (collection, scope, cascadeMethod, transformReferences) => {
    const approvedOnly = scope === 'approved'
    return map(mapSelected, (data, index) => {
      if(approvedOnly && !rowStatuses.reviewed.includes(parseInt(index)))
        return null
      let url = data?.url

      if(data?.repo?.version_url)
        url = data.repo.version_url + 'concepts/' + data.id + '/'
      else if(data?.repo?.url)
        url = data.repo.url + 'concepts/' + data.id + '/'
      const payload = {
        collection_url: collection.url,
        type: 'Reference',
        data: {expressions: [url]}
      }
      if(transformReferences)
        payload.__transform = 'extensional'
      if(['sourcemappings', 'sourcetoconcepts'].includes(cascadeMethod))
        payload.__cascade = cascadeMethod
      else if(cascadeMethod === 'OpenMRSCascade')
        payload.__cascade = {
          "method": "sourcetoconcepts",
          "cascade_levels": "*",
          "map_types": "Q-AND-A,CONCEPT-SET",
          "return_map_types": "*"
        }
      return payload
    })
  }

  const onImport = (collection, scope, cascadeMethod, transformReferences) => {
    setOpenImportToCollection(false)
    const references = compact(getReferencesForImport(collection, scope, cascadeMethod, transformReferences))
    if(references.length > 0) {
      const payload = {data: references}
      APIService.new().overrideURL('/importers/bulk-import/').post(payload).then(response => {
        if(response.status === 202) {
          setAlert({message: t('map_project.import_accepted'), duration: 5, severity: 'success'})
          const id = response.data.id
          if(['STARTED', 'PENDING', 'RECEIVED'].includes(response.data.state)) {
            response.data.interval = setInterval(() => updateImportStatus(id), 1000)
          }
          setImports([...imports, response.data])
          projectLog({
            action: 'saved_to_collection',
            extras: {collection_url: collection.url, id: collection.id, task_id: id}
          })
        } else {
          setAlert({message: t('map_project.import_failed'), duration: 2, severity: 'error'})
        }
      })
    }
  }

  const updateImportStatus = importId => {
    if(!importId)
      return
    APIService.new().overrideURL(`/importers/bulk-import/?task=${importId}`).get().then(response => {
      setImports(prev => {
        let index = findIndex(prev, {id: importId})
        let oldResponse = prev[index]
        if(oldResponse.interval && !['STARTED', 'PENDING', 'RECEIVED'].includes(response?.data?.state))
          clearInterval(oldResponse.interval)
        const updated = [...prev];
        updated[index] = {...response.data, interval: oldResponse.interval}
        return updated
      })
    })
  }

  const downloadImportReport = importId => {
    if(!importId)
      return
    APIService.new().overrideURL('/importers/bulk-import/').get(null, null, {task: importId, result: 'json'}).then(res => {
      if(get(res, 'data')) {
        downloadObject(JSON.stringify(res.data, undefined, 2), 'application/json', `${importId}.json`)
      }
    })
  }

  const onSave = () => {
    setIsSaving(true)
    const f = getFileObjectFromRows()
    const selected = map(mapSelected, (data, i) => {
      return {
        url: data?.url,
        repoURL: data?.repo?.version_url || data?.repo?.url,
        mapType: mapTypes[i],
        state: VIEWS[getStateFromIndex(parseInt(i))].label,
        decision: decisions[i] || 'None',
        note: notes[i] || undefined,
        proposed: isEmpty(proposed[i]) ? undefined : JSON.stringify(proposed[i]),
        rowIndex: i,
        concept: getConcept(data)
      }
    })
    let _getCandidates = (_candidates, returnAll) => {
      let __candidates = []
      forEach(_candidates, ___candidates => {
        let __results = ___candidates.results || []
        let results = returnAll ? __results : __results.slice(0, CANDIDATES_LIMIT)
        results = map(results, result => {
          const concept = omit(getConcept(result), '_source')
          const mappings = map((result?.mappings || []), m => omit(m, 'target_concept'))
          return { ...concept, mappings }
        })
        __candidates.push({...___candidates, results: results})
      })
      return __candidates
    }
    const candidates = flatten(map(allCandidates, (_candidates, _algo) => {
      let results = _getCandidates(_candidates, _algo.includes('scispacy'))
      return results.map(result => ({...result, algorithm: _algo}))
    }))
    const formData = new FormData();
    formData.append('file', f);
    formData.append('candidates', JSON.stringify(candidates))
    formData.append('analysis', JSON.stringify(analysis))
    formData.append('matches', JSON.stringify(selected))
    formData.append('name', name || f.name)
    formData.append('description', description)
    formData.append('columns', JSON.stringify(map(columns, col => ({...col, hidden: columnVisibilityModel[col.dataKey] === false, width: columnWidth[col.dataKey] || undefined, ai_assistant_hidden: AIAssistantColumns[col.dataKey] === false}))))
    if(repoVersion?.version_url)
      formData.append('target_repo_url', repoVersion.version_url)
    // Persist the live target_repo canonical so reload doesn't need to wait
    // for fetchRepo. Without this the load path falls back to a derived
    // canonical (https://ns.openconceptlab.org/...) that doesn't match the
    // real repo canonical (e.g. http://loinc.org), causing the Quality-view
    // filter on conceptDefinition.reference.url to reject all candidates.
    if(repo?.canonical_url)
      formData.append('target_repo', JSON.stringify({
        canonical_url: repo.canonical_url,
        owner: repo.owner,
        owner_type: repo.owner_type,
        source: repo.short_code || repo.id,
        source_version: repoVersion?.id || repo.version || repo.id
      }))
    formData.append('algorithms', JSON.stringify(map(algosSelected, algo => omit(algo, ['__key']))))
    formData.append('score_configuration', JSON.stringify(candidatesScore))
    formData.append('lookup_config', JSON.stringify(lookupConfig))
    // Always send `namespace` (including empty string) so clearing the field
    // in the UI actually propagates to the server. The server reads empty
    // as "use the project owner default"; gating the append on truthiness
    // silently dropped the clear and kept the stale value in storage.
    formData.append('namespace', namespace || '')
    formData.append('encoder_model', encoderModel || DEFAULT_ENCODER_MODEL)
    formData.append('include_retired', retired)
    formData.append('filters', JSON.stringify(getFilters()))
    formData.append('prompt_template_key', getProjectPromptTemplateKey())
    formData.append('prompt_output_locale', promptOutputLocale || '')
    // PR3-H: backend field is plural (ArrayField) — single-select UI wraps
    // the value in a one-element list. Future multi-select can send N
    // elements without any backend change.
    if(inputLocale)
      formData.append('input_locales', JSON.stringify([inputLocale]))
    formData.append('use_lexical_variants', useLexicalVariants)
    const isUpdate = Boolean(project?.id)
    let service = APIService.new().overrideURL(owner).appendToUrl('map-projects/')
    if(isUpdate)
      service = service.appendToUrl(project.id + '/').put(formData, null, {"Content-Type": "multipart/form-data"})
    else
      service = service.post(formData, null, {"Content-Type": "multipart/form-data"})

    service.then(response => {
      setIsSaving(false)
      if(response?.data?.id) {
        projectLog({action: isUpdate ? 'Updated' : 'Created', extras: isUpdate ? undefined : {project: response.data}})
        setConfigure(false)
        setProjectPromptTemplateKey(response.data?.prompt_template_key || getProjectPromptTemplateKey())
        setProject(response.data)
        if(response.data.url)
          history.push(response.data.url)
        baseSetAlert({severity: 'success', message: t('map_project.successfully_saved'), duration: 2000})

        APIService.new().overrideURL(response.data.url).appendToUrl('logs/').post({logs: {row_logs: logs, project_logs: projectLogs}}).then(() => {})
      }
    })
  }

  const log = (data, index) => {
    let idx = index === undefined ? rowIndex : index
    setLogs(prev => ({...prev, [idx]: [{created_at: moment().toDate(), user: user.username || user.id, ...data}, ...(prev[idx] || [])]}))
  }

  const projectLog = data => {
    const newLog = {...data, created_at: moment().toDate(), user: user.username || user.id}
    const newLogs = [newLog, ...projectLogs]
    setProjectLogs(prev => [newLog, ...prev])
    if(project?.url)
      APIService.new().overrideURL(project.url).appendToUrl('logs/').post({logs: {row_logs: logs, project_logs: newLogs}}).then(() => {})
  }

  const fetchRepo = (url, _repo) => APIService.new().overrideURL(url).get().then(response => setRepo(response.data?.id ? response.data : _repo))

  const fetchMappedSources = (url, setter) => {
    let limit = 25

    const recurse = (offset, page, fetchedSoFar, accumulated) => {
      _fetchMappedSources(url, limit, offset, page, response => {
        const data = response?.data || []
        const updated = [...accumulated, ...data]

        setter(updated)

        const fetched = fetchedSoFar + data.length
        const numFound = parseInt(response?.headers?.num_found || 0)

        if (fetched < numFound) {
          recurse(offset + limit, page + 1, fetched, updated)
        }
      })
    }

    recurse(0, 1, 0, [])
  }

  const fetchLocaleDistribution = url => {
    if(!url)
      return
    setIsLoadingLocales(true)
    APIService.new().overrideURL(url).appendToUrl('summary/').get(null, null, {verbose: true, distribution: 'name_locale_list'}).then(response => {
      setLocales(response?.data?.distribution?.name_locale_list || [])
      setIsLoadingLocales(false)
    })
  }

  const _fetchMappedSources = (
    url, limit, offset, page, callback
  ) => {
    APIService.new().overrideURL(url).appendToUrl('mapped-sources/').get(null, null, {excludeSelf: false, brief: true, limit: limit || 25, offset: offset || 0, page: page || 1}).then(callback)
  }

  const onRepoVersionChange = version => {
    setRepoVersion(version)
    if(version?.version_url) {
      fetchLocaleDistribution(version.version_url)
      fetchMappedSources(version.version_url, setMappedSources)
      updateAlgosByRepoVersion(version)
    }
  }

  const updateAlgosByRepoVersion = version => {
    const isLLMAlgoAllowed = version?.match_algorithms?.includes('llm')
    const index = algos.findIndex(algo => algo.type === 'ocl-semantic')
    if(index > -1) {
      if(find(algosSelected, {type: 'ocl-semantic'}) && !isLLMAlgoAllowed) {
        setAlgosSelected(reject(algosSelected, {type: 'ocl-semantic'}))
      }
    }
  }

  const getFilters = () => {
    let defaultFilters = (repoVersion?.meta?.display?.default_filter || {})
    let allFilters = {...defaultFilters, ...omitBy(filters, value => !value)}
    return includeDefaultFilter ? allFilters : omit(allFilters, Object.keys(defaultFilters))
  }

  const getPayloadForMatching = (rows, _repo, _filters) => {
    return {
      rows: map(rows, row => prepareRow(row)),
      target_repo_url: repoVersion?.version_url || _repo.version_url || _repo.url,
      target_repo: {
        'owner': _repo.owner,
        'owner_type': _repo.owner_type,
        'source_version': repoVersion?.id || _repo.version || _repo.id,
        'source': _repo.short_code || _repo.id
      },
      map_config: getMapConfigs(),
      filter: rows.length > 1 ? getFilters() : getFacetQueryParam(isEmpty(_filters) ? appliedFacets[rows[0].__index] : _filters),
      variants: useLexicalVariants
    }
  }

  const getMatchAPIService = (algo) => {
    let service;
    if(algo?.url && algo?.type === 'custom') {
      service = APIService.new()
      service.URL = algo.url
    } else {
      service = APIService.concepts().appendToUrl('$match/')
    }
    return service
  }

  // Pick the highest-scoring target-repo ConceptRow for a given rowIndex
  // from the unified-model state. Returns a RowView ({candidate,
  // conceptDefinition, conceptRow, bridgeConceptDefinition?}) or null.
  // The target canonical comes from buildProjectContext — the SAME source
  // the normalizer used to stamp ConceptDefinition.reference.url, so the
  // filter is guaranteed to agree with the data. Reading canonical from
  // the caller's `_repo` would risk the derived-vs-explicit mismatch the
  // unified-model spec exists to avoid.
  // (plans/unified-mapper-model.md — score-grouped view's bucketing rule.)
  const pickTopRowView = (rowIndex) => {
    const rowState = rowMatchStateRef.current[rowIndex]
    if(!rowState) return null
    const targetCanonical = buildProjectContext()?.target_repo?.canonical_url
    if(!targetCanonical) return null
    const views = buildQualityRowViews(rowState, conceptCacheRef.current)
    // Auto-match must land on a target-repo concept. Bridge intermediaries
    // are excluded — even if their rerank_score is high, they're not
    // mappable. Score view already places bridge_child rows under the
    // target concept's ConceptRow, so filtering by canonical_url here is
    // the right invariant.
    const eligible = views.filter(v => v.conceptDefinition?.reference?.url === targetCanonical)
    if(!eligible.length) return null
    return orderBy(eligible, [v => v.conceptRow?.rerank_score ?? -1], ['desc'])[0]
  }

  const setStateViews = (data, _repo) => {
    setRowStatuses(prev => {
      forEach(data, concept => {
        const rowIdx = concept?.row?.__index
        if(!isNumber(rowIdx)) return
        const top = pickTopRowView(rowIdx)
        const topScore = top?.conceptRow?.rerank_score
        if(isNumber(topScore) && topScore >= candidatesScore.recommended) {
          const _concept = {...conceptForMapping(top), repo: {..._repo, version: repoVersion?.id || _repo.version, version_url: repoVersion?.version_url || _repo.version_url}}
          setMapSelected(_prev => {
            _prev[rowIdx] = _concept
            return _prev
          })
          const mapType = top.candidate?.map_type || 'SAME-AS'
          prev.readyForReview = uniq([...prev.readyForReview, rowIdx])
          setDecisions(p => ({...p, [rowIdx]: 'map'}))
          setMapTypes(p => ({...p, [rowIdx]: mapType}))
          log({action: 'auto-matched', extras: {repoVersion: repoVersion?.version_url || _repo.version_url, name: getConceptLabel(_concept), map_type: mapType}}, rowIdx)
        } else {
          prev.unmapped = uniq([...prev.unmapped, rowIdx])
        }
      })
      return prev
    })
  }

  const setAutoMatched = (indexes) => {
    forEach(indexes, index => {
      const top = pickTopRowView(index)
      const topScore = top?.conceptRow?.rerank_score
      if(isNumber(topScore) && topScore >= candidatesScore.recommended) {
        setRowStatuses(prev => {
          let newStatuses = {...prev}
          const _concept = {...conceptForMapping(top), repo: {...repo, version: repoVersion?.id || repo.version, version_url: repoVersion?.version_url || repo.version_url}}
          setMapSelected(_prev => {
            _prev[index] = _concept
            return _prev
          })
          const mapType = top.candidate?.map_type || 'SAME-AS'
          newStatuses.readyForReview = uniq([...newStatuses.readyForReview, index])
          setDecisions(_prev => ({..._prev, [index]: 'map'}))
          setMapTypes(_prev => ({..._prev, [index]: mapType}))
          log({action: 'auto-matched', extras: {repoVersion: repoVersion?.version_url || repo.version_url, name: getConceptLabel(_concept), map_type: mapType, algorithm: top.candidate?.algorithm_id}}, index)
          newStatuses.unmapped = without(newStatuses.unmapped, index)
          return newStatuses
        })
      } else {
        setMapSelected(prev => omit(prev, index))
        setDecisions(prev => omit(prev, index))
        setMapTypes(prev => omit(prev, index))
        setRowStatuses(prev => ({...prev, unmapped: uniq([...prev.unmapped, index])}))
      }
    })
  }


  const getRowsResults = async (rows, selectedAlgos) => {
    abortRef.current = false;

    // Function to process a single batch
    const processBatch = async (_repo, rowBatch, algo) => {
      if (abortRef.current) {
        setLoadingMatches(false)
        return []
      };

      const payload = getPayloadForMatching(rowBatch, _repo)
      payload.rows = filter(payload.rows, row => values(omit(row, '__index')).length > 0)
      if(!payload.rows.length) {
        setAlert({message: t('map_project.no_valid_columns_for_matching')})
        setTimeout(() => setAlert(false), 6000)
        return []
      }

      let extraParams = {
        limit: CANDIDATES_LIMIT,
        verbose: true,
        includeMappings: true,
        mappingBrief: true,
        mapTypes: 'SAME-AS,SAME AS,SAME_AS',
        reranker: !isMultiAlgo,
        ...(encoderModel ? { encoder_model: encoderModel } : {})
      }

      forEach(rowBatch, __row => markAlgo(__row.__index, algo.id, 0))

      try {
        const service = getMatchAPIService(algo)
        const response = await service.post(
          payload,
          (algo.type === 'custom' && algo.url && algo.token) ? algo.token : null,
          null,
          {
            includeSearchMeta: true,
            ...(algo.query_params || {}),
            ...extraParams
          }
        );
        forEach(rowBatch, __row => {
          markAlgo(__row.__index, algo.id, 1)
          log({action: 'algo_finished', extras: {algo: algo.id}}, __row.__index)
        })
        return response.data || [];
      } catch {
        forEach(rowBatch, __row => {
          markAlgo(__row.__index, algo.id, -2)
          log({action: 'algo_failed', extras: {algo: algo.id}}, __row.__index)
        })
        return [];
      }
    };

    // Function to handle concurrency
    const processWithConcurrency = async (_repo, algo, _rows) => {
      const CHUNK_SIZE = algo.batch_size || 10 // Number of rows per batch
      const MAX_CONCURRENT_REQUESTS = algo.concurrent_requests || 1; // Number of parallel API requests allowed
      const rowChunks = chunk(_rows, CHUNK_SIZE);

      const queue = rowChunks.slice(); // Copy of all chunks to be processed
      const activeRequests = new Set();

      while (queue.length > 0 || activeRequests.size > 0) {
        // Fill activeRequests up to MAX_CONCURRENT_REQUESTS
        while (queue.length > 0 && activeRequests.size < MAX_CONCURRENT_REQUESTS) {
          if (abortRef.current) {
            setLoadingMatches(false)
            return
          };
          const rowBatch = queue.shift();
          const promise = processBatch(_repo, rowBatch, algo).then((data) => {
            // Under the unified model, populate rowMatchState before any
            // consumer (setStateViews / setAutoMatched) tries to read it.
            // The per-row fetch flow routes through `onResponse` which
            // already calls mergeIntoRowMatchState; bulk processBatch
            // doesn't, so we run the normalizer here.
            if(UNIFIED_MODEL_ENABLED && Array.isArray(data) && data.length) {
              const projectCtx = buildProjectContext()
              if(projectCtx) {
                const algoCfg = ensureConceptIdentity(algo)
                if(algoCfg) {
                  data.forEach(rowEntry => {
                    const idx = rowEntry?.row?.__index
                    if(!isNumber(idx)) return
                    mergeIntoRowMatchState(idx, normalizeAlgorithmInvocation(rowEntry, {
                      algorithmId: algo.id,
                      algorithmConfig: algoCfg,
                      projectContext: projectCtx,
                      rowIndex: idx,
                      // Bulk auto-match's $match request sends reranker=!isMultiAlgo
                      // (line 1433). Trust the server's normalized score only when
                      // that flag was true — otherwise it's a per-algo native score
                      // (e.g. FAISS similarity × 100) masquerading as a rerank.
                      trustServerRerank: !isMultiAlgo
                    }))
                  })
                }
              }
            }
            if(!isMultiAlgo)
              setStateViews(data, _repo)
            if(!data || !data.length) {
              setAllCandidates(prev => {
                const newCandidates = {...prev}
                forEach(rowBatch, row => {
                  let _index = findIndex(newCandidates[algo.id], c => c.row.__index === row.__index)
                  if(_index > -1)
                    newCandidates[algo.id][_index].results = []
                  else
                    newCandidates[algo.id] = [...(newCandidates[algo.id] || []), {row: prepareRow(row), results: []}]
                })
                return newCandidates
              })
            } else {
              forEach(data, concept => {
                setAllCandidates(prev => {
                  return {...prev, [algo.id]: [...reject(prev[algo.id], c => c.row.__index === concept.row.__index), concept]}
                })
              })
            }
            if(!UNIFIED_MODEL_ENABLED) lookupCandidates(algo.id, flatten(map(data, 'results')))
            setMatchedConcepts(prev => [...prev, ...data]);
            activeRequests.delete(promise); // Remove from active set after completion
          });
          activeRequests.add(promise);
        }

        // Wait for at least one request to complete before continuing
        await Promise.race(activeRequests);
      }
    };

    const processRerankWithConcurrency = async (_rows, maxConcurrent = 2) => {
      const queue = _rows.slice();
      const activeRequests = new Set();

      while (queue.length > 0 || activeRequests.size > 0) {
        while (queue.length > 0 && activeRequests.size < maxConcurrent) {
          if (abortRef.current) {
            setLoadingMatches(false)
            return
          }

          const row = queue.shift();
          const promise = rerank(row.__index, true)
            .catch(() => null)
            .finally(() => activeRequests.delete(promise));
          activeRequests.add(promise);
        }

        if(activeRequests.size > 0)
          await Promise.race(activeRequests);
      }
    };
    let _selectedAlgos = filter(algosSelected, algo => selectedAlgos.includes(algo.id))
    let subActions = [...map(_selectedAlgos, algo => algo.name || algo.id)]
    subActions.push('reranker')
    if(autoMatchUnmappedOnly)
      subActions.push('unmatched_only')
    if(inAIAssistantGroup && autoRunAIAnalysis)
      subActions.push('with_ai_analysis')

    projectLog({
      action: 'auto_match_started',
      extras: {
        sub_actions: subActions,
        ...(inAIAssistantGroup && autoRunAIAnalysis ? {
          ai_assistant: {
            model: getSelectedAIModel(),
            prompt_template: getPromptTemplateRef()
          }
        } : {})
      }
    })

    if(!autoMatchUnmappedOnly)
      setRowStatuses(prev => ({...prev, readyForReview: []}))

    setTimeout(async () => {
      const rowsToProcess = autoMatchUnmappedOnly
        ? filter(rows, row => rowStatuses.unmapped.includes(row.__index))
        : filter(rows, row => !rowStatuses.reviewed.includes(row.__index))

      bulkMatchAlgoIdsRef.current = map(_selectedAlgos, 'id')
      // Reset all algo stages to -1 for every row before starting so that
      // stages from a previous run don't make the "all algos done" check
      // pass prematurely when only the first algo has finished.
      setRowStage(prev => {
        const next = { ...prev }
        rowsToProcess.forEach(row => {
          const rowId = row.__index
          const rowState = { ...(next[rowId] || {}) }
          _selectedAlgos.forEach(algo => { rowState[algo.id] = -1 })
          next[rowId] = rowState
        })
        rowStageRef.current = next
        return next
      })
      isBulkMatchRunningRef.current = true
      try {
        for(const algo of _selectedAlgos) {
          if(abortRef.current) break
          if(['custom', 'ocl-search', 'ocl-semantic'].includes(algo.type))
            await processWithConcurrency(repo, algo, rowsToProcess)
          else if(['ocl-bridge', 'ocl-ciel-bridge'].includes(algo.type) && canBridge)
            await fetchBulkBridgeCandidates(rowsToProcess, algo)
          else if(algo.type === 'ocl-scispacy' && canScispacy)
            await fetchBulkScispacyCandidates(rowsToProcess, algo)
        }
      } finally {
        isBulkMatchRunningRef.current = false
        bulkMatchAlgoIdsRef.current = []
      }
      if(_selectedAlgos.length)
        await processRerankWithConcurrency(rowsToProcess, 2)
      if(inAIAssistantGroup && autoRunAIAnalysis) {
        await new Promise(resolve => setTimeout(resolve, 1000))
        await runBulkAIAnalysis(rowsToProcess)
      } else {
        setIsLoadingInDecisionView(false)
        setLoadingMatches(false)
        setEndMatchingAt(moment())
      }
      if(!abortRef.current)
        projectLog({
          action: 'auto_match_finished',
          extras: {
            sub_actions: subActions,
            ...(inAIAssistantGroup && autoRunAIAnalysis ? {
              ai_assistant: {
                model: getSelectedAIModel(),
                prompt_template: getPromptTemplateRef()
              }
            } : {})
          }
        })
    }, 1000)
  };

  React.useEffect(() => {
    allCandidatesRef.current = allCandidates;
  }, [allCandidates]);

  React.useEffect(() => {
    conceptCacheRef.current = conceptCache;
  }, [conceptCache]);

  // Re-normalize legacy allCandidates when the target repo's real canonical
  // URL arrives. fetchAndSetProject runs synchronously and falls back to a
  // derived canonical (https://ns.openconceptlab.org{relurl}) because the
  // save format never persisted target_repo.canonical_url. Once fetchRepo
  // resolves and `repo.canonical_url` lands (e.g. 'http://loinc.org' for
  // LOINC), the ConceptDefinitions on rowMatchState are still stamped with
  // the derived URL — and Candidates.jsx's Quality view filters by
  // `view.conceptDefinition.reference.url === targetCanonical` (the live
  // value), so nothing matches and the panel renders empty. Re-running
  // normalizeLegacyAllCandidates with the live projectContext re-stamps the
  // references to match.
  const lastNormalizedCanonicalRef = React.useRef(null)
  React.useEffect(() => {
    const ctx = buildProjectContext()
    const liveCanonical = ctx?.target_repo?.canonical_url
    if(!liveCanonical) return
    if(lastNormalizedCanonicalRef.current === liveCanonical) return
    const allCands = allCandidatesRef.current
    if(!allCands || isEmpty(allCands)) {
      // No legacy data yet — record the canonical and exit. The initial
      // load path will normalize once data arrives.
      lastNormalizedCanonicalRef.current = liveCanonical
      return
    }
    const enrichedAlgos = (algosSelected || []).map(a => ensureConceptIdentity(a) || a)
    const { rowMatchState: newRowMatchState, conceptDefinitionsByKey: newDefsByKey } =
      normalizeLegacyAllCandidates(allCands, ctx, enrichedAlgos, CONCEPT_IDENTITY_BY_TYPE)
    rowMatchStateRef.current = newRowMatchState
    setRowMatchState(newRowMatchState)
    if(newDefsByKey.size > 0) {
      const next = { ...conceptCacheRef.current }
      newDefsByKey.forEach((def, key) => {
        const existing = next[key]
        if(!existing || lookupStatusRank(def.lookup_status) > lookupStatusRank(existing.lookup_status))
          next[key] = def
      })
      conceptCacheRef.current = next
      setConceptCache(next)
    }
    lastNormalizedCanonicalRef.current = liveCanonical
  }, [buildProjectContext, algosSelected])

  const runBulkAIAnalysis = async (_rows) => {
    setLoadingMatches(true)
    setBulkAIAnalysisStartedAt(moment())
    let resolvedPromptTemplate
    try {
      resolvedPromptTemplate = await resolvePromptTemplateForInvocation()
    } catch (err) {
      const now = moment()
      setBulkAIAnalysisEndedAt(now)
      setEndMatchingAt(now)
      setLoadingMatches(false)
      setIsLoadingInDecisionView(false)
      setAlert({message: err?.message || t('unknown_error'), severity: 'error'})
      return
    }
    for (let index = 0; index < _rows.length; index++) {
      if (abortRef.current) break;

      await fetchRecommendation(_rows[index], resolvedPromptTemplate);
    }
    const now = moment()
    setBulkAIAnalysisEndedAt(now)
    setEndMatchingAt(now)
    setLoadingMatches(false)
    setIsLoadingInDecisionView(false)
  }

  const fetchBulkBridgeCandidates = async (_rows, algo) => {
    setLoadingMatches(true)
    setBridgeCandidatesStartedAt(moment())
    for (let index = 0; index < _rows.length; index++) {
      if (abortRef.current) {
        setLoadingMatches(false)
        break;
      };
      markAlgo(_rows[index].__index, algo.id, 0)

      await fetchBridgeCandidates(_rows[index], 0, undefined, undefined, undefined, false, true, ((response, payload) => {
        const index = payload.rows[0].__index
        const results = (isArray(response) ? response : response?.data)
        log({action: 'algo_finished', extras: {algo: algo.id}}, index)
        markAlgo(index, algo.id, 1)
        setAllCandidates(prev => ({
          ...prev,
          [algo.id]: [...reject(prev[algo.id], c => c.row.__index === index), ...(results || [])]
        }))
        if(!UNIFIED_MODEL_ENABLED) lookupCandidates(algo.id, results)
        if(UNIFIED_MODEL_ENABLED) {
          // Route the bridge invocation through the normalizer (the per-row
          // path goes via onResponse, but the bulk path lives here).
          const algoDef = getAlgoDef(algo.id)
          const rowPayload = find(results, r => r?.row?.__index === index)
          if(rowPayload && algoDef) {
            mergeIntoRowMatchState(index, normalizeAlgorithmInvocation(rowPayload, {
              algorithmId: algo.id,
              algorithmConfig: algoDef,
              projectContext: buildProjectContext(),
              rowIndex: index,
              rawResponse: response
            }))
          }
        }
      })); // wait for completion
      await new Promise(resolve => setTimeout(resolve, 200)); // 1s delay
    }
    const now = moment()
    setBridgeCandidatesEndedAt(now)
  }

  const fetchBulkScispacyCandidates = async (_rows, algo) => {
    setLoadingMatches(true)
    setScispacyCandidatesStartedAt(moment())
    for (let index = 0; index < _rows.length; index++) {
      if (abortRef.current) {
        setLoadingMatches(false)
        break;
      };

      markAlgo(_rows[index].__index, algo.id, 0)

      setLoadingMatches(true)
      await fetchScispacyCandidates(_rows[index], false, false, true, (response => {
        const _index = _rows[index].__index
        const results = [{row: _rows[index], results: fromScispacyResultsToConcepts(get(response.data, index) || [])}]
        log({action: 'algo_finished', extras: {algo: algo.id}}, _index)
        markAlgo(_index, algo.id, 1)
        setAllCandidates(prev => ({
          ...prev,
          [algo.id]: [...reject(prev[algo.id], c => c.row.__index === _index), ...(results || [])]
        }))
        if(!UNIFIED_MODEL_ENABLED) lookupCandidates(algo.id, results)
        if(UNIFIED_MODEL_ENABLED) {
          // Mirror the bulk-bridge wiring — the per-row scispacy path goes via
          // onResponse, but the bulk path lives here.
          const algoDef = getAlgoDef(algo.id)
          const rowPayload = results[0]
          if(rowPayload && algoDef) {
            mergeIntoRowMatchState(_index, normalizeAlgorithmInvocation(rowPayload, {
              algorithmId: algo.id,
              algorithmConfig: algoDef,
              projectContext: buildProjectContext(),
              rowIndex: _index,
              rawResponse: response
            }))
          }
        }
      })); // wait for completion
      await new Promise(resolve => setTimeout(resolve, 500)); // 1s delay
    }
    const now = moment()
    setScispacyCandidatesEndedAt(now)
  }

  const isRunningBulkAnalysis = bulkAIAnalysisEndedAt ? moment().isBetween(bulkAIAnalysisStartedAt, bulkAIAnalysisEndedAt) : Boolean(bulkAIAnalysisStartedAt)
  const isRunningBulkBridgeCandidates = bridgeCandidatesEndedAt ? moment().isBetween(bridgeCandidatesStartedAt, bridgeCandidatesEndedAt) : Boolean(bridgeCandidatesStartedAt)
  const isRunningBulkScispacyCandidates = scispacyCandidatesStartedAt ? moment().isBetween(scispacyCandidatesStartedAt, scispacyCandidatesEndedAt) : Boolean(scispacyCandidatesStartedAt)

  const fetchVersions = (url, _selectedVersion) => {
    APIService.new().overrideURL(dropVersion(url)).appendToUrl('versions/?verbose=true').get().then(response => {
      let _versions = response.data
      setVersions(_versions)
      if(_selectedVersion) {
        const _version = find(_versions, {id: _selectedVersion})
        onRepoVersionChange(_version)
      }
      else if(_versions?.length === 1)
        onRepoVersionChange(_versions[0])
      else {
        let releasedVersion = find(_versions, {released: true})
        if(releasedVersion)
          onRepoVersionChange(releasedVersion)
      }
    })
  }

  const onRepoChange = (newRepo) => {
    setRepo(newRepo)
    if(newRepo?.url) {
      fetchVersions(newRepo.url)
    } else {
      setVersions([])
      setRepoVersion(false)
      setMappedSources([])
    }
  }

  // Fetch the target repo's canonical_url when it isn't already present.
  // RepoSearchAutocomplete returns brief metadata that may omit it, and
  // saved-project loads may pre-date the canonical persistence in onSave.
  // Without this fetch, buildProjectContext falls back to a derived
  // ns.openconceptlab.org URL, the unified-model normalizer stamps every
  // ConceptDefinition.reference.url with the derived form, and any
  // fixed-canonical algorithm (scispacy → http://loinc.org) ends up with a
  // reference.url that doesn't match the live target canonical — so the
  // Quality view filter excludes the candidates even though they were
  // fetched successfully. Mirrors the bridge_repo canonical fetch in
  // MultiAlgoSelector.jsx (commit fdc60b8).
  const fetchedRepoCanonicalUrlRef = React.useRef(new Set())
  React.useEffect(() => {
    if(!repo?.url) return
    if(repo.canonical_url) return
    if(fetchedRepoCanonicalUrlRef.current.has(repo.url)) return
    fetchedRepoCanonicalUrlRef.current.add(repo.url)
    APIService.new()
      .overrideURL(repo.url)
      .get()
      .then(response => {
        const canonical = response?.data?.canonical_url
        if(canonical) setRepo(prev => prev?.url === repo.url ? {...prev, canonical_url: canonical} : prev)
      })
      .catch(() => {})
  }, [repo?.url, repo?.canonical_url])

  const prepareRow = (csvRow, additional=false, forRecommendation=false) => {
    let row = {}
    let metadata = {}
    forEach(csvRow,  (value, key) => {
      if((value === 0 || value) && !has(csvRow, key + '__updated')) {
        const column = find(columns, {original: key.replace('__updated', '')}) || find(columns, {dataKey: key.replace('__updated', '')})
        key = column?.label || key
        const dataKey = column?.dataKey || key
        if(!forRecommendation || AIAssistantColumns[dataKey] !== false) {
          if(columnVisibilityModel[dataKey] !== false && (dataKey === '__index' || isValidColumnValue(column?.label))) {
            let newValue = value
            let newKey = key === '__index' ? key : snakeCase(key.toLowerCase())
            let isList = key === '__index' ? false : newValue.includes('\n')
            if(['Mapping: Code', 'Mapping: List'].includes(column?.label))
              newKey = column.dataKey

            if(isList)
              newValue = newValue.split('\n')
            if(key.includes('__updated'))
              newKey = key.replace('__updated', '')
            if(newKey.includes('class'))
              newKey = 'concept_class'
            if(newKey.includes('datatype'))
              newKey = 'datatype'
            if(newKey === 'set_members')
              newKey = 'other_map_codes'
            if(newKey === 'same_as')
              newKey = 'same_as_map_codes'
            if(newKey.startsWith('property_'))
              newKey = newKey.replace('property_', 'properties__')
            if(isList)
              row[newKey] = [...(row[newKey] || []), ...newValue]
            else
              row[newKey] = newValue
          } else if(additional && !key?.startsWith('__')) {
            metadata[key] = value
          }
        }
      }
    })
    if(row.name) {
      row.synonyms = compact(flatten([row.synonyms]))
      if(!row.synonyms.includes(row.name))
        row.synonyms = [...row.synonyms, row.name]
      if(row.name.includes('%') && !row.properties__property && !row.properties__PROPERTY && repoVersion.url === '/orgs/Regenstrief/sources/LOINC/')
        row.properties__PROPERTY = 'NFr'
    }
    return additional ? {row: row, metadata: metadata} : row
  }

  const isAnyValidColumn = () => Boolean(find(columns, column => isValidColumnValue(column.label)))

  const isValidColumnValue = value => {
    if(!value)
      return false
    if(value.toLowerCase().includes('class'))
      return true
    if(find(headers, val => val.label.toLowerCase() === value.toLowerCase()))
      return true
    return false
  }

  const getValidColumns = () => filter(columns, column => isValidColumnValue(column.label))

  const onGetCandidates = event => {
    event.stopPropagation()
    event.preventDefault()
    setMatchDialog(true)
  }

  const onGetCandidatesSubmit = (event, selectedAlgos) => {
    event.stopPropagation()
    event.preventDefault()
    setAlert(false)
    if(isAnyValidColumn()){
      setStartMatchingAt(moment())
      setBulkAIAnalysisStartedAt(null)
      setBulkAIAnalysisEndedAt(null)
      setBridgeCandidatesStartedAt(null)
      setBridgeCandidatesEndedAt(null)
      setScispacyCandidatesStartedAt(null)
      setScispacyCandidatesEndedAt(null)
      setLoadingMatches(true)
      getRowsResults(data, selectedAlgos)
    } else {
      setAlert({message: t('map_project.no_valid_columns_for_matching')})
      setTimeout(() => setAlert(false), 10000)
    }
    setMatchDialog(false)
  }

  const [_now, set_Now] = React.useState(() => moment());

  React.useEffect(() => {
    if (!loadingMatches) return;

    const id = setInterval(() => set_Now(moment()), 1000);
    return () => clearInterval(id);
  }, [loadingMatches]);

  const getMatchingDuration = (start, end) => {
    if (!start) return "00:00";

    const effectiveEnd = end || moment();
    const diffMs = Math.max(effectiveEnd?.diff(start), 0);

    const d = moment.duration(diffMs);
    const totalSeconds = Math.floor(d.asSeconds());

    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  const getCandidatesButtonLabel = () => {
    const effectiveEnd = loadingMatches ? _now : endMatchingAt;
    const matchingDuration = getMatchingDuration(startMatchingAt, effectiveEnd);

    if (loadingMatches || matchedConcepts?.length) {
      return `${t("map_project.auto_match")} (${matchingDuration ?? "0.00 mins"})`;
    }
    return t("map_project.auto_match");
  }

  const getBulkBridgeCandidatesButtonLabel = () => {
    const effectiveEnd = loadingMatches ? _now : bridgeCandidatesEndedAt;
    const matchingDuration = getMatchingDuration(bridgeCandidatesStartedAt, effectiveEnd)
    if(loadingMatches || Object.keys(allCandidatesRef.current).some(k => k.includes('bridge') && allCandidatesRef.current[k]?.length))
      return `${t('map_project.bridge_candidates')} (${matchingDuration})`
    return t('map_project.bridge_candidates')
  }

  const getBulkScispacyCandidatesButtonLabel = () => {
    const effectiveEnd = loadingMatches ? _now : scispacyCandidatesEndedAt;
    const matchingDuration = getMatchingDuration(scispacyCandidatesStartedAt, effectiveEnd)
    if(loadingMatches || allCandidatesRef.current['ocl-scispacy-loinc']?.length)
      return `${t('map_project.scispacy_candidates')} (${matchingDuration})`
    return t('map_project.scispacy_candidates')
  }

  const getBulkAIAnalysisButtonLabel = () => {
    const effectiveEnd = loadingMatches ? _now : bulkAIAnalysisEndedAt;
    const matchingDuration = getMatchingDuration(bulkAIAnalysisStartedAt, effectiveEnd)
    if(loadingMatches || !isEmpty(analysis))
      return `${t('map_project.ai_analysis')} (${matchingDuration})`
    return t('map_project.ai_analysis')
  }

  const getRows = () => {
    let rows = data?.length ? [...data] : []
    if(selectedRowStatus !== 'all')
      rows = filter(rows, r => rowStatuses[selectedRowStatus].includes(r.__index))
    if(searchText)
      rows = filter(rows, row =>
        find(values(row), v =>
          v?.toString().toLowerCase().includes(searchText.trim().toLowerCase())
        )
      )
    if(decisionFilters?.length > 0) {
      const hasNone = decisionFilters.includes('none')
      let indexes = keys(pickBy(decisions, value => (hasNone && !value) || decisionFilters.includes(value)))
      rows = filter(rows, row => indexes.includes(row.__index.toString()))
    }
    if(selectedCandidatesScoreBucket) {
      let minScore = 0
      let maxScore = 100.1
      let noScore = false
      let rowIndexes = []
      if(selectedCandidatesScoreBucket === 'low_ranked' ) {
        minScore = -0.1
        maxScore = candidatesScore.available
        noScore = true
      }
      else if(selectedCandidatesScoreBucket === 'available') {
        minScore = candidatesScore.available
        maxScore = candidatesScore.recommended
      }
      else if(selectedCandidatesScoreBucket === 'recommended') {
        minScore = candidatesScore.recommended
      }
      if(minScore) {
        rowIndexes = Object.entries(mapSelected)
          .filter(([, v]) => {
            let score = parseFloat(v?.search_meta?.search_normalized_score || 0)
            return isNumber(score) ? score >= minScore && score < maxScore : noScore
          })
          .sort((a, b) => {
            let aScore = parseFloat(a[1].search_meta.search_normalized_score || 0)
            let bScore = parseFloat(b[1].search_meta.search_normalized_score || 0)
            if(noScore) {
              aScore = aScore || 0
              bScore = bScore || 0
            }

            return scoreBucketSortBy === 'asc' ? aScore - bScore : bScore - aScore
          })
          .map(([k]) => k);
      }
      if(rowIndexes?.length) {
        const orderMap = Object.fromEntries(rowIndexes.map((idx, pos) => [idx, pos]));
        rows = rows.filter(row => rowIndexes.includes(row.__index.toString()))
        rows = rows.sort(
          (a, b) => orderMap[a.__index] - orderMap[b.__index]
        );
      }

    }
    return rows
  }

  const lowRankedCount = filter(mapSelected, target => !target?.search_meta?.search_normalized_score || target?.search_meta?.search_normalized_score < candidatesScore.available)?.length
  const availableCount = filter(mapSelected, target => target?.search_meta?.search_normalized_score >= candidatesScore.available && target?.search_meta?.search_normalized_score < candidatesScore.recommended)?.length
  const recommendedCount = filter(mapSelected, target => target?.search_meta?.search_normalized_score >= candidatesScore.recommended)?.length

  const getStateFromIndex = index => {
    if(rowStatuses.reviewed.includes(index))
      return 'reviewed'
    if(rowStatuses.readyForReview.includes(index))
      return 'readyForReview'
    return 'unmapped'
  }

  const onDownloadClick = option => {
    let log = false
    if(option === 'csv') {
      const workbook = getWorkbook()
      XLSX.writeFile(workbook, `${name || t('map_project.matched')}.${moment().format('YYYYMMDDHHmmss')}.csv`, { compression: true });
      log = true
    } else if (option === 'candidates_metadata') {
      let projectData = {
        project: getProjectMetadata(),
        rows: map(rows, _row => {
          const _rowData = prepareRow(_row)
          return {
            row: _rowData,
            metadata: _rowData.metadata,
            candidates: getAllCandidatesForRow(_row.__index),
          }
        })
      }
      downloadObject(JSON.stringify(projectData, undefined, 2), 'application/json', `${name}.candidates_metadata.json`)
      log = true
    }
    if(log)
      projectLog({action: 'downloaded', extras: {option: option}})
  }

  const getFileObjectFromRows = name => {
    const workbook = getWorkbook()
    const wbout = XLSX.write(workbook, {
      bookType: 'csv',  // or 'xlsx' if needed
      type: 'array',    // get it as an ArrayBuffer
      compression: true
    });
    const blob = new Blob([wbout], { type: 'text/csv;charset=utf-8;' });
    return new File([blob], name || file.name, {type: 'text/csv'})
  }

  const getWorkbook = () => {
    const rowsForDownload = getRowsForDownload()
    const headers = getDownloadHeaders()
    const aoa = [
      headers,
      ...map(rowsForDownload, _row => map(headers, key => _row[key]))
    ]
    const worksheet = XLSX.utils.aoa_to_sheet(aoa);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, t('map_project.dates'));
    return workbook
  }

  const twoDigit = n => String(n).padStart(2, '0')

  const getDownloadHeaders = () => {
    const sourceHeaders = filter(Object.keys(get(data, '0', {})), key => {
      if(key === '__index')
        return false
      // Exclude prior export/system columns so they don't pollute leading source order.
      if(key.startsWith('__') && key.endsWith('__'))
        return false
      if(key.startsWith('__status_') || key.startsWith('__result_') || key.startsWith('__map_') || key.startsWith('__oclai_'))
        return false
      return true
    })
    const allStages = uniq(flatten(map(data, _row => keys(rowStageRef.current[_row.__index] || {}))))
    const retrievalStages = filter(allStages, stage => !['rerank', 'recommend'].includes(stage)).sort()
    const statusHeaders = [
      ...map(retrievalStages, stage => `__status_retrieval:${stage}__`),
      ...(allStages.includes('rerank') ? ['__status_rerank__'] : []),
      ...(allStages.includes('recommend') ? ['__status_recommend__'] : [])
    ]

    const candidateHeaders = []
    forEach(keys(allCandidatesRef.current).sort(), algoId => {
      let algoKey = algoId.replaceAll('-', '').replaceAll(' ', '').replaceAll('_', '').toLowerCase()
      forEach(times(CANDIDATES_LIMIT, i => i + 1), i => {
        candidateHeaders.push(`__result_${algoKey}_${twoDigit(i)}__`)
      })
    })

    return uniq([
      ...sourceHeaders,
      '__row_map_status__',
      '__row_decision__',
      ...statusHeaders,
      '__map_repo_url__',
      '__map_repo_id__',
      '__map_concept_id__',
      '__map_concept_name__',
      '__map_concept_url__',
      '__map_type__',
      '__map_unified_score__',
      '__map_raw_score__',
      '__map_algorithm__',
      '__oclai_assessment__',
      '__oclai_confidence_score__',
      '__oclai_rec_concept_id__',
      '__oclai_rec_concept_name__',
      '__oclai_alt_concepts__',
      '__oclai_oos_suggestions__',
      '__oclai_rationale__',
      ...candidateHeaders,
      '__proposed__'
    ])
  }

  const getRowCandidatesForDownload = index => {
    let candidates = {};
    // Build a code → rerank_score lookup from rowMatchState. Some algos
    // (scispacy) intentionally omit search_normalized_score from allCandidates
    // so the rerank pipeline can fill rerank_score — but that only updates
    // rowMatchState, not allCandidates. This fallback makes the CSV reflect
    // the same unified score the UI shows.
    const rowState = rowMatchStateRef.current[index]
    const rerankScoreByCode = new Map()
    if(rowState?.concept_rows) {
      forEach(values(rowState.concept_rows), cr => {
        if(typeof cr.rerank_score === 'number') {
          try {
            const { code } = parseConceptKey(cr.concept_key)
            rerankScoreByCode.set(code, cr.rerank_score)
          } catch { console.log('Unable to parse', cr?.concept_key) }
        }
      })
    }
    forEach(keys(allCandidatesRef.current).sort(), algoId => {
      const _candidates = allCandidatesRef.current[algoId]
      let algoKey = algoId.replaceAll('-', '').replaceAll(' ', '').replaceAll('_', '').toLowerCase()
      let __candidates = orderBy(find(_candidates, c => c.row?.__index === index)?.results || [], c => c?.search_meta?.search_normalized_score ?? rerankScoreByCode.get(c?.id) ?? -1, 'desc')
      __candidates = times(CANDIDATES_LIMIT, i => __candidates[i])
      forEach(__candidates, (candidate, i) => {
        if(candidate?.id) {
          const isBridge = algoId.includes('bridge')
          const unifiedScore = candidate?.search_meta?.search_normalized_score
            ?? rerankScoreByCode.get(candidate.id)
          candidates[`__result_${algoKey}_${twoDigit(i + 1)}__`] = candidate?.id ?
            (
              isBridge ?
                bridgeRef.current?.getCandidateLabelForDownload(candidate) :
                compact([`${candidate.id}:${candidate.display_name}`, `Unified Score: ${unifiedScore}`, `Raw Score: ${candidate?.search_meta?.search_score}`]).join('\n')
            ) :
            null
        }
      })

    })
    return candidates
  }

  const getRowsForDownload = () => {
    const headers = getDownloadHeaders()
    return map(data, row => {
      const index = row.__index
      const rowState = getStateFromIndex(index)
      const rowStateLabel = VIEWS[rowState].label
      let concept = mapSelected[index]
      let _repo = concept?.repo
      const rowAnalyses = get(analysis, index) || []
      const latestAnalysis = Array.isArray(rowAnalyses) ? rowAnalyses[rowAnalyses.length - 1] : rowAnalyses
      const aiRecommendation = latestAnalysis?.output || latestAnalysis
      const aiCandidate = get(aiRecommendation, 'primary_candidate')
      // v2 response: prefer concept_key (resolves via conceptCache for an
      // unambiguous match), then canonical_reference.code (the PR2a shim);
      // fall back to legacy concept_id/id when the v2 fields are absent.
      const aiCandidateID = resolveAICandidateID(aiCandidate, conceptCacheRef.current)
      const aiScore = compact([aiCandidate?.confidence_level, aiCandidate?.match_strength]).join(':')
      let  candidates = getRowCandidatesForDownload(index)
      const getOutOfScopeSuggestions = () => {
        let suggestions = get(aiRecommendation, 'out_of_scope_suggestions') || []
        return map(suggestions, sugg => {
          return [`Suggested: ${sugg.suggested_concept}`, `Rationale: ${sugg.rationale}`].join('\n')
        }).join('\n\n\n')
      }
      let rowAlgoStatuses = {}
      forEach(keys(rowStageRef.current[index] || {}).sort(), stage => {
        const status = rowStageRef.current[index][stage]
        let key = ['rerank', 'recommend'].includes(stage) ? `__status_${stage}__` : `__status_retrieval:${stage}__`
        rowAlgoStatuses[key] = ROW_STAGES[status.toString()]
      })
      let newRow = {
        ...row,
        '__row_map_status__': rowStateLabel,
        '__row_decision__': decisions[index] || 'None',
        ...rowAlgoStatuses,
        // __map_* columns describe the mapped concept; leave blank when
        // the row isn't mapped (concept is undefined) so the namespace is
        // internally consistent with __map_concept_id__ / __map_concept_name__.
        '__map_repo_url__': concept ? (_repo?.version_url || _repo?.url) : null,
        '__map_repo_id__': concept ? (_repo?.short_code || _repo?.id) : null,
        '__map_concept_id__': concept?.id,
        '__map_concept_name__': concept?.display_name,
        '__map_concept_url__': concept?.url,
        '__map_type__': mapTypes[index],
        '__map_unified_score__': concept?.search_meta?.search_normalized_score,
        '__map_raw_score__': concept?.search_meta?.search_score,
        '__map_algorithm__': concept?.search_meta?.algorithm,
        '__oclai_assessment__': get(aiRecommendation, 'recommendation') || null,
        '__oclai_confidence_score__': aiScore || null,
        '__oclai_rec_concept_id__': aiCandidateID || null,
        '__oclai_rec_concept_name__': get(aiCandidate, 'name') || null,
        '__oclai_alt_concepts__': compact(map(get(aiRecommendation, 'alternative_candidates', []), c => resolveAICandidateID(c, conceptCacheRef.current))).join('\n') || null,
        '__oclai_oos_suggestions__': getOutOfScopeSuggestions() || null,
        '__oclai_rationale__': get(aiRecommendation, 'rationale') || null,
        ...candidates,
        '__proposed__': isEmpty(proposed[index]) ? null : JSON.stringify(proposed[index]),
      }
      newRow = omitBy(newRow, (val, key) => key.startsWith('__') && key.endsWith('__') && (key.includes('_Top_') || key.startsWith('__candidates_') || ['__Concept ID__', '__Concept URL__', '__Match Score__', '__Match Type__', '__Decision__', '__Note__', '__State__', '__Proposed__', '__Repo Version__', '__Repo ID__', '__Repo URL__', '__Map Type__', '__Concept Name__', '__AI Recommendation__', '__AI Recommendation Candidate__', '__AI Recommendation Candidate Name__', '__AI Recommendation Score__', '__AI Recommendation Rationale__', '__AI Recommendation Alternative Candidates__', '__AI Recommendation Out Of Scope Suggestions__', '__row_status__', '__map_score__', '__oclai_match_quality__', '__match_type__'].includes(key)))
      delete newRow.__index
      const orderedRow = {}
      forEach(headers, key => {
        orderedRow[key] = has(newRow, key) ? newRow[key] : null
      })
      return orderedRow
    })
  }

  const onCSVRowSelect = csvRow => {
    if(edit?.length > 0)
      return

    const matched = get(find(matchedConcepts, concept => concept.row.__index === csvRow.__index), 'results.0') || mapSelected[csvRow.__index]
    let url = matched?.url
    if(url && !getKeyFromCache(url))
      APIService
      .new()
      .overrideURL(url)
      .get(null, null, {includeMappings: true, mappingBrief: true, mapTypes: 'SAME-AS,SAME AS,SAME_AS', verbose: true})
      .then(response => {
        const res = {...response?.data, search_meta: {...matched.search_meta}, repo: {...matched.repo}}
        setConceptCache({...conceptCache, [url]: res})
      })
    setConfigure(false)
    setShowProjectLogs(false)
    setRow(csvRow)
    setSearchStr(getRowNameValue(csvRow) || '')


    if(repo?.id) {
      const _filters = getFilters()
      if(!appliedFacets[csvRow.__index] && !isEmpty(_filters) && _filters) {
        setAppliedFacets({...appliedFacets, [csvRow.__index]: getAppliedFacetFromQueryParam(_filters)})
      }
      fetchAllCandidatesForRow(null, csvRow, 0, undefined, undefined, getAppliedFacetFromQueryParam(_filters))
      if(isEmpty(getFacetsForRow(csvRow.__index)))
        getFacets(true, csvRow.__index)

    }

    const el = document.querySelector(`div[data-id="${csvRow.__index}"]`)
    if(el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" })
    }
  }

  const onRefreshClick = () => {
    setAllCandidates(prev => {
      let newCandidates = {...prev}
      keys(newCandidates).forEach(algoId => {
        const newConcepts = newCandidates[algoId]
        let result = find(newConcepts, c => c.row.__index === rowIndex)
        if(result)
          result.results = null

        newCandidates[algoId] = newConcepts
      })
      return newCandidates
    })
    fetchAllCandidatesForRow(getFirstAlgoDef()?.id, row, 0, undefined, undefined, undefined, true)
  }

  const onCloseDecisions = () => {
    setRow(false)
    setShowHighlights(false)
    setSearchStr('')
  }

  const onMap = (event, concept, unmap=false, mapType='SAME-AS', closeConcept=false) => {
    event.preventDefault()
    event.stopPropagation()
    _onMap(concept, unmap, mapType)
    setRowStatuses(prev => {
      prev.reviewed = without(prev.reviewed, rowIndex)
      if(unmap) {
        prev.readyForReview = without(prev.readyForReview, rowIndex)
        prev.unmapped = uniq([...prev.unmapped, rowIndex])
      } else {
        prev.readyForReview = uniq([...prev.readyForReview, rowIndex])
        prev.unmapped = without(prev.unmapped, rowIndex)
        setMapTypes({...mapTypes, [rowIndex]: mapType})
        setTimeout(() => highlightTexts([concept], null, false), 100)
      }
      if(closeConcept)
        setShowItem(false)
      return prev
    })
    return false
  }

  const _onMap = (concept, unmap=false, mapType='SAME-AS') => {
    setMapSelected(prev => ({...prev, [rowIndex]: unmap ? null : {...concept, repo: {...repo, version: repoVersion?.id || repo.version, version_url: repoVersion?.version_url || repo.version_url}}}))
    setDecisions(prev => ({...prev, [rowIndex]: unmap ? null : 'map'}))
    // Always log (don't gate on concept?.url) — bridge cascade targets may
    // arrive without an ocl_url until $resolveReference resolves them,
    // and dropping the log silently hides the mapping action from the
    // project history. Fall back to concept.id when url is absent.
    if(concept?.url || concept?.id)
      log({action: unmap ? 'unmapped' : 'mapped', extras: {object_url: concept?.url || null, object_id: concept?.id || null, map_type: mapType, name: getConceptLabel(concept), algorithm: concept?.search_meta?.algorithm}})
  }

  const onReviewDone = (next = false) => {
    const newRowStatuses = {...rowStatuses, reviewed: uniq([...rowStatuses.reviewed, rowIndex]), readyForReview: without(rowStatuses.readyForReview, rowIndex), unmapped: without(rowStatuses.unmapped, rowIndex)}
    setRowStatuses(newRowStatuses)
    log({'action': 'approved'})
    if(next){
      const nextRow = data[selectedRowStatus === 'all' ? rowIndex + 1 : find(rowStatuses[selectedRowStatus], idx => idx > rowIndex)]
      if(nextRow !== undefined)
        setTimeout(() => onCSVRowSelect(nextRow), 300)
    }
  }

  const getConceptLabel = concept => `${concept?.repo?.short_code || repo?.short_code || repo?.id}:${concept.repo?.version || concept.repo?.id || repo?.version || repo?.id}:${concept.id} ${concept.display_name || ''}`

  const isSelectedForMap = (concept, index) => {
    const selected = mapSelected[index || rowIndex]
    return (
      (selected?.url === concept.url && selected?.url) ||
        (
          (selected?.id === concept.id && selected?.id) &&
            (
              selected.repo?.url === concept.repo?.url ||
                selected.search_meta?.algorithm === concept?.search_meta?.algorithm
            )
        )
    ) && (concept?.url || concept?.id)
  }

  const onStateTabChange = newValue => {
    setSelectedRowStatus(newValue)
    setDecisionFilters([])
  }

  const onDecisionTabChange = (event, newValue) => {
    setShowItem(false)
    setDecisionTab(newValue)
    if(newValue === 'candidates' && repo?.id) {
      // Two prior bugs in this guard:
      //   1. `firstAlgo` was getFirstAlgoDef()?.id (already a string), but the
      //      condition then did `allCandidatesRef.current[firstAlgo?.id]` —
      //      string?.id is undefined, so the cache lookup always missed and
      //      the refetch always fired even when candidates were cached.
      //   2. No in-flight guard. If the user clicked the row, switched to
      //      Discuss before semantic finished, and switched back, the chain
      //      re-fired concurrently with the still-running first chain →
      //      duplicate algo_finished logs + double rerank.
      const firstAlgoId = getFirstAlgoDef()?.id
      const rowStageForRow = rowStageRef.current?.[rowIndex] || {}
      const anyAlgoInFlight = selectedAlgoIds?.some(id => rowStageForRow[id] === 0)
      const hasCandidates = Boolean(
        find(allCandidatesRef.current[firstAlgoId], c => c.row.__index === rowIndex)
      )
      if(firstAlgoId && !anyAlgoInFlight && !hasCandidates)
        fetchAllCandidatesForRow(firstAlgoId)
    }
    if(['candidates', 'search'].includes(newValue) && isEmpty(getFacetsForRow(rowIndex)))
      getFacets(true)
  }

  const onDecisionChange = (event, newValue) => {
    let logged = false
    if(newValue === 'rejected') {
      let selected = mapSelected[rowIndex]
      selected = getConcept(selected) || selected
      if(selected?.id) {
        let conceptLabel = getConceptLabel(selected)
        let comment = `${t('map_project.rejected')} ${conceptLabel}`
        if(notes[rowIndex])
          comment = notes[rowIndex] + '\n' + comment
        setNotes({...notes, [rowIndex]: comment})
        log({action: newValue, description: comment, extras: {object_url: selected?.url, name: conceptLabel, mapType: mapTypes[rowIndex] || undefined}})
        logged = true
      } else {
        log({action: newValue})
        logged = true
      }
    }
    if(newValue !== 'map')
      _onMap(null, true)
    if(newValue != 'propose')
      setProposed(prev => ({...prev, [rowIndex]: undefined}))

    setDecisions(prev => ({...prev, [rowIndex]: newValue || undefined}))
    if(newValue === 'propose') {
      setAlert({message: t('map_project.proposed_successfully'), duration: 2, severity: 'success'})
      log({action: 'proposed'})
        logged = true
    }

    setRowStatuses(_prev => {
      let prev = {..._prev}
      prev.reviewed = without(prev.reviewed, rowIndex)
      if(newValue && newValue !== 'rejected') { // map or exclude or propose
        prev.readyForReview = uniq([...prev.readyForReview, rowIndex])
        prev.unmapped = without(prev.unmapped, rowIndex)
      } else {
        prev.readyForReview = without(prev.readyForReview, rowIndex)
        prev.unmapped = uniq([...prev.unmapped, rowIndex])
      }
      return prev
    })
    if(newValue !== 'map' && !logged)
      log({action: newValue || 'decision_changed', description: t('map_project.decision_changed_to_none'), extras: newValue ? {} : {decision: t('map_project.none')}})
  }

  const selectedAlgoIds = map(algosSelected, 'id')
  const ensureRow = (prev, rowId, selectedAlgoIds, needsRerank) => {
    const base = prev[rowId] ?? {};
    const next = { ...base };

    selectedAlgoIds.forEach(id => {
      if (!Number.isFinite(next[id])) next[id] = -1;
    });
    if (needsRerank && !has(next, 'rerank')) next.rerank = -1;
    if (!has(next, 'recommend')) next.recommend = -1;

    return next;
  };

  const markAlgo = (rowId, algoId, value) => {
    setRowStage(prev => {
      const needsRerank = isMultiAlgo || find(algosSelected, { type: "custom" }) || find(algosSelected, { type: "ocl-scispacy" });
      const row = ensureRow(prev, rowId, selectedAlgoIds, needsRerank);

      row[algoId] = value;

      return { ...prev, [rowId]: row };
    });
  };

  const getAlgoDef = algoId => {
    const algo = find(algosSelected, {id: algoId})
    if(!algo) return algo
    // Inject concept_identity for known algo types when missing (algorithms
    // sourced from the OCL Online API don't carry it) and for custom algos
    // (derived from user-entered canonical_url). When ensureConceptIdentity
    // can't produce one, return the raw algo so callers that don't need
    // concept_identity (e.g. fetching) still work; the normalizer path
    // performs its own null-guard.
    return ensureConceptIdentity(algo) || algo
  }
  const getNextAlgoDef = (algoId) => {
    const algoDef = getAlgoDef(algoId);
    if (!algoDef) return;

    const sorted = [...algosSelected].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const idx = sorted.findIndex(a => a.id === algoDef.id);

    return idx >= 0 ? sorted[idx + 1] : undefined;
  };

  const getFirstAlgoDef = () => getAlgoDef(get(orderBy(algosSelected, 'order')[0], 'id'))

  const fetchOCLOrCustomCandidates = (algoDef, _row, offset=0, _retired, _filters, callback) => {
    // can be algo=ocl-search | ocl-semantic | custom
    let __row = isEmpty(_row) ? row : _row
    const payload = getPayloadForMatching([__row], repo, _filters)

    if(!values(omit(payload.rows[0], '__index')).length){
      setAlert({message: t('map_project.no_valid_columns_for_matching')})
      setTimeout(() => setAlert(false), 6000)
      return
    }
    const service = getMatchAPIService(algoDef)
    service.post(
      payload,
      (algoDef.type === 'custom' && algoDef.url) ? algoDef.token : null,
      null,
      {
        includeSearchMeta: true,
        includeRetired: isBoolean(_retired) ? _retired : retired,
        includeMappings: true,
        mappingBrief: true,
        mapTypes: 'SAME-AS,SAME AS,SAME_AS',
        verbose: true,
        limit: algoDef.limit || CANDIDATES_LIMIT,
        offset: offset || 0,
        semantic: ['ocl-semantic', 'custom'].includes(algoDef.type),
        reranker: !isMultiAlgo && algoDef.provider === 'ocl',
        encoder_model: !isMultiAlgo && encoderModel ? encoderModel : undefined
      }).then(response => callback(response, payload))
  }

  const fetchAllCandidatesForRow = (algoId, _row, offset=0, _retired, scrollToBottom, _filters, forceReload=false) => {
    if(loadingMatches)
      return
    setAlert(false)
    if(isAnyValidColumn()) {
      let algoDef
      if (!algoId) {
        algoDef = getFirstAlgoDef()
        algoId = algoDef?.id
      } else
        algoDef = getAlgoDef(algoId)
      if(!algoId)
        return
      let __row = isEmpty(_row) ? row : _row

      const existingCandidates = find(allCandidatesRef.current[algoId], c => c.row.__index === __row.__index)
      // Reuse when the algo's invocation completed for this row, regardless
      // of whether it returned matches. Gating on results.length > 0 made
      // any algo that legitimately returned zero matches (e.g. scispacy on
      // a row with no in-vocabulary terms) look like it had never run —
      // fetchAllCandidatesForRow would then re-dispatch and the inner
      // fetcher (which DOES short-circuit on entry presence) would skip
      // silently without firing onResponse, leaving the "Running: …"
      // indicator pinned forever.
      const canReuseExistingCandidates = !forceReload &&
        offset === 0 &&
        !_retired &&
        existingCandidates !== undefined

      if(canReuseExistingCandidates) {
        markAlgo(__row.__index, algoId, 1)
        setTimeout(() => highlightTexts((existingCandidates?.results || []), null, false), 100)
        const nextAlgo = getNextAlgoDef(algoId)
        if(nextAlgo?.id && (offset === 0 || nextAlgo.type !== 'ocl-scispacy')) {
          markAlgo(__row.__index, nextAlgo.id, 0)
          fetchAllCandidatesForRow(nextAlgo.id, __row, offset, _retired, scrollToBottom, _filters, forceReload)
        } else {
          // Rerank is now debounce-driven from mergeIntoRowMatchState. If
          // any cached ConceptRow still lacks a rerank_score, scheduleRerank
          // picks it up; otherwise it's a no-op.
          markAlgo(__row.__index, 'rerank', 1)
          scheduleRerank(__row.__index)
        }
        return
      }
      markAlgo(__row.__index, algoId, 0)
      setIsLoadingInDecisionView(true)
      const onResponse = (response, payload) => {
        const projectContext = UNIFIED_MODEL_ENABLED ? buildProjectContext() : null
        if(response?.detail) {
          markAlgo(__row.__index, algoId, -2)
          log({action: 'algo_failed', extras: {algo: algoId}}, __row.__index)
          setAlert({message: response.detail, severity: 'error'})
          if(UNIFIED_MODEL_ENABLED) {
            mergeIntoRowMatchState(__row.__index, normalizeAlgorithmInvocation(null, {
              algorithmId: algoId,
              algorithmConfig: algoDef,
              projectContext,
              rowIndex: __row.__index,
              status: 'failed',
              error: response.detail,
              rawResponse: response
            }))
          }
          return
        }
        log({action: 'algo_finished', extras: {algo: algoId}}, __row.__index)
        let data = isArray(response) ? response : (response?.data || [])
        let nextCandidates
        if(offset === 0) {
          const results = algoId === 'ocl-scispacy-loinc' ? [{row: __row, results: fromScispacyResultsToConcepts(get(response.data, __row.__index) || [])}] : data
          nextCandidates = {...allCandidatesRef.current, [algoId]: [...reject(allCandidatesRef.current[algoId], c => c.row.__index === __row.__index), ...(results || [])]}
          if(!UNIFIED_MODEL_ENABLED) lookupCandidates(algoId, get(results, '0.results'))
          if(UNIFIED_MODEL_ENABLED) {
            // Normalize the invocation for this row and merge into the new
            // RowMatchState. Reads still come from allCandidates — flipping
            // reads is PR 2.
            const rowPayload = find(results, r => r?.row?.__index === __row.__index)
            if(rowPayload) {
              mergeIntoRowMatchState(__row.__index, normalizeAlgorithmInvocation(rowPayload, {
                algorithmId: algoId,
                algorithmConfig: algoDef,
                projectContext,
                rowIndex: __row.__index,
                rawResponse: response,
                // Mirrors the line 2452 reranker flag on the $match request.
                // Only trust when single-algo native OCL — same condition that
                // markAlgo('rerank', 1)s without firing a separate $rerank/.
                trustServerRerank: !isMultiAlgo && algoDef.provider === 'ocl'
              }))
            }
          }
        } else {
          const appendedResults = get(data, '0.results') || []
          const newMatches = [...(allCandidatesRef.current[algoId] || [])]
          const index = findIndex(newMatches, match => match.row.__index === __row.__index)
          newMatches[index].results = [...newMatches[index].results, ...appendedResults]
          lookupCandidates(algoId, appendedResults)
          nextCandidates = {...allCandidatesRef.current, [algoId]: newMatches}
          // Pagination append: feed just the new page's results into the
          // unified state with append=true so existing candidates from
          // previous pages stay put. Without this, Fetch More fires the
          // request but the unified read path (Candidates.jsx) never sees
          // the new results.
          if(UNIFIED_MODEL_ENABLED) {
            const appendPayload = {row: __row, results: appendedResults}
            mergeIntoRowMatchState(__row.__index, normalizeAlgorithmInvocation(appendPayload, {
              algorithmId: algoId,
              algorithmConfig: algoDef,
              projectContext,
              rowIndex: __row.__index,
              rawResponse: response,
              trustServerRerank: !isMultiAlgo && algoDef.provider === 'ocl'
            }), {append: true})
          }
        }
        allCandidatesRef.current = nextCandidates
        setAllCandidates(nextCandidates)
        markAlgo(__row.__index, algoId, 1)
        setIsLoadingInDecisionView(false)
        let items = get(response?.data, '0.results') || (isArray(get(response, '0.results')) ? response[0].results : [])
        if(items.length > 0){
          const synonyms = get(payload, 'rows.0.synonyms')
          setTimeout(() => highlightTexts(items, null, false, compact([get(payload, 'rows.0.name'), ...(isArray(synonyms) ? synonyms : [synonyms])])), 100)
        }
        const nextAlgo = getNextAlgoDef(algoId)
        if(nextAlgo?.id && (offset === 0 || nextAlgo.type !== 'ocl-scispacy')) {
          markAlgo(__row.__index, nextAlgo.id, 0)
          fetchAllCandidatesForRow(nextAlgo.id, __row, offset, _retired, scrollToBottom, _filters, forceReload)
        } else {
          const currentAlgo = algoId ? getAlgoDef(algoId) : null
          // Single-algo native path: $match's reranker:true returns scores
          // inline, so mergeIntoRowMatchState already wrote rerank_score on
          // the ConceptRows. Mark rerank done. Other paths: scheduleRerank
          // picks up pending ConceptRows via the debounced trigger.
          if(!isMultiAlgo && (currentAlgo?.provider === 'ocl' && !['ocl-bridge', 'ocl-ciel-bridge', 'ocl-scispacy'].includes(currentAlgo.type)))
            markAlgo(__row.__index, 'rerank', 1)
          else
            scheduleRerank(__row.__index)
        }
          if(scrollToBottom) {
            setTimeout(() => {
              const el = document.getElementById('candidates-list')
              if(el)
                el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
            }, 100)
          }
        }

      if(['ocl-semantic', 'ocl-search', 'custom'].includes(algoDef.type)) {
        fetchOCLOrCustomCandidates(algoDef, _row, offset, _retired, _filters, onResponse)
      } else if (algoDef.type === 'ocl-scispacy') {
        fetchScispacyCandidates(__row, scrollToBottom, forceReload, false, onResponse)
      } else if (['ocl-bridge', 'ocl-ciel-bridge'].includes(algoDef.type)) {
        fetchBridgeCandidates(__row, offset, _retired, scrollToBottom, _filters, forceReload, false, onResponse)
      }
    } else {
      setAlert({message: t('map_project.no_valid_columns_for_matching')})
      setTimeout(() => setAlert(false), 6000)
    }
  }

  const fetchScispacyCandidates = async (_row, scrollToBottom, forceReload=false, isBulk=false, callback) => {
    let __row = isEmpty(_row) ? row : _row
    // Gate on entry presence, not results.length: a successful invocation
    // that returned zero matches still writes {row, results:[]} into
    // allCandidates, and we shouldn't re-run on every tab visit just because
    // the array is empty. Failures don't write an entry (the catch below
    // markAlgo(-2)s without persisting), so undefined-entry correctly retries.
    const existingEntry = find(allCandidatesRef.current['ocl-scispacy-loinc'], c => c.row.__index === __row.__index)
    if(!isBulk && !forceReload && existingEntry !== undefined) {
      const existingCandidates = existingEntry.results
      if(existingCandidates?.length > 0)
        setTimeout(() => highlightTexts(existingCandidates, null, false), 100)
      return { skipped: true }
    }
    if(!scispacyEnabled)
      return { skipped: true }
    let inputRow = prepareRow(__row)
    if(!inputRow.name) {
      return { skipped: true }
    }
    setIsLoadingInDecisionView(true)

    const payload = {rows: [{label: inputRow.name, itemid: __row.__index}]}
    const service = APIService.new()
    service.URL = SCISPACY_API_URL
    service.appendToUrl('/$match-scispacy-loinc/')
    // Note: the previous shape had `setIsLoadingInDecisionView(false)` inside
    // a `finally` block that fired synchronously *before* the POST resolved
    // (the .then was detached, not awaited). Result: isLoading flipped back
    // to false immediately, the Candidates panel rendered "no candidates"
    // before any response arrived. Now the loading flag is cleared inside
    // the response handler instead, after the actual response (success OR
    // error) arrives. 5xx responses (the scispacy service taking 2-5 min
    // to wake up returns 503) no longer get written as `results: []` —
    // we mark the algo as failed without persisting the empty entry, so
    // the next row visit retries.
    const SCISPACY_WARMUP_RETRY_MS = 2 * 60 * 1000
    const SCISPACY_WARMUP_MAX_MS = 10 * 60 * 1000
    const warmupStart = Date.now()
    let warmingUp = true
    let seenWarmingUp = false

    while(warmingUp) {
      if(abortRef.current) { setIsLoadingInDecisionView(false); return }
      try {
        const response = await service.post(payload)

        // APIService resolves 5xx errors with error.response.data, so response
        // is the parsed body object — not the axios response. A 503 warming_up
        // from the lambda resolves as {status: 'warming_up', message: '...'}.
        // A 502 (EC2 still booting) resolves as {error: '...'}.
        const isWarmingUp = response?.status === 'warming_up' || (seenWarmingUp && response?.error)
        if(isWarmingUp) {
          seenWarmingUp = true
          const elapsed = Date.now() - warmupStart
          if(elapsed + SCISPACY_WARMUP_RETRY_MS > SCISPACY_WARMUP_MAX_MS) {
            markAlgo(__row.__index, 'ocl-scispacy-loinc', -2)
            log({action: 'algo_failed', extras: {algo: 'ocl-scispacy-loinc', status: 503, detail: 'warming_up_timeout'}}, __row.__index)
            setAlert({message: "OCL's scispacy service did not come up within 10 minutes.", severity: 'error'})
            setIsLoadingInDecisionView(false)
            return response
          }
          setAlert({message: t('map_project.scispacy_warming_up'), severity: 'info'})
          await new Promise(resolve => setTimeout(resolve, SCISPACY_WARMUP_RETRY_MS))
        } else {
          warmingUp = false
          const isError = response?.detail
            || response?.status >= 400
            || (response && response.data === undefined && response.status !== 200)
          if(isError) {
            markAlgo(__row.__index, 'ocl-scispacy-loinc', -2)
            log({action: 'algo_failed', extras: {algo: 'ocl-scispacy-loinc', status: response?.status, detail: response?.detail}}, __row.__index)
            setAlert({
              message: response?.detail || "OCL's scispacy matching service is starting up. This may take a couple minutes. You can safely leave this row and come back. Click Refresh if results aren't here in a couple of minutes.",
              severity: 'warning'
            })
            setIsLoadingInDecisionView(false)
            return response
          }
          setAlert(false)
          if(callback) callback(response, payload)
          setIsLoadingInDecisionView(false)
          return response
        }
      } catch(err) {
        warmingUp = false
        markAlgo(__row.__index, 'ocl-scispacy-loinc', -2)
        log({action: 'algo_failed', extras: {algo: 'ocl-scispacy-loinc', error: err?.message}}, __row.__index)
        setAlert({
          message: "OCL's scispacy matching service is starting up. This may take a couple minutes. You can safely leave this row and come back. Click Refresh if results aren't here in a couple of minutes.",
          severity: 'warning'
        })
        setIsLoadingInDecisionView(false)
      }
    }
  }

  // Build the deduplicated rerank request body from the row's ConceptRows +
  // their ConceptDefinitions. Each row carries concept_key as a passthrough
  // anchor so we can match scored results back unambiguously, plus the
  // legacy concept-shaped fields the server expects.
  //
  // Only ConceptRows whose rerank_score is undefined are eligible — already-
  // scored rows are skipped so a late-arriving algo (e.g. scispacy 2+ min
  // after semantic+bridge) doesn't trigger a full re-rerank of every
  // candidate. The cross-encoder reranker is per-(query, candidate) so
  // scores from successive partial batches stay on the same scale.
  const buildRerankRowsForRow = (rowIndex) => {
    const rowState = rowMatchStateRef.current[rowIndex]
    if(!rowState) return []
    const seen = new Set()
    const rows = []
    Object.values(rowState.concept_rows || {}).forEach(conceptRow => {
      const key = conceptRow.concept_key
      if(seen.has(key)) return
      // Skip ConceptRows that already have a rerank_score. The debounced
      // scheduler can fire multiple times as algos complete at different
      // wall-clock times; sending already-scored rows back to $rerank/ is
      // wasted compute (and network bandwidth — a row's candidate list can
      // be hundreds of entries).
      if(typeof conceptRow.rerank_score === 'number') return
      const def = conceptCacheRef.current[key]
      if(!def) return
      // Skip concepts whose ConceptDefinition has no usable display_name —
      // typically bridge cascade targets still in 'pending' status before
      // ensureLoaded fills them. The reranker scores name-less entries as
      // -100000 sentinel, which renders as garbage in the candidate list.
      // scheduleRerank will re-fire after ensureLoaded completes (any
      // ConceptRow with rerank_score===undefined keeps the row eligible).
      const hasName = (typeof def.display_name === 'string' && def.display_name.trim().length > 0)
        || (Array.isArray(def.names) && def.names.some(n => n?.name))
      if(!hasName) return
      seen.add(key)
      rows.push({
        concept_key: key,
        id: def.id || def.reference?.code,
        url: def.ocl_url,
        display_name: def.display_name,
        names: def.names,
        descriptions: def.descriptions,
        source: def.source,
        owner: def.owner
      })
    })
    return rows
  }

  // Match a rerank response item back to a ConceptRow concept_key by the
  // canonical concept_key passthrough that buildRerankRowsForRow sent up.
  // Throws on miss — fuzzy fallbacks (ocl_url, id+source) are deliberately
  // gone because the unified-model spec relies on canonical identity. A
  // miss here means either (a) the server stripped concept_key from the
  // response, or (b) project config is incomplete so the cache never saw
  // the key. Both are operator-visible bugs, not silent-skip cases.
  const matchRerankResultToKey = (result) => {
    if(!result?.concept_key)
      throw new Error('rerank response missing concept_key passthrough')
    if(!conceptCacheRef.current[result.concept_key])
      throw new Error(`rerank result references unknown concept_key: ${result.concept_key}`)
    return result.concept_key
  }

  const rerank = async (_index, isBulk=false) => {
    const index = isNumber(_index) ? _index : rowIndex
    if(!isNumber(index)) return null
    if(inFlightRerankRef.current.has(index)) {
      // Another rerank is in flight for this row; flag a rerun and bail.
      rerankRerunNeededRef.current.add(index)
      return null
    }
    // Wait for any in-flight $lookups for this row's concepts. buildRerankRowsForRow
    // filters out nameless entries, so running before lookups complete silently
    // drops candidates from the payload. This matters most for the bulk path
    // (processRerankWithConcurrency calls rerank() directly, bypassing scheduleRerank).
    const rowStateForLookup = rowMatchStateRef.current[index]
    if(rowStateForLookup?.concept_rows) {
      const pendingLookups = Object.keys(rowStateForLookup.concept_rows)
        .filter(key => inFlightLookupsRef.current.has(key))
        .map(key => inFlightLookupsRef.current.get(key))
      if(pendingLookups.length) {
        await Promise.all(pendingLookups)
        // The settling lookups fired scheduleRerank via settle()/writeConceptCachePatch,
        // setting a 300ms debounce timer. Clear it — we're already inside rerank() and
        // about to run, so that timer would only queue a redundant rerankRerunNeeded.
        if(rerankDebounceRef.current[index]) {
          clearTimeout(rerankDebounceRef.current[index])
          delete rerankDebounceRef.current[index]
        }
      }
    }
    const rerankRows = buildRerankRowsForRow(index)
    const row = data[index]
    const query = get(prepareRow(row), 'name')
    if(!rerankRows.length || !query) {
      // Nothing to rerank, but bulk auto-match still needs its side effect.
      // After the Bug 9 filter (skip already-scored rows), this branch fires
      // every time bulk processRerankWithConcurrency races a debounced
      // scheduleRerank that already scored the row from algo onResponse.
      // Without the setAutoMatched trigger, auto-match would never propose
      // a mapping even for rows with a clearly-recommended top candidate.
      if(isBulk && isNumber(index))
        setTimeout(() => setAutoMatched([index]), 1000)
      return null
    }
    inFlightRerankRef.current.add(index)
    markAlgo(index, 'rerank', 0)
    const service = APIService.concepts().appendToUrl('$rerank/')
    try {
      const response = await service.post({
        q: query,
        rows: rerankRows,
        ...(encoderModel ? { encoder_model: encoderModel } : {})
      })

      // Write rerank_score into the row's ConceptRows. matchRerankResultToKey
      // throws on canonical-identity miss; surface to the alert state so a
      // misconfigured project / server doesn't fail silently.
      const resultsByKey = new Map()
      const matchErrors = []
      forEach(response?.data || [], result => {
        let key
        try {
          key = matchRerankResultToKey(result)
        } catch (matchErr) {
          matchErrors.push(matchErr.message)
          return
        }
        const score = result?.search_meta?.search_normalized_score
        const rawScore = result?.search_meta?.search_rerank_score
        resultsByKey.set(key, { rerank_score: isNumber(score) ? score : (isNumber(rawScore) ? rawScore * 100 : undefined) })
      })
      if(matchErrors.length) {
        const summary = `Rerank: ${matchErrors.length} of ${response?.data?.length || 0} results could not be matched to a candidate. Check project configuration (canonical URLs) and server response.`
        log({action: 'rerank_match_failure', description: summary, extras: {samples: matchErrors.slice(0, 3)}}, index)
        setAlert({message: summary, severity: 'error', duration: 8})
      }
      const prevRow = rowMatchStateRef.current[index]
      if(prevRow) {
        const nextConceptRows = { ...prevRow.concept_rows }
        resultsByKey.forEach((patch, key) => {
          const existing = nextConceptRows[key]
          if(existing) nextConceptRows[key] = { ...existing, ...patch }
        })
        const nextRow = { ...prevRow, concept_rows: nextConceptRows }
        rowMatchStateRef.current = { ...rowMatchStateRef.current, [index]: nextRow }
        setRowMatchState(rowMatchStateRef.current)
      }

      // Legacy allCandidates write — preserves rerank scores in the saved
      // project JSON until PR3 lands schema-v2 save/load.
      setAllCandidates(prev => {
        const newCandidates = {...prev}
        forEach(keys(prev), algoId => {
          const existingCandidates = [...(prev[algoId] || [])]
          const ranked = filter(response.data, result => {
            if(algoId === 'ocl-ciel-bridge' && result.search_meta?.algorithm === 'ocl-bridge')
              return result.owner_url === '/orgs/CIEL/'
            return result.search_meta?.algorithm === algoId
          })
          if(ranked.length > 0) {
            const matchIndex = findIndex(existingCandidates, match => match.row.__index === index)
            if(matchIndex > -1) {
              existingCandidates[matchIndex] = {
                ...existingCandidates[matchIndex],
                results: ranked
              }
              newCandidates[algoId] = existingCandidates
            }
          }
        })
        allCandidatesRef.current = newCandidates
        return newCandidates
      })

      markAlgo(index, 'rerank', 1)
      log({action: 'rerank_finished', description: `Reranked with ${encoderModel}`}, index)
      if(isBulk)
        setTimeout(() => setAutoMatched([index]), 1000)
      return response
    } catch (e) {
      log({action: 'rerank_failed', description: `Rerank failed with ${encoderModel}`}, index)
      markAlgo(index, 'rerank', -2)
      return null
    } finally {
      inFlightRerankRef.current.delete(index)
      // If new ConceptRows arrived while we were in flight, fire again.
      if(rerankRerunNeededRef.current.has(index)) {
        rerankRerunNeededRef.current.delete(index)
        scheduleRerank(index)
      }
    }
  }

  // scheduleRerank — debounced trigger. Coalesces rapid algo-completion
  // events for a given row into a single rerank call. The "all algos done"
  // implicit batch goes away; instead, any new ConceptRow that is BOTH
  // rerank-eligible (its ConceptDefinition has a usable display_name —
  // see buildRerankRowsForRow's filter) AND unscored drives a rerank.
  // Gating on display_name avoids an infinite loop where rows that get
  // dropped from the rerank payload (pending bridge cascade targets)
  // never receive a score and keep re-triggering this scheduler. Once
  // ensureLoaded fills the name, writeConceptCachePatch re-fires
  // scheduleRerank for affected rows.
  const RERANK_DEBOUNCE_MS = 300
  const conceptDefHasUsableName = (def) =>
    Boolean(
      (typeof def?.display_name === 'string' && def.display_name.trim().length > 0)
      || (Array.isArray(def?.names) && def.names.some(n => n?.name))
    )
  const scheduleRerank = (rowIndex) => {
    if(!isNumber(rowIndex)) return
    const stage = rowStageRef.current[rowIndex] || {}
    if(isBulkMatchRunningRef.current && bulkMatchAlgoIdsRef.current.length > 0) {
      // Bulk auto-match: wait until all selected algos are done (success or failed) for this row.
      const allDone = bulkMatchAlgoIdsRef.current.every(id => stage[id] === 1 || stage[id] === -2)
      if(!allDone) return
    } else {
      // Single-row: wait until every configured algo has either completed (1) or failed (-2).
      // Checking only === 0 (in-flight) wasn't enough — algos not yet started (-1) or
      // uninitialized (undefined) would let rerank fire before their candidates arrived.
      if(selectedAlgoIds.some(id => stage[id] !== 1 && stage[id] !== -2)) return
    }
    const rowState = rowMatchStateRef.current[rowIndex]
    if(!rowState) return
    // Defer if any concept for this row still has an in-flight $lookup — rerank
    // needs display_name to be available. settle() in ensureLoaded re-fires
    // scheduleRerank once each lookup resolves, so the last settlement unblocks us.
    const hasInFlightLookup = Object.keys(rowState.concept_rows || {}).some(
      key => inFlightLookupsRef.current.has(key)
    )
    if(hasInFlightLookup) return
    const hasEligiblePending = Object.values(rowState.concept_rows || {}).some(cr => {
      if(isNumber(cr.rerank_score)) return false
      const def = conceptCacheRef.current[cr.concept_key]
      return conceptDefHasUsableName(def)
    })
    if(!hasEligiblePending) return
    if(rerankDebounceRef.current[rowIndex])
      clearTimeout(rerankDebounceRef.current[rowIndex])
    rerankDebounceRef.current[rowIndex] = setTimeout(() => {
      delete rerankDebounceRef.current[rowIndex]
      rerank(rowIndex)
    }, RERANK_DEBOUNCE_MS)
  }
  // Keep the forward-ref consumed by mergeIntoRowMatchState fresh so the
  // current-closure scheduleRerank is what gets called.
  scheduleRerankRef.current = scheduleRerank

  const getCandidatesForRow = (index, _candidates, fullObject=false) => {
    const result = find(_candidates, candidate => candidate.row.__index === index)
    return fullObject ? result : (result?.results || [])
  }

  const getAllCandidatesForRow = index => flatten(map(allCandidatesRef.current, candidates => getCandidatesForRow(index, candidates)))

  const getRawScoresForConcept = (index, concept) => {
    if(!concept || !isNumber(index))
      return []

    return compact(map(allCandidates, (candidates, algorithm) => {
      const rowCandidates = getCandidatesForRow(index, candidates)
      const matchingConcept = find(
        rowCandidates,
        candidate => candidate?.url === concept?.url || (
          candidate?.id === concept?.id &&
          (candidate?.source || candidate?.repo?.id || candidate?.repo?.short_code) === (concept?.source || concept?.repo?.id || concept?.repo?.short_code)
        )
      )
      const score = parseFloat(matchingConcept?.search_meta?.search_score)
      return Number.isFinite(score) ? {algorithm, score: score.toFixed(2)} : null
    }))
  }

  const fromScispacyResultsToConcepts = results => {
    let formatted = []
    forEach(results, (result) => {
      // Don't synthesize search_normalized_score from composite_score * 100.
      // The normalizer reads search_normalized_score straight into
      // ConceptRow.rerank_score (normalizers.js:178), so the synthesized
      // value masqueraded as a real rerank score — unified chips for
      // scispacy candidates were just (raw * 100) until the debounced
      // $rerank/ pass would have overwritten them (and didn't, since the
      // field was already populated). Leave normalized_score off; the
      // rerank pipeline fills rerank_score on these rows just like the
      // other algos.
      if(result?.LOINC_NUM)
        formatted.push({id: result.LOINC_NUM, display_name: result.LONG_COMMON_NAME, search_meta: {search_score: result.composite_score, algorithm: 'ocl-scispacy-loinc'}, extras: result, source: 'LOINC'})
    })
    return formatted
  }

  const fetchBridgeCandidates = (_row, offset=0, _retired, scrollToBottom, _filters, forceReload=false, isBulk=false, callback) => {
    let __row = isEmpty(_row) ? row : _row
    const bridgeAlgoId = bridgeAlgo?.id || 'ocl-ciel-bridge'
    const existingCandidates = find(allCandidatesRef.current[bridgeAlgoId], c => c.row.__index === __row.__index)?.results
    if(!isBulk && !forceReload && offset === 0 && !_retired && existingCandidates?.length> 0) {
      setTimeout(() => highlightTexts(existingCandidates, null, false), 100)
      return Promise.resolve()
    }
    if(!bridgeEnabled)
      return Promise.resolve()
    setIsLoadingInDecisionView(true)
    const payload = getPayloadForMatching([__row], repo)
    let __offset = offset || 0
    return new Promise(resolve => {
      bridgeRef.current?.fetchBridgeCandidates(
        payload,
        __offset,
        isBoolean(_retired) ? _retired : retired,
        (candidates) => {
          if(callback) {
            const newCandidates = candidates?.map(candidate => ({
              ...candidate,
              results: candidate?.results?.map(result => ({
                ...result,
                search_meta: {
                  ...result?.search_meta,
                  algorithm: bridgeAlgoId
                }
              }))
            }));
            callback(newCandidates, payload)
          }
          resolve()
        },
        (response, errorMsg) => {
          markAlgo(__row.__index, bridgeAlgoId, -2)
          log({action: 'algo_failed', extras: {algo: bridgeAlgoId}}, __row.__index)
          setAlert({message: response?.detail || errorMsg, severity: 'error'})
          setIsLoadingInDecisionView(false)
          resolve()
        }
      )
    })
  }

  const findConceptByIdOrURLFromCache = (id) => {
    let key = getKeyFromCache(id)
    let _cached = key ? conceptCache[key] : false
    if(!_cached?.id && keys(_cached).length) {
      delete conceptCache[key]
      return false
    }
    return _cached
  }

  const getKeyFromCache = id => {
    if(!id)
      return false
    return find(keys(conceptCache), url => url === id || url.endsWith(`/concepts/${id}/`) || url.endsWith(`/concepts/${encodeURIComponent(id)}/`)) || false
  }

  const getLookupService = () => {
    let service = APIService.new()
    if(lookupConfig?.url) {
      if(lookupConfig.url.startsWith('http'))
        service.URL = lookupConfig.url
      else
        service.overrideURL(lookupConfig.url)
    } else {
      service.overrideURL(repoVersion.version_url)
    }
    return service.appendToUrl('concepts/')
  }

  // ensureLoaded — state-driven $lookup over $resolveReference
  // (plans/unified-mapper-model.md "$lookup — built on $resolveReference").
  // Idempotent over concept_keys: skips concepts already 'full' in the
  // conceptCache and dedupes concurrent calls via inFlightLookupsRef.
  // Branch 1: concepts with a known ocl_url -> direct GET on that URL.
  // Branch 2: concepts without an ocl_url -> batched POST /$resolveReference/
  //   (?namespace=) followed by per-resolved concept fetch from the repo
  //   the registry pointed at. Writes back into conceptCache keyed by
  //   concept_key with lookup_status='full'|'failed' and a lookup_source.
  // Apply a {[key]: mergedDef} update to both conceptCacheRef (synchronous
  // — so same-tick consumers read fresh data) and conceptCache state (so
  // React rerenders). Used by ensureLoaded.
  const writeConceptCachePatch = React.useCallback((key, def) => {
    if(!key || !def) return
    const prev = conceptCacheRef.current[key]
    const next = { ...conceptCacheRef.current, [key]: def }
    conceptCacheRef.current = next
    setConceptCache(next)
    // If this patch transitioned the concept's lookup_status to 'full' (or
    // any state where display_name is now usable when previously it wasn't),
    // re-fire scheduleRerank for every row that references this key. Those
    // rows became rerank-eligible at this moment and need a score.
    const wasUsable = (typeof prev?.display_name === 'string' && prev.display_name.trim().length > 0)
      || (Array.isArray(prev?.names) && prev.names.some(n => n?.name))
    const nowUsable = (typeof def?.display_name === 'string' && def.display_name.trim().length > 0)
      || (Array.isArray(def?.names) && def.names.some(n => n?.name))
    if(!wasUsable && nowUsable && scheduleRerankRef.current) {
      Object.entries(rowMatchStateRef.current).forEach(([idx, rowState]) => {
        if(rowState?.concept_rows?.[key]) scheduleRerankRef.current(Number(idx))
      })
    }
  }, [])
  const writeLookupFailure = React.useCallback((key) => {
    const existing = conceptCacheRef.current[key]
    if(!existing) return
    writeConceptCachePatch(key, { ...existing, lookup_status: 'failed' })
  }, [writeConceptCachePatch])

  const ensureLoaded = React.useCallback(async (conceptKeys) => {
    if(!Array.isArray(conceptKeys) || conceptKeys.length === 0) return
    const ctx = buildProjectContext()
    const resolveNamespace = ctx?.namespace
    const cache = conceptCacheRef.current
    // Honor the user-configured lookup token when present (LookupConfig in
    // the project settings drawer). Falls back to the session's user token
    // for projects that don't override. Without this gate, the legacy
    // Search-tab fetches respected the user's token but the new unified
    // ensureLoaded path silently used the session token instead — leaving
    // the LookupConfig widget half-decorative.
    const currentToken = currentUserToken()
    const authToken = lookupConfig?.token || currentToken

    const directFetches = []
    const toResolve = []
    const settlers = new Map()
    const pending = []

    conceptKeys.forEach(key => {
      if(!key) return
      const def = cache[key]
      if(def?.lookup_status === 'full') return
      if(inFlightLookupsRef.current.has(key)) {
        pending.push(inFlightLookupsRef.current.get(key))
        return
      }
      const promise = new Promise(resolve => settlers.set(key, resolve))
      inFlightLookupsRef.current.set(key, promise)
      pending.push(promise)

      if(def?.ocl_url) {
        directFetches.push({key, oclUrl: def.ocl_url})
      } else {
        try {
          const reference = parseConceptKey(key)
          toResolve.push({key, reference})
        } catch (_) {
          inFlightLookupsRef.current.delete(key)
          settlers.get(key)()
        }
      }
    })

    const settle = (key) => {
      inFlightLookupsRef.current.delete(key)
      const fn = settlers.get(key)
      if(fn) fn()
    }

    const fetchConceptByOclUrl = async (key, oclUrl, source) => {
      try {
        let service = APIService.new()
        if(oclUrl.startsWith('http://') || oclUrl.startsWith('https://')) {
          service.URL = oclUrl
        } else {
          service = service.overrideURL(oclUrl)
        }
        const response = await service.get(authToken, null, {includeMappings: true, mappingBrief: true, mapTypes: 'SAME-AS,SAME AS,SAME_AS', verbose: true})
        const data = response?.data
        if(data?.id) {
          const existing = conceptCacheRef.current[key] || {}
          writeConceptCachePatch(key, {
            ...existing,
            ...data,
            ocl_url: oclUrl,
            lookup_status: 'full',
            lookup_source_type: '$lookup',
            lookup_source: source || oclUrl
          })
        } else {
          writeLookupFailure(key)
        }
      } catch (_) {
        writeLookupFailure(key)
      } finally {
        settle(key)
      }
    }

    const directPromise = Promise.all(directFetches.map(({key, oclUrl}) => fetchConceptByOclUrl(key, oclUrl)))

    let resolvePromise = Promise.resolve()
    if(toResolve.length) {
      const body = toResolve.map(({reference}) => reference.version
        ? {url: reference.url, version: reference.version}
        : {url: reference.url})
      resolvePromise = APIService.new()
        .overrideURL('/$resolveReference/')
        .post(body, currentToken, null, resolveNamespace ? {namespace: resolveNamespace} : undefined)
        .then(async response => {
          const items = Array.isArray(response?.data) ? response.data : []
          await Promise.all(toResolve.map(async ({key, reference}, i) => {
            const item = items[i]
            const repoUrl = lookupConfig?.url || (item?.resolved === true ? item?.result?.url : null)
            if(!repoUrl) {
              writeLookupFailure(key)
              settle(key)
              return
            }
            const base = repoUrl.endsWith('/') ? repoUrl : `${repoUrl}/`
            const conceptUrl = `${base}concepts/${encodeURIComponent(reference.code)}/`
            await fetchConceptByOclUrl(key, conceptUrl, `$resolveReference -> ${base}`)
          }))
        })
        .catch(() => {
          toResolve.forEach(({key}) => {
            writeLookupFailure(key)
            settle(key)
          })
        })
    }

    await Promise.all([directPromise, resolvePromise, ...pending])
  }, [buildProjectContext, writeConceptCachePatch, writeLookupFailure, lookupConfig?.token])

  // Wire the forward-ref consumed by mergeIntoRowMatchState. useEffect
  // so the ref always points at the latest closure (ensureLoaded captures
  // buildProjectContext which can change). Effect is cheap — just a ref
  // pointer update.
  React.useEffect(() => {
    ensureLoadedRef.current = ensureLoaded
  }, [ensureLoaded])

  // Thin convenience wrapper preserved at the legacy call sites: derive
  // concept_keys for the just-arrived results via the algo's
  // concept_identity, then delegate to ensureLoaded. Replaces the legacy
  // `algo.lookup_required` gate — every concept that isn't already 'full'
  // is eligible for $lookup, in line with the unified-model spec.
  const lookupCandidates = (algoId, candidates) => {
    if(!algoId || !Array.isArray(candidates) || candidates.length === 0) return
    const ctx = buildProjectContext()
    if(!ctx?.target_repo?.canonical_url) return
    const algoConfig = ensureConceptIdentity(getAlgoDef(algoId))
    if(!algoConfig) return
    const normalized = normalizeAlgorithmInvocation(
      {row: {__index: -1}, results: candidates},
      {algorithmId: algoId, algorithmConfig: algoConfig, projectContext: ctx, rowIndex: -1}
    )
    const keysToLoad = normalized.concept_definitions
      .filter(d => d.lookup_status !== 'full')
      .map(d => d.key)
    if(keysToLoad.length) ensureLoaded(keysToLoad)
  }

  const onFetchMoreCandidates = () => {
    const algoDef = getFirstAlgoDef()
    const currentResults = find(allCandidatesRef.current[algoDef?.id], matched => matched.row.__index === rowIndex)?.results?.length || 0
    fetchAllCandidatesForRow(algoDef?.id, null, currentResults, undefined, true)
  }

  const search = (event, page, pageSize, includeRetired, appliedFilters) => {
    if(!searchStr)
      return
    setIsLoadingInDecisionView(true)
    getLookupService().get(lookupConfig?.token, null, {
      includeSearchMeta: true,
      includeMappings: true,
      mappingBrief: true,
      mapTypes: 'SAME-AS,SAME AS,SAME_AS',
      verbose: true,
      limit: pageSize || 25,
      q: searchStr,
      page: page || 1,
      includeRetired: includeRetired === undefined ? retired : includeRetired,
      ...getFacetQueryParam(appliedFilters || appliedFacets[rowIndex]),
    }).then(response => {
      let items = response.data
      setSearchedConcepts({...searchedConcepts, [row.__index]: items})
      setSearchResponse(response)
      setIsLoadingInDecisionView(false)
      const el = document.getElementById('search-results')
      if(el)
        el.scrollTo({ top: 0, behavior: 'smooth' });

      if(!page || page === 1)
        getFacets()
      if(items.length > 0)
        setTimeout(() => highlightTexts(items, null, false), 100)
    });
  }

  const getFacets = (firstLoad, rowIndex) => {
    const targetRowIndex = isNumber(rowIndex) ? rowIndex : row?.__index
    if(!isNumber(targetRowIndex))
      return Promise.resolve()

    const query = {
      q: firstLoad ? '' : searchStr,
      includeRetired: retired,
      facetsOnly: true
    }
    const requestKey = JSON.stringify({
      repoVersion: repoVersion?.version_url || '',
      lookupURL: lookupConfig?.url || '',
      query
    })

    latestFacetRequestRef.current[targetRowIndex] = requestKey

    if(fetchedFacets[requestKey]) {
      setRowFacetKeys(prev => ({...prev, [targetRowIndex]: requestKey}))
      return Promise.resolve(fetchedFacets[requestKey])
    }

    if(facetsRequestsRef.current[requestKey]) {
      return facetsRequestsRef.current[requestKey].then(response => {
        if(latestFacetRequestRef.current[targetRowIndex] === requestKey)
          setRowFacetKeys(prev => ({...prev, [targetRowIndex]: requestKey}))
        return response
      })
    }

    const request = getLookupService().get(lookupConfig?.token, null, query).then(response => {
      const fields = response?.data?.facets?.fields || {}
      setFetchedFacets(prev => ({...prev, [requestKey]: fields}))
      if(latestFacetRequestRef.current[targetRowIndex] === requestKey)
        setRowFacetKeys(prev => ({...prev, [targetRowIndex]: requestKey}))
      return response
    }).finally(() => {
      delete facetsRequestsRef.current[requestKey]
    })

    facetsRequestsRef.current[requestKey] = request
    return request
  }

  const getFacetsForRow = index => fetchedFacets[rowFacetKeys[index]] || {}

  const getFacetQueryParam = filters => {
    const queryParam = {}
    forEach(
      filters, (value, field) => {
        queryParam[field] = keys(pickBy(value, Boolean)).join(',')
      }
    )

    if(queryParam?.retired === 'true,false' || queryParam?.retired === 'false,true')
      queryParam['includeRetired'] = true

    return queryParam
  }

  const getAppliedFacetFromQueryParam = filters => {
    const applied = {}
    forEach(filters, (value, field) => {
      applied[field] = {}
      if(isBoolean(value)) {
        applied[field][value.toString()] = true
      } else
        forEach(value.split(','), val => applied[field][val] = true)
    })
    return applied
  }
  const equalSplitView = Boolean(rowIndex !== undefined) || (configure && file?.name)
  const isSplitView = equalSplitView || (project?.id && showProjectLogs)
  const rows = getRows()

  const getConcept = (concept, returnSelf=true) => {
    let cached = (concept?.url || concept?.id) ? findConceptByIdOrURLFromCache(concept?.url || concept?.id) : false
    if(cached && concept?.search_meta)
      cached.search_meta = concept.search_meta
    if(cached && concept?.source)
      cached.source = concept.source
    if(cached && concept?.contributingAlgorithms)
      cached.contributingAlgorithms = concept.contributingAlgorithms
    if(cached && concept?.contributingAlgorithmIds)
      cached.contributingAlgorithmIds = concept.contributingAlgorithmIds
    return returnSelf ? (cached || concept) : cached
  }

  const onProposedUpdate = proposedState => setProposed(prev => ({...prev, [rowIndex]: {...proposedState}}))

  const doubleClickCallback = useDoubleClick(onCSVRowSelect, () => {});

  const isConfigureInSplitView = configure && file?.name
  const columnsForTable = getColumnsForTable()
  let targetConcept = mapSelected[rowIndex] ? getConcept(mapSelected[rowIndex], true) : false
  const targetRowViews = rowMatchStateRef.current?.[rowIndex]
    ? buildQualityRowViews(rowMatchStateRef.current[rowIndex], conceptCacheRef.current)
    : []
  const selectedTargetRowView = targetConcept ? find(targetRowViews, view => {
    const mapped = conceptForMapping(view)
    if(!mapped) return false
    if(targetConcept?.url && mapped.url)
      return mapped.url === targetConcept.url
    return mapped.id === targetConcept?.id
  }) : false
  if(selectedTargetRowView && targetConcept) {
    const mergedConcept = conceptForMapping(selectedTargetRowView)
    targetConcept = {
      ...targetConcept,
      ...mergedConcept,
      repo: targetConcept.repo,
      url: targetConcept.url || mergedConcept.url
    }
  }
  const targetConceptFromCandidate = (!isEmpty(allCandidatesRef.current) && isNumber(rowIndex) && targetConcept?.url) ? find(getAllCandidatesForRow(rowIndex), {url: targetConcept.url}) : false
  if(targetConceptFromCandidate)
    targetConcept.search_meta = {
      ...(targetConceptFromCandidate.search_meta || {}),
      contributing_algorithms: targetConcept?.search_meta?.contributing_algorithms || targetConcept?.contributingAlgorithms,
      contributing_algorithm_ids: targetConcept?.search_meta?.contributing_algorithm_ids || targetConcept?.contributingAlgorithmIds
    }
  else if(!targetConcept?.search_meta?.search_normalized_score) {
    let meta = find(searchedConcepts[rowIndex], {url: targetConcept?.url})?.search_meta
    if(meta?.search_normalized_score)
      targetConcept.search_meta = meta
  }

  const labelDisplayedRows = ({ from, to, count }) => {
    return `${from.toLocaleString()}–${to.toLocaleString()} of ${count?.toLocaleString()}`;
  };

  const getCandidateBucket = score => {
    if(score >= candidatesScore.recommended)
      return 'recommended'
    if(score >= candidatesScore.available)
      return 'available'
    return 'low_ranked'
  }

  const getPromptTemplateVersionFromURL = React.useCallback((url) => {
    if(!url)
      return ''
    const match = url.match(/\/prompts\/[^/]+\/([^/]+)\//)
    const version = match?.[1] || ''
    return version && version !== 'invoke' ? version : ''
  }, [])

  const getProjectPromptTemplateKey = React.useCallback((template = promptTemplate) => (
    template?.key || projectPromptTemplateKey || ''
  ), [projectPromptTemplateKey, promptTemplate])

  const getDefaultAIModelId = React.useCallback((template, models = AIModels) => (
    find(models, {id: template?.default_model})?.id || find(models, {is_default: true})?.id || ''
  ), [AIModels])

  const getResolvedPromptTemplateURI = React.useCallback((template, key) => {
    const uri = template?.prompt_template_uri || template?.uri || template?.url
    if(uri)
      return uri.endsWith('/') ? uri : `${uri}/`
    if(template?.version)
      return `/prompts/${key}/${template.version}/`
    return key ? `/prompts/${key}/` : ''
  }, [])

  const getPromptTemplateInvokeURL = React.useCallback((template, key) => {
    const resolvedURI = getResolvedPromptTemplateURI(template, key)
    if(!resolvedURI)
      return ''
    const invokeURI = `${resolvedURI}invoke/`
    return /^https?:\/\//.test(invokeURI) ? invokeURI : new URL(invokeURI, AI_ASSISTANT_API_URL).toString()
  }, [AI_ASSISTANT_API_URL, getResolvedPromptTemplateURI])

  const getConfiguredPromptTemplateKey = React.useCallback(() => (
    projectPromptTemplateKey || PROMPTS_KEY_DEFAULT
  ), [projectPromptTemplateKey])

  const fetchAIModels = () => {
    if(!AIModels.length) {
      if(!AI_ASSISTANT_API_URL) {
        return
      }
      const service = APIService.new()
      service.URL = AI_ASSISTANT_API_URL
      service.appendToUrl('/match/models/').get().then(response => {
        if(response?.detail) {
          return
        }
        setAIModels(response.data)
      })
    }
  }

  const getPromptTemplateRef = React.useCallback((template = promptTemplate) => {
    const key = template?.key || getConfiguredPromptTemplateKey()
    if(!key)
      return undefined

    const uri = template?.uri || template?.prompt_template_uri || template?.url || `/prompts/${key}/`

    return {
      key,
      version: template?.version || getPromptTemplateVersionFromURL(uri) || null,
      uri: uri || null
    }
  }, [getConfiguredPromptTemplateKey, getPromptTemplateVersionFromURL, promptTemplate])

  const getSelectedAIModel = React.useCallback((modelId = AIModel) => (
    find(AIModels, {id: modelId})
  ), [AIModel, AIModels])

  const onPromptTemplateChange = React.useCallback((template) => {
    setPromptTemplate(template || null)
    const nextModelId = getDefaultAIModelId(template, AIModels)
    if(nextModelId)
      setAIModel(nextModelId)
  }, [AIModels, getDefaultAIModelId])

  const fetchPromptTemplates = React.useCallback((models = AIModels) => {
    if(!AI_ASSISTANT_API_URL || !isCoreUser)
      return

    const service = APIService.new()
    service.URL = AI_ASSISTANT_API_URL
    service.appendToUrl('/prompts/').get(null, null, {action_type: PROMPTS_ACTION_TYPE_DEFAULT}).then(response => {
      if(response?.detail) {
        setAIModel(find(models, {is_default: true})?.id || '')
        return
      }
      setPromptTemplates(response.data || [])
    })
  }, [AIModels, AI_ASSISTANT_API_URL, isCoreUser])

  const fetchPromptTemplateByKey = React.useCallback((key, models = AIModels) => {
    if(!AI_ASSISTANT_API_URL || !key)
      return

    const service = APIService.new()
    service.URL = AI_ASSISTANT_API_URL
    service.appendToUrl(`/prompts/${key}/`).get().then(response => {
      if(response?.detail) {
        setAIModel(find(models, {is_default: true})?.id || '')
        return
      }
      setPromptTemplate(response.data)
      setAIModel(getDefaultAIModelId(response.data, models))
    })
  }, [AIModels, AI_ASSISTANT_API_URL, getDefaultAIModelId])

  React.useEffect(() => {
    if(!AIModels.length || !AI_ASSISTANT_API_URL)
      return
    if(promptTemplatesFetchedRef.current) return
    promptTemplatesFetchedRef.current = true

    if(isCoreUser)
      fetchPromptTemplates(AIModels)
    else
      fetchPromptTemplateByKey(getConfiguredPromptTemplateKey(), AIModels)
  }, [AIModels, AI_ASSISTANT_API_URL, fetchPromptTemplateByKey, fetchPromptTemplates, getConfiguredPromptTemplateKey, isCoreUser])

  React.useEffect(() => {
    if(!isCoreUser || !promptTemplates?.length)
      return

    const configuredKey = getConfiguredPromptTemplateKey()
    const nextTemplate = find(promptTemplates, {key: configuredKey}) || find(promptTemplates, {key: PROMPTS_KEY_DEFAULT}) || promptTemplates[0]
    if(!nextTemplate)
      return

    setPromptTemplate(nextTemplate)
    setAIModel(getDefaultAIModelId(nextTemplate))
  }, [getConfiguredPromptTemplateKey, getDefaultAIModelId, isCoreUser, promptTemplates])

  const resolvePromptTemplateForInvocation = React.useCallback(async (template = promptTemplate) => {
    const key = template?.key || getConfiguredPromptTemplateKey()
    if(!key || !AI_ASSISTANT_API_URL)
      throw new Error('AI Assistant prompt template is not available')

    const service = APIService.new()
    service.URL = AI_ASSISTANT_API_URL
    const response = await service.appendToUrl(`/prompts/${key}/`).get()
    if(response?.detail) {
      throw new Error(response.detail)
    }

    const resolvedTemplate = response?.data || {}
    return {
      ...resolvedTemplate,
      key,
      uri: getResolvedPromptTemplateURI(resolvedTemplate, key),
      version: resolvedTemplate?.version || getPromptTemplateVersionFromURL(getResolvedPromptTemplateURI(resolvedTemplate, key)) || null
    }
  }, [AI_ASSISTANT_API_URL, getConfiguredPromptTemplateKey, getPromptTemplateVersionFromURL, getResolvedPromptTemplateURI, promptTemplate])


  const getProjectMetadata = () => {
    let cols = filter(map(columns, col => ({...col, hidden: AIAssistantColumns[col.dataKey] === false, width: columnWidth[col.dataKey] || undefined})), col => {
      return !has(col, 'hidden') || col['hidden'] === false && col?.label
    })
    cols = compact(map(cols, col => {
      if(['id', 'description', 'mapping: list', 'mapping: code', 'concept_class', 'class', 'datatype', 'name', 'synonyms'].includes(col.label.toLowerCase()) || col.label.toLowerCase().startsWith('property:'))
        return col.label
    }))
    return {
      ...pick(project, ['include_retired', 'owner', 'owner_type', 'owner_url', 'url']),
      name: name,
      description: description,
      filters: filters,
      fields_mapped: cols,
      score_configuration: candidatesScore,
      encoder_model: encoderModel || DEFAULT_ENCODER_MODEL,
      target_repo: repo
    }
  }

  // Slim projection of project metadata for the AI Assistant payload.
  // The full getProjectMetadata() is used for save-as-JSON (legacy schema)
  // and carries UI / algorithm / save-state fields the LLM has no use for.
  // PR3-D3-lite (L-1): drop fields_mapped, score_configuration, encoder_model,
  // include_retired, owner*/url, target_repo (envelope target_repo carries
  // the load-bearing canonical_url/relative_url/version already).
  const getAIProjectMetadata = () => {
    return {
      name: name,
      description: description,
      filters: filters
    }
  }

  // Build the v2 AI Assistant payload sections (recommendable_concepts +
  // bridge_context + target_repo) by running the unified-model normalizer
  // over the legacy allCandidates for the row. Sourcing from allCandidates
  // (rather than rowMatchState) means this works regardless of the
  // UNIFIED_MODEL_ENABLED flag — the bridge-recommendation bug fix can ship
  // with PR2a even though reads are still on legacy state.
  // See plans/unified-mapper-model.md "AI Assistant payload (match-recommend)".
  const buildV2RecommendationPayload = (rowIndex) => {
    const projectContext = buildProjectContext()
    if(!projectContext?.target_repo?.canonical_url) return null

    let allNormCandidates = []
    const defsByKey = new Map()

    // Prefer reading directly from unified rowMatchState + conceptCache when
    // it's populated (the authoritative source under UNIFIED_MODEL_ENABLED).
    // Falls back to re-normalizing allCandidates only if the unified state
    // is empty — keeps the PR2a path alive for any pre-flag flows.
    const rowState = rowMatchStateRef.current?.[rowIndex]
    const haveUnified = rowState && Object.keys(rowState.candidates || {}).length > 0
    if(haveUnified) {
      allNormCandidates = Object.values(rowState.candidates)
      Object.values(rowState.candidates).forEach(cand => {
        const def = conceptCacheRef.current[cand.concept_key]
        if(!def) return
        const existing = defsByKey.get(def.key)
        if(!existing || lookupStatusRank(def.lookup_status) > lookupStatusRank(existing.lookup_status))
          defsByKey.set(def.key, def)
        if(cand.bridge_concept_key) {
          const bridgeDef = conceptCacheRef.current[cand.bridge_concept_key]
          if(bridgeDef && !defsByKey.has(bridgeDef.key)) defsByKey.set(bridgeDef.key, bridgeDef)
        }
      })
    } else {
      selectedAlgoIds.forEach(algoId => {
        const algoDef = getAlgoDef(algoId)
        if(!algoDef?.concept_identity) return
        const rowEntry = find(allCandidatesRef.current[algoId], c => c.row?.__index === rowIndex)
        if(!rowEntry?.results?.length) return

        const normalized = normalizeAlgorithmInvocation(
          {row: rowEntry.row, results: rowEntry.results},
          {algorithmId: algoId, algorithmConfig: algoDef, projectContext, rowIndex}
        )

        allNormCandidates.push(...normalized.candidates)
        normalized.concept_definitions.forEach(def => {
          const existing = defsByKey.get(def.key)
          // Prefer richer definitions (full > partial > pending), matching the
          // mergeIntoRowMatchState rule.
          if(!existing || lookupStatusRank(def.lookup_status) > lookupStatusRank(existing.lookup_status))
            defsByKey.set(def.key, def)
        })
      })
    }

    const targetCanonical = projectContext.target_repo.canonical_url
    // Project-pinned identifying property codes. When absent (FHIR-passthrough
    // sources or repos that haven't pinned a summary), filterPropertyBySummary
    // passes def.property through whole.
    const summaryPropertyCodes = repoVersion?.meta?.display?.concept_summary_properties
    // PR3-H: union of (input_locale, filters.locale). Empty set = no locale
    // filter applied (backwards-compatible for projects with neither set).
    const filterLocaleString = (filters?.locale || '')
    const filterLocales = filterLocaleString ? filterLocaleString.split(',').map(s => s.trim()).filter(Boolean) : []
    const effectiveLocales = [
      ...(inputLocale ? [inputLocale] : []),
      ...filterLocales
    ]
    const recommendable_concepts = []
    const bridge_context = []

    defsByKey.forEach((def, key) => {
      const isBridgeIntermediary = allNormCandidates.some(c => c.concept_key === key && c.type === 'bridge')

      if(isBridgeIntermediary) {
        // Bridges are CONTEXT only — never recommendable. Their target_concept_keys
        // tell the AI which recommendable_concepts they justify.
        const bridgeCandidate = allNormCandidates.find(c => c.concept_key === key && c.type === 'bridge')
        const target_concept_keys = [...new Set(
          allNormCandidates
            .filter(c => c.type === 'bridge_child' && c.bridge_concept_key === key)
            .map(c => c.concept_key)
        )]
        bridge_context.push({
          concept_key: key,
          canonical_reference: def.reference,
          display_name: def.display_name,
          score: bridgeCandidate?.score,
          target_concept_keys
        })
      } else if(def.reference?.url === targetCanonical) {
        // Target-repo concepts only. Evidence shows which algorithms surfaced
        // this concept (and via which bridge, if applicable).
        const evidence = allNormCandidates
          .filter(c => c.concept_key === key)
          .map(c => {
            const e = {
              algorithm_id: c.algorithm_id,
              candidate_type: c.type,
              score: c.score,
              highlights: c.highlights
            }
            if(c.type === 'bridge_child' && c.bridge_concept_key)
              e.via = {bridge_concept_key: c.bridge_concept_key, map_type: c.map_type}
            return e
          })
        recommendable_concepts.push(buildRecommendableConceptEntry({
          def, key, evidence, rowState, summaryPropertyCodes, effectiveLocales
        }))
      }
      // Else: concept from a non-target, non-bridge source — skip
    })

    // PR3-D3-lite (L-3): drop `concept_class` / `datatype` from every entry
    // when constant across the surfaced set. LOINC always emits both as
    // constants ("LOINC" / "Nom"); for mixed-class repos the fields stay.
    stripConstantClassAndDatatype(recommendable_concepts)

    // PR3-D3-lite (L-6): strip `canonical_url_source` from the target_repo
    // projection. The field is admin metadata (tells UI whether the canonical
    // was explicit on the repo vs. derived) — the LLM has no use for it.
    // eslint-disable-next-line no-unused-vars
    const { canonical_url_source: _src, ...aiTargetRepo } = projectContext.target_repo
    return {
      target_repo: aiTargetRepo,
      recommendable_concepts,
      bridge_context
    }
  }

  const fetchRecommendation = async (_row, resolvedPromptTemplate = null) => {
    let __row = row;
    let __index = rowIndex;
    if(isNumber(_row?.__index)){
      __row = _row
      __index = _row.__index
    }
    if(!AI_ASSISTANT_API_URL) {
      markAlgo(__index, 'recommend', -3)
      console.error('AI ASSISTANT is not enabled for you.')
      return false
    }
    // Auto-match (caller supplied resolvedPromptTemplate) fires once per row;
    // user-initiated single-row clicks always append a new entry to the
    // per-row analysis history.
    const isAutoMatch = Boolean(resolvedPromptTemplate)
    const existingAnalyses = analysis[__index] || []
    const alreadyAnalyzed = isAutoMatch && existingAnalyses.length > 0
    const v2 = isNumber(__index) ? buildV2RecommendationPayload(__index) : null
    if(isNumber(__index) && repoVersion && !alreadyAnalyzed && (v2?.recommendable_concepts?.length || 0) > 0) {
      markAlgo(__index, 'recommend', 0)
      let rowData = prepareRow(__row, true, true)

      const selectedModel = getSelectedAIModel()
      let activePromptTemplate
      try {
        activePromptTemplate = resolvedPromptTemplate || await resolvePromptTemplateForInvocation()
        if(!activePromptTemplate?.key) {
          setAlert({message: 'AI Assistant prompt template is not available', severity: 'error'})
          markAlgo(__index, 'recommend', -3)
          return false
        }
        // Single-row invocations (no caller-supplied resolvedPromptTemplate)
        // should always hit the latest prompt template, NOT a pinned version.
        // Version pinning matters for bulk auto-match runs (the resolved
        // template is captured once at the start and reused for every row so
        // a mid-run template publish can't shift behavior). For single-row
        // there's no such consistency requirement; pinning made the invoke
        // URL '/prompts/<key>/<version>/invoke/' which 404s when the server
        // doesn't host that specific version path. Clear `version` and the
        // already-version-bearing `uri`/`url`/`prompt_template_uri` so
        // getResolvedPromptTemplateURI falls through to '/prompts/<key>/'.
        if(!resolvedPromptTemplate) {
          activePromptTemplate = {
            ...activePromptTemplate,
            version: null,
            uri: null,
            url: null,
            prompt_template_uri: null
          }
        }
      } catch (err) {
        markAlgo(__index, 'recommend', -2)
        const errorMessage = err?.message || t('unknown_error')
        let timestamp = moment().toDate()
        log({created_at: timestamp, action: 'AIRecommendation', description: errorMessage, extras: {error: errorMessage, model: selectedModel, prompt_template: getPromptTemplateRef(), prompt_template_uri: getPromptTemplateRef()?.uri}}, __index)
        setAlert({message: errorMessage, severity: 'error'})
        return false
      }
      const promptTemplateRef = getPromptTemplateRef(activePromptTemplate)
      const payload = {
        variables: {
          project: getAIProjectMetadata(),
          row: rowData.row,
          metadata: rowData.metadata,
          target_repo: v2.target_repo,
          recommendable_concepts: v2.recommendable_concepts,
          bridge_context: v2.bridge_context
        }
      }

      if(promptOutputLocale && isCoreUser)
        payload.variables.output_locale = promptOutputLocale

      const service = APIService.new()
      service.URL = getPromptTemplateInvokeURL(activePromptTemplate, promptTemplateRef?.key)
      try {
        const response = await service.post(payload)
        let timestamp = moment().toDate()
        if(response?.detail) {
          markAlgo(__index, 'recommend', -2)
          log({created_at: timestamp, action: 'AIRecommendation', description: response.detail, extras: {error: response.detail, model: selectedModel, prompt_template: promptTemplateRef, prompt_template_uri: promptTemplateRef?.uri}})
          setAlert({message: response.detail, severity: 'error'})
          return false
        }

        markAlgo(__index, 'recommend', 1)
        log({created_at: timestamp, action: 'AIRecommendation', description: get(response.data, 'output.rationale') || get(response.data, 'rationale'), extras: {...response.data, model: selectedModel, prompt_template: promptTemplateRef, prompt_template_uri: promptTemplateRef?.uri}}, __index)
        const resolvedTemplate = response.data?.template || {}
        const resolvedVersion = resolvedTemplate.version || promptTemplateRef?.version || null
        const resolvedPromptRef = {
          ...promptTemplateRef,
          version: resolvedVersion,
          uri: resolvedVersion && promptTemplateRef?.key ? `/prompts/${promptTemplateRef.key}/${resolvedVersion}/` : (promptTemplateRef?.uri || null)
        }
        const newEntry = {...response.data, model: selectedModel?.id || AIModel, model_name: selectedModel?.name, prompt_template: resolvedPromptRef, prompt_template_uri: resolvedPromptRef.uri, output_locale: promptOutputLocale || null, timestamp: timestamp, user: user.username || user.id}
        setAnalysis(prev => ({...prev, [__index]: [...(prev[__index] || []), newEntry]}))
        return true
      } catch (err) {
        markAlgo(__index, 'recommend', -2)
        const errorMessage = err?.detail || err?.response?.data?.detail || err?.message || t('unknown_error')
        let timestamp = moment().toDate()
        log({created_at: timestamp, action: 'AIRecommendation', description: errorMessage, extras: {error: errorMessage, model: selectedModel, prompt_template: promptTemplateRef, prompt_template_uri: promptTemplateRef?.uri}}, __index)
        setAlert({message: errorMessage, severity: 'error'})
        return false
      }
    } else {
      markAlgo(__index, 'recommend', analysis[__index]?.length > 0 ? 1 : -3)
    }
    return false
  }

  const getRowNameValue = _row => get(_row, find(columns, {label: 'Name'})?.dataKey)


  const getSplitWidths = () => {
    if(!isSplitView)
      return [100, 0]
    if(equalSplitView)
      return [50, 50]
    return [70, 30]
  }

  const getConfigurationForm = () => (
    <ConfigurationForm
      project={project}
      handleFileUpload={handleFileUpload}
      file={file}
      owner={owner}
      setOwner={setOwner}
      name={name}
      setName={setName}
      description={description}
      setDescription={setDescription}
      repo={repo}
      onRepoChange={onRepoChange}
      repoVersion={repoVersion}
      setRepoVersion={onRepoVersionChange}
      mappedSources={mappedSources}
      targetSourcesFromRows={targetSourcesFromRows}
      versions={versions}
      algos={algos}
      algosSelected={algosSelected}
      setAlgosSelected={setAlgosSelected}
      validColumns={headers}
      columns={columns}
      isValidColumnValue={isValidColumnValue}
      updateColumn={updateColumn}
      configure={configure}
      setConfigure={setConfigure}
      columnVisibilityModel={columnVisibilityModel}
      setColumnVisibilityModel={setColumnVisibilityModel}
      onSave={onSave}
      isSaving={isSaving}
      candidatesScore={candidatesScore}
      onScoreChange={setCandidatesScore}
      includeDefaultFilter={includeDefaultFilter}
      setIncludeDefaultFilter={setIncludeDefaultFilter}
      filters={filters}
      setFilters={setFilters}
      locales={locales}
      isLoadingLocales={isLoadingLocales}
      bridgeEnabled={bridgeEnabled}
      canBridge={canBridge}
      isCoreUser={isCoreUser}
      canScispacy={canScispacy}
      scispacyEnabled={scispacyEnabled}
      setAIAssistantColumns={setAIAssistantColumns}
      AIAssistantColumns={AIAssistantColumns}
      inAIAssistantGroup={inAIAssistantGroup}
      lookupConfig={lookupConfig}
      setLookupConfig={setLookupConfig}
      encoderModel={encoderModel}
      setEncoderModel={setEncoderModel}
      promptTemplates={promptTemplates}
      promptTemplate={promptTemplate}
      onPromptTemplateChange={onPromptTemplateChange}
      AIModels={AIModels}
      AIModel={AIModel}
      setAIModel={setAIModel}
      promptOutputLocale={promptOutputLocale}
      setPromptOutputLocale={setPromptOutputLocale}
      inputLocale={inputLocale}
      setInputLocale={setInputLocale}
      oclLocales={oclLocales}
      namespace={namespace}
      setNamespace={setNamespace}
      useLexicalVariants={useLexicalVariants}
      setUseLexicalVariants={setUseLexicalVariants}
    />
  )


  const onCopyClick = event => {
    event.preventDefault()
    event.stopPropagation()
    if(project?.url) {
      window.open(`/#/map-projects/new?templateFrom=${encodeURIComponent(project.url)}`, '_blank', 'noopener,noreferrer')
    }
  }

  return permissionDenied ? <Error403/> : (
    <div className='col-xs-12 padding-0' style={{borderRadius: '10px', width: 'calc(100vw - 32px)'}}>
      {
        (() => {
          const bridgeUrl = bridgeAlgo?.target_repo_url || '/orgs/CIEL/sources/CIEL/'
          const mappedSrcs = bridgeMappedSources[bridgeUrl] || []
          return Boolean(repoVersion?.url) && mappedSrcs.length > 0 &&
            <BridgeMatch
              service={getMatchAPIService()}
              repo={repoVersion}
              bridgeRepoURL={bridgeUrl}
              limit={CANDIDATES_LIMIT}
              user={user}
              ref={bridgeRef}
              mappedRepoURLs={mappedSrcs.map(source => source.url)}
            />
        })()
      }
      {
        loadingProject &&
          <LoaderDialog open message={t('map_project.loading_project')}/>
      }
      <Split
        sizes={getSplitWidths()}
        minSize={isSplitView ? 200 : 1000}
        expandToMin={false}
        gutterSize={isSplitView ? 6 : 0}
        snapOffset={0}
        direction="horizontal"
        cursor="col-resize"
        style={{ display: 'flex', height: 'calc(100vh - 100px)' }}
        gutter={() => {
        const gutter = document.createElement('div');
        gutter.className = 'gutter';
        return gutter;
      }}
      >
        <Paper component="div" className={isSplitView ? 'col-xs-6 split padding-0' : 'col-xs-12 split padding-0'} sx={{boxShadow: 'none', p: 0, backgroundColor: 'white', borderRadius: '10px', border: 'solid 0.3px', borderColor: 'surface.nv80', minHeight: 'calc(100vh - 100px) !important', overflow: 'auto'}}>
          <Paper component="div" className='col-xs-12' sx={{backgroundColor: 'surface.main', boxShadow: 'none', padding: '4px 16px 8px 16px', borderRadius: '10px 10px 0 0', minWidth: '665px', ...((isConfigureInSplitView || !configure) ? {} : {height: 'calc(100vh - 125px) !important', overflow: 'auto'})}}>
            {
              configure && !file?.name &&
                <div className='col-xs-8 padding-0'>
                  {getConfigurationForm()}
                </div>
          }
            <div className='col-xs-12 padding-0' style={{backgroundColor: SURFACE_COLORS.main, marginLeft: '-5px', paddingBottom: '0px', paddingLeft: '0px', paddingTop: '0px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'}}>
            {
              !(configure && !file?.name) &&
                <span style={{display: 'flex', alignItems: 'center'}}>
                  {
                    name &&
                      <span style={{fontWeight: 'bold', fontSize: '18px', maxWidth: isSplitView ? '300px' : '500px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', marginRight: '8px'}}>
                        {name}
                      </span>
                  }
                  <Button
                    variant='contained'
                    size='small'
                    sx={{textTransform: 'none', margin: '5px'}}
                    endIcon={<DoubleArrowIcon />}
                    startIcon={<AutoMatchIcon />}
                    disabled={!file}
                    onClick={onGetCandidates}
                    loading={loadingMatches}
                    loadingPosition="start"
                  >
                    {getCandidatesButtonLabel()}
                  </Button>
                  {
                    scispacyCandidatesStartedAt &&
                      <Button
                        variant='outlined'
                        size='small'
                        sx={{textTransform: 'none', margin: '5px', pointerEvents: 'none', display: 'none'}}
                        endIcon={isRunningBulkScispacyCandidates ? <PendingIcon color='warning' /> : <DoneIcon color='primary' />}
                        loading={isRunningBulkScispacyCandidates || isRunningBulkAnalysis}
                        loadingPosition="start"
                      >
                        {getBulkScispacyCandidatesButtonLabel()}
                      </Button>
                  }
                  {
                    bridgeCandidatesStartedAt &&
                      <Button
                        variant='outlined'
                        size='small'
                        sx={{textTransform: 'none', margin: '5px', pointerEvents: 'none', display: 'none'}}
                        endIcon={isRunningBulkBridgeCandidates ? <PendingIcon color='warning' /> : <DoneIcon color='primary' />}
                        loading={isRunningBulkBridgeCandidates || isRunningBulkAnalysis}
                        loadingPosition="start"
                      >
                        {getBulkBridgeCandidatesButtonLabel()}
                      </Button>
                  }
                  {
                    bulkAIAnalysisStartedAt &&
                      <Button
                        variant='outlined'
                        size='small'
                        sx={{textTransform: 'none', margin: '5px', pointerEvents: 'none', display: 'none'}}
                        startIcon={<AssistantIcon />}
                        endIcon={isRunningBulkAnalysis ? <PendingIcon color='warning' /> : <DoneIcon color='primary' />}
                        loading={isRunningBulkAnalysis}
                        loadingPosition="start"
                      >
                        {getBulkAIAnalysisButtonLabel()}
                      </Button>
                  }
                  {
                    (loadingMatches || isRunningBulkAnalysis || isRunningBulkBridgeCandidates || isRunningBulkScispacyCandidates) &&
                      <Button
                        variant='text'
                        size='small'
                        color='error'
                        sx={{textTransform: 'none', margin: '5px'}}
                        onClick={() => {
                          abortRef.current = true
                          setRandom(random + 1)
                          projectLog({action: 'auto_match_stopped_by_user'})
                        }}
                        disabled={abortRef.current}
                      >
                        {abortRef.current ? t('map_project.stopping_gracefully') : t('map_project.stop_processing')}
                      </Button>
                  }
                </span>
            }
              {
                file?.name &&
                  <Controls
                    isCoreUser={isCoreUser}
                    project={project}
                    onDownload={onDownloadClick}
                    onSave={onSave}
                    onDelete={() => setDeleteProject(true)}
                    owner={owner}
                    file={file}
                    loadingMatches={loadingMatches}
                    isSaving={isSaving}
                    onImport={isEmpty(mapSelected) ? false : () => setOpenImportToCollection(true)}
                    importResponse={imports[0]}
                    onDownloadImportReport={downloadImportReport}
                    onProjectLogsClick={() => {
                      const newValue = !showProjectLogs
                      if(newValue) {
                        setConfigure(false)
                        onCloseDecisions()
                      }
                      setShowProjectLogs(newValue)
                    }}
                    isProjectsLogOpen={showProjectLogs}
                    configure={configure}
                    setConfigure={setConfigure}
                    onCopyClick={onCopyClick}
                  />
              }
          </div>
        </Paper>
        {
          (Boolean(rows?.length) || ROW_STATES.includes(selectedRowStatus) || searchText) &&
            <div className='col-xs-12' style={{padding: '0', width: '100%', height: 'calc(100vh - 170px)', minWidth: '665px'}}>
              <div className='col-xs-12' style={{padding: '0 12px', display: 'flex', backgroundColor: SURFACE_COLORS.main, overflowX: 'auto'}}>
                {
                  map(VIEWS, (state, view) => {
                    const count = view === 'all' ? data.length : rowStatuses[view].length
                    const isLast = view === 'reviewed'
                    const getDividerBgColor = () => {
                      if(!selectedRowStatus || selectedRowStatus === 'all')
                        return undefined
                      if(selectedRowStatus === 'unmapped' && ['all'].includes(view))
                        return 'primary.main'
                      if(selectedRowStatus === 'readyForReview' && ['all', 'unmapped'].includes(view))
                        return 'primary.main'
                      if(selectedRowStatus === 'reviewed')
                        return 'primary.main'
                    }
                    return (
                      <MatchSummaryCard
                        size='large'
                        key={view}
                        id={view}
                        count={count.toLocaleString()}
                        loading={loadingMatches}
                        selected={selectedRowStatus}
                        onClick={() => onStateTabChange(view)}
                        {...VIEWS[view]}
                        isLast={isLast}
                        dividerBgColor={getDividerBgColor()}
                      />
                    )
                  })
                }
              </div>
              <div className='col-xs-12' style={{padding: '12px 14px 8px 14px', display: 'flex', alignItems: 'center', backgroundColor: SURFACE_COLORS.main}}>
                <FormControl sx={{minWidth: '16px'}}>
                  <SearchField onChange={debounce(val => setSearchText(val || ''))} />
                </FormControl>
                <ScoreBucketButton
                  selected={selectedCandidatesScoreBucket}
                  onSort={() => setScoreBucketSortBy(scoreBucketSortBy === 'desc' ? 'asc' : 'desc')}
                  sortBy={scoreBucketSortBy}
                  onClick={bucket => setSelectedCandidatesScoreBucket(selectedCandidatesScoreBucket === bucket ? false : bucket)}
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
              <Collapse in={Boolean(alert?.message)}>
                <Alert
                  severity={alert?.severity || 'error'}
                  action={
                    <IconButton
                      aria-label="close"
                      color="inherit"
                      size="small"
                      onClick={() => setAlert(false)}
                    >
                      <CloseIcon fontSize="inherit" />
                    </IconButton>
                  }
                  sx={{ mb: 2 }}
                >
                  {alert.message}
                </Alert>
              </Collapse>
              <div style={{ width: '100%', height: project?.id ? 'calc(100vh - 263px)' : 'calc(100vh - 250px)' }}>
                <DataGrid
                  onFilterModelChange={(model) => setFilterModel(model)}
                  filterModel={filterModel}
                  resizeThrottleMs={100}
                  onCellClick={doubleClickCallback}
                  sx={{
                    borderRadius: '0 0 10px 10px',
                    borderBottom: 'none',
                    '.MuiDataGrid-columnHeader': {
                      borderRadius: 0,
                      borderTopLeftRadius: '0 !important',
                      '.MuiButtonBase-root': {
                        color: 'rgba(0, 0, 0, 0.5)',
                        '.MuiSvgIcon-root': {opacity: '1 !important'},
                      }
                    },
                    '.MuiDataGrid-row .MuiDataGrid-cell': {
                      whiteSpace: 'pre-line',
                      padding: '4px 10px'
                    },
                    [`.MuiDataGrid-row[data-id="${rowIndex}"]`]: {
                      backgroundColor: 'primary.90'
                    },
                    '.MuiDataGrid-footerContainer': {
                      minHeight: '40px',
                      '.MuiToolbar-root': {
                        height: '40px',
                        minHeight: '40px'
                      }
                    }
                  }}
                  columnHeaderHeight={64}
                  onColumnWidthChange={(params) => params?.colDef?.field ? setColumnWidth({...columnWidth, [params?.colDef?.field]: params.width}) : null}
                  getRowHeight={() => 'auto'}
                  getRowId={row => row.__index}
                  rows={rows}
                  columns={columnsForTable}
                  pageSizeOptions={[100]}
                  initialState={{
                    pagination: {
                      paginationModel: {
                        pageSize: 100,
                      },
                    },
                  }}
                  localeText={{
                    MuiTablePagination: {
                      labelDisplayedRows,
                    },
                  }}
                  columnVisibilityModel={columnVisibilityModel}
                  onColumnVisibilityModelChange={setColumnVisibilityModel}
                  getRowClassName={params => {
                    const index = params?.row?.__index
                    const targetConcept = mapSelected[index]
                    if(targetConcept) {
                      const score = targetConcept?.search_meta?.search_normalized_score
                      return getCandidateBucket(score) + '-row'
                    } else
                      return 'unmatched-row'
                  }}
                />
              </div>
            </div>
        }
          <AutoMatchDialog
            open={matchDialog}
            onClose={() => setMatchDialog(false)}
            onSubmit={onGetCandidatesSubmit}
            {...{
              rowStatuses,
              autoMatchUnmappedOnly,
              setAutoMatchUnmappedOnly,
              autoRunAIAnalysis,
              setAutoRunAIAnalysis,
              AIModels,
              AIModel,
              setAIModel,
              promptTemplates,
              promptTemplate,
              setPromptTemplate: onPromptTemplateChange,
              repoVersion,
              inAIAssistantGroup,
              algosSelected,
              isCoreUser
            }}
          />
      </Paper>
      <Paper component="div" className={isSplitView ? 'col-xs-6 split padding-0 split-appear' : 'col-xs-6 padding-0'} sx={{boxShadow: 'none', p: 0, backgroundColor: WHITE, borderRadius: '10px', border: 'solid 0.3px', borderColor: 'surface.nv80', opacity: isSplitView ? 1 : 0, height: 'calc(100vh - 100px) !important', overflow: 'auto'}}>
        {
          configure && file?.name ?
            <div className='col-xs-12'>
              {getConfigurationForm()}
            </div> :
          (
            rowIndex !== undefined ?
            <>
              <div className='col-xs-12' style={{padding: '8px 16px', minWidth: '500px'}}>
                <div className='col-xs-12 padding-0' style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
                  <Typography component='span' sx={{fontSize: '20px', color: 'surface.dark', fontWeight: 600}}>
                    {t('map_project.mapping_decisions')}
                    <Chip sx={{padding: '0 6px', marginLeft: '12px'}} size='small' variant='outlined' {...VIEWS[getStateFromIndex(rowIndex)]} label={t('map_project.view_' + getStateFromIndex(rowIndex).toLowerCase())} />
                  </Typography>
                  <CloseIconButton color='secondary' onClick={onCloseDecisions} />
                </div>
                <MappingDecisionResult
                  conceptCache={conceptCache}
                  candidatesScore={candidatesScore}
                  targetConcept={targetConcept}
                  setShowHighlights={setShowHighlights}
                  repoVersion={repoVersion}
                  row={row}
                  rowIndex={rowIndex}
                  repo={repo}
                  mapTypes={mapTypes}
                  allMapTypes={allMapTypes}
                  onMap={onMap}
                  proposed={proposed[rowIndex]}
                  columns={columns}
                  onTargetClick={setShowItem}
                />
                <Divider sx={{width: '100%'}} />
                <DecisionSelector
                  selected={decisions[rowIndex]}
                  onChange={onDecisionChange}
                  disabledMap={!mapSelected[rowIndex]}
                  disabledPropsed={!proposed[rowIndex]?.id}
                />
                <Divider sx={{width: '100%'}} />
                <ReviewNote
                  value={notes[rowIndex]}
                  onChange={event => setNotes({...notes, [rowIndex]: event.target.value || ''})}
                />
                <div className='col-xs-12' style={{padding: '0 0 8px 78px'}}>
                  <Button size='small' disabled={rowStatuses.reviewed.includes(rowIndex) || decisions[rowIndex] === 'none' || !decisions[rowIndex]} color='primary' onClick={() => onReviewDone(true)} variant='contained' sx={{textTransform: 'none'}}>
                    {t('map_project.approve_and_next')}
                  </Button>
                  <Button size='small' disabled={rowStatuses.reviewed.includes(rowIndex) || decisions[rowIndex] === 'none' || !decisions[rowIndex]} color='primary' onClick={() => onReviewDone(false)} variant='outlined' sx={{textTransform: 'none', marginLeft: '8px'}}>
                    {t('map_project.approve')}
                  </Button>
                  <Button size='small' disabled={decisions[rowIndex] === 'none' || !decisions[rowIndex]} color='error' onClick={(event) => onDecisionChange(event, 'rejected')} variant='outlined' sx={{textTransform: 'none', marginLeft: '8px'}}>
                    {t('map_project.reject')}
                  </Button>
                </div>
                <Divider sx={{width: '100%'}} />
                <div className='col-xs-12 padding-0'>
                  <Tabs
                    variant='fullWidth'
                    value={decisionTab}
                    onChange={onDecisionTabChange}
                  >
                    {
                      DECISION_TABS.map(_tab => {
                        return (
                          <Tab
                            sx={{padding: '2px 6px !important', textTransform: 'none', fontWeight: 'bold'}}
                            value={_tab}
                            key={_tab}
                            label={t('map_project.decision_tab_' + _tab)}
                          />
                        )
                      })
                    }
                  </Tabs>
                </div>
                {
                  decisionTab === 'propose' && isSplitView &&
                    <Propose
                      onChange={onProposedUpdate}
                      proposed={proposed[rowIndex]}
                      onSubmit={(event, state) => {
                        if(state)
                          setProposed(prev => ({...prev, [rowIndex]: {...state}}))
                        onDecisionChange(event, 'propose')
                      }}
                      repo={repoVersion || repo}
                      row={row}
                      columns={columns}
                    />
                }
                {
                  decisionTab === 'candidates' && isSplitView &&
                    <Candidates
                      candidatesScore={candidatesScore}
                      rowIndex={rowIndex}
                      rowStage={rowStageRef.current[rowIndex]}
                      alert={alert}
                      setAlert={setAlert}
                      rowState={rowMatchStateRef.current[rowIndex]}
                      conceptCache={conceptCache}
                      targetCanonical={buildProjectContext()?.target_repo?.canonical_url}
                      setShowItem={setShowItem}
                      showItem={showItem}
                      setShowHighlights={setShowHighlights}
                      isSelectedForMap={isSelectedForMap}
                      onMap={onMap}
                      isLoading={isLoadingInDecisionView}
                      onFetchMore={onFetchMoreCandidates}
                      repoVersion={repoVersion}
                      onFetchRecommendation={fetchRecommendation}
                      analysis={analysis[rowIndex]}
                      columns={getValidColumns()}
                      facets={getFacetsForRow(rowIndex)}
                      appliedFacets={appliedFacets[rowIndex]}
                      defaultFilters={getAppliedFacetFromQueryParam(getFilters())}
                      filters={getFilters(rowIndex)}
                      setAppliedFacets={(filters) => {
                        setAppliedFacets(() => ({...appliedFacets, [rowIndex]: filters}))
                        fetchAllCandidatesForRow(null, 0, false, false, filters, true)
                      }}
                      locales={filters.locale || ''}
                      models={AIModels}
                      selectedModel={AIModel}
                      onModelChange={setAIModel}
                      promptTemplates={promptTemplates}
                      promptTemplate={promptTemplate}
                      onPromptTemplateChange={onPromptTemplateChange}
                      onRefreshClick={onRefreshClick}
                      inAIAssistantGroup={inAIAssistantGroup}
                      algosSelected={algosSelected}
                      isCoreUser={isCoreUser}
                    />
                }
                {
                  decisionTab === 'search' && isSplitView &&
                    <Search
                      rowIndex={rowIndex}
                      onSearch={search}
                      repo={repo}
                      repoVersion={repoVersion}
                      concepts={searchedConcepts[rowIndex]}
                      response={searchResponse}
                      setShowItem={setShowItem}
                      showItem={showItem}
                      isSelectedForMap={isSelectedForMap}
                      onMap={onMap}
                      searchStr={searchStr}
                      setSearchStr={setSearchStr}
                      isLoading={isLoadingInDecisionView}
                      columns={getValidColumns()}
                      facets={getFacetsForRow(rowIndex)}
                      appliedFacets={appliedFacets[rowIndex]}
                      defaultFilters={getAppliedFacetFromQueryParam(getFilters())}
                      filters={getFilters()}
                      setAppliedFacets={(filters) => {
                        setAppliedFacets({...appliedFacets, [rowIndex]: filters})
                        search(null, null, null, null, filters)
                      }}
                      locales={filters.locale || ''}
                    />
                }
                {
                  decisionTab === 'discuss' && isSplitView &&
                    <Discuss logs={logs[rowIndex]} onAdd={comment => comment ? log({action: 'commented', description: comment}) : null} />
                }
              </div>
              <SearchHighlightsDialog
                open={Boolean(showHighlights)}
                onClose={() => setShowHighlights(false)}
                concept={showHighlights}
                rawScores={getRawScoresForConcept(rowIndex, showHighlights)}
                candidatesScore={candidatesScore}
              />
            </> :
              <ProjectLogs open={showProjectLogs} onClose={() => setShowProjectLogs(false) } logs={projectLogs} project={project} />
          )
        }
    </Paper>
    </Split>
      {
        deleteProject && project?.id &&
          <MapProjectDeleteConfirmDialog open={deleteProject} onClose={() => setDeleteProject(false)} project={project} />
      }
      {
        showItem?.id &&
          <Dialog
            PaperComponent={DraggablePaperComponent}
            aria-labelledby="draggable-dialog-title"
            disableEscapeKeyDown
            open
            onClose={() => setShowItem(false)}
            scroll='paper'
            maxWidth='sm'
            fullWidth
            sx={{
              '& .MuiDialog-paper': {
                borderRadius: '28px',
                padding: 0,
              }
            }}
          >
            <ConceptHome
              style={{borderRadius: 0}}
              detailsStyle={{height: 'calc(100vh - 400px)'}}
              repo={showItem.source === (repoVersion?.short_code || repoVersion?.id) ? repoVersion : null}
              url={showItem.url}
              concept={showItem}
              onClose={() => setShowItem(false)}
              onMap={onMap}
              isSelectedForMap={isSelectedForMap}
            />
          </Dialog>
      }

      <ImportToCollection
        onImport={onImport}
        rowStatuses={rowStatuses}
        open={openImportToCollection}
        onClose={() => setOpenImportToCollection(false)}
      />
    </div>
  )
}

export default MapProject;
