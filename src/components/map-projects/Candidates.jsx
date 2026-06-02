/*eslint no-process-env: 0*/

import React from 'react'
import { useTranslation } from 'react-i18next';
import Alert from '@mui/material/Alert';
import Collapse from '@mui/material/Collapse';
import IconButton from '@mui/material/IconButton'
import ListSubheader from '@mui/material/ListSubheader';
import List from '@mui/material/List';
import Menu from '@mui/material/Menu';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Button from '@mui/material/Button'
import Skeleton from '@mui/material/Skeleton'
import Badge from '@mui/material/Badge'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Divider from '@mui/material/Divider'
import Tooltip from '@mui/material/Tooltip'

import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CloseIcon from '@mui/icons-material/Close';
import FilterListIcon from '@mui/icons-material/FilterList';
import RefreshIcon from '@mui/icons-material/Refresh';
import SortIcon from '@mui/icons-material/Sort';
import GroupIcon from '@mui/icons-material/Layers';
import AssistantIcon from '@mui/icons-material/Assistant';

import isEmpty from 'lodash/isEmpty'
import flatten from 'lodash/flatten'
import values from 'lodash/values'
import without from 'lodash/without'
import orderBy from 'lodash/orderBy'
import map from 'lodash/map'
import times from 'lodash/times'

import { highlightTexts } from '../../common/utils';
import { PRIMARY_COLORS } from '../../common/colors'
import { SCORES_COLOR } from './constants'
import SearchResults from '../search/SearchResults';
import SearchFilters from '../search/SearchFilters'
import NoResults from '../search/NoResults';
import Mappings from './Mappings'
import Concept from './Concept'
import ConceptIcon from '../concepts/ConceptIcon'
import MapButton from './MapButton'
import AICandidatesAnalysis from './AICandidatesAnalysis'
import AIAssistantButton from './AIAssistantButton'
import {
  buildAlgorithmRowViews,
  getOrphanAlgorithmIds,
  buildQualityRowViews,
  conceptBelongsToTargetRepo,
  sortRowViews,
  conceptForMapping,
  resolveAICandidateID
} from './viewBuilders.js'

const getRowProgressLabel = (stageMap, algos) => {
  if(stageMap === undefined)
    return {label: false}
  if(!stageMap)
    return {label: 'Preparing...', status: 'partial'}

  const stages = algos.map(k => stageMap[k.id]);

  if (!stages.length || stages.every(v => v === -1)) {
    return { label: 'Not started', status: 'idle' };
  }

  const runningIndex = stages.findIndex(v => v === 0);
  if (runningIndex !== -1) {
    return {
      label: `Running: ${algos[runningIndex].id}...`,
      status: 'running',
    };
  }

  if (stages.every(v => v === 1)) {
    return true
  }

  const waitingIndex = stages.findIndex(v => v === -1)
  if(waitingIndex !== -1) {
    return {label: `Waiting: ${algos[waitingIndex].id}`, status: 'waiting'} // AutoMatch Bulk
  }

  return { label: 'Partially completed', status: 'partial' };
}

const Sort = ({ selected, onSort }) => {
  const { t } = useTranslation();
  const [anchorEl, setAnchorEl] = React.useState(false)
  const onSortClick = event => setAnchorEl(event.currentTarget)
  const onClick = option => {
    setAnchorEl(false)
    onSort(option)
  }

  return (
    <>
      <Tooltip title={t('map_project.sort_candidates')}>
        <IconButton color='secondary' onClick={onSortClick} sx={{margin: '0 4px'}}>
        <SortIcon />
        </IconButton>
        </Tooltip>
      <Menu
      anchorEl={anchorEl}
      open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(false)}
      sx={{'.MuiPaper-root': {backgroundColor: 'surface.n94'}}}
      >
        <ListItemButton id='sort_by_unified' sx={{padding: '4px 10px', '&:hover': {color: 'inherit'}, '&:focus': {outline: 'none', textDecoration: 'none', color: 'inherit'}}} onClick={() => onClick('rerank_score')} selected={selected === 'rerank_score'}>
          <ListItemText primary={t('map_project.sort_by_unified_score')} />
        </ListItemButton>
        <ListItemButton id='sort_by_raw_score' sx={{padding: '4px 10px', '&:hover': {color: 'inherit'}, '&:focus': {outline: 'none', textDecoration: 'none', color: 'inherit'}}} onClick={() => onClick('algo_score')} selected={selected === 'algo_score'}>
          <ListItemText primary={t('map_project.sort_by_raw_algo_score')} />
        </ListItemButton>
        <Divider />
        <ListItemButton id='sort_by_id' sx={{padding: '4px 10px', '&:hover': {color: 'inherit'}, '&:focus': {outline: 'none', textDecoration: 'none', color: 'inherit'}}} onClick={() => onClick('id')} selected={selected === 'id'}>
          <ListItemText primary={t('map_project.concept_id')} />
        </ListItemButton>
        <ListItemButton id='sort_by_name' sx={{padding: '4px 10px', '&:hover': {color: 'inherit'}, '&:focus': {outline: 'none', textDecoration: 'none', color: 'inherit'}}} onClick={() => onClick('display_name')} selected={selected === 'display_name'}>
          <ListItemText primary={t('concept.display_name')} />
        </ListItemButton>
    </Menu>
    </>
  )
}

const Group = ({ selected, onGroup, hasAIAnalysis }) => {
  const { t } = useTranslation();
  const [anchorEl, setAnchorEl] = React.useState(false)
  const onGroupClick = event => setAnchorEl(event.currentTarget)
  const onClick = option => {
    setAnchorEl(false)
    onGroup(option)
  }

  return (
    <>
      <Tooltip title={t('map_project.group_candidates')}>
        <IconButton color='secondary' onClick={onGroupClick} sx={{margin: '0 4px'}}>
        <GroupIcon />
      </IconButton>
        </Tooltip>

      <Menu
      anchorEl={anchorEl}
      open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(false)}
      sx={{'.MuiPaper-root': {backgroundColor: 'surface.n94'}}}
      >
        <ListItemButton id='group_by_quality' sx={{padding: '4px 10px', '&:hover': {color: 'inherit'}, '&:focus': {outline: 'none', textDecoration: 'none', color: 'inherit'}}} onClick={() => onClick('quality')} selected={selected === 'quality'}>
          <ListItemText primary={t('map_project.group_by_match_quality')} />
        </ListItemButton>
        <ListItemButton id='group_by_algorithm' sx={{padding: '4px 10px', '&:hover': {color: 'inherit'}, '&:focus': {outline: 'none', textDecoration: 'none', color: 'inherit'}}} onClick={() => onClick('algorithm')} selected={selected === 'algorithm'}>
          <ListItemText primary={t('map_project.algorithm')} />
        </ListItemButton>
        {
          hasAIAnalysis &&
            <ListItemButton id='group_by_ai_analysis' sx={{padding: '4px 10px', '&:hover': {color: 'inherit'}, '&:focus': {outline: 'none', textDecoration: 'none', color: 'inherit'}}} onClick={() => onClick('ai_analysis')} selected={selected === 'ai_analysis'}>
              <ListItemText primary={t('map_project.group_by_ai_analysis')} />
            </ListItemButton>
        }
    </Menu>
    </>
  )
}

const SubHeader = ({count, onClick, isCollapsed, header, indicatorColor, indicatorIcon, isFirst}) => {
  return (
    <ListSubheader sx={{lineHeight: '28px', padding: '2px 8px', display: 'inline-flex', justifyContent: 'space-between', width: '100%', color: '#000', fontSize: '12px', borderBottom: '2px solid', cursor: 'pointer', alignItems: 'center', opacity: count === 0 ? 0.5 : 1, marginTop: isFirst ? 0 : '16px'}} onClick={count === 0 ? undefined : onClick}>
      <span style={{display: 'flex', alignItems: 'center'}}>
        {
          isCollapsed ?
            <ExpandMoreIcon fontSize='small' sx={{marginRight: '4px'}} /> :
          <ExpandLessIcon fontSize='small' sx={{marginRight: '4px'}} />
        }
        {
          indicatorIcon || indicatorColor ?
            (
              indicatorIcon || <ConceptIcon fontSize='small' selected sx={{fill: indicatorColor, fontSize: '0.85rem', marginRight: '6px'}} />
            ) :
          null
        }
        <b>{header}</b>
      </span>
      <span className="tag-count-label--count" style={{backgroundColor: PRIMARY_COLORS['90'], fontSize: '12px', height: '22px'}}>
        {count.toLocaleString()}
      </span>
    </ListSubheader>
  )
}


const CandidateList = ({rowViews, header, rowIndex, sortBy, order, setShowItem, showItem, setShowHighlights, isSelectedForMap, onMap, onFetchMore, bgColor, headerIndicatorIcon, bucketId, display, onDisplayChange, noToolbar, toolbarControl, repoVersion, alignToolbarLeft, rightControl, analysis, showAnalysis, openAnalysis, onCloseAnalysis, isInProgress, AIRecommendedCandidateId, AIAlternateCandidateIds, locales, scispacy, showAlgo, collapsed, onCollapse, candidatesScore, algoScoreFirst, byAlgorithm, showEmptyHeader, isFirst, isCoreUser, targetCanonical, targetRelativeUrl, analysisPage, setAnalysisPage}) => {
  // Decorate rowViews so they work for BOTH renderers:
  //   - Table view: SearchResults/TableResults reads legacy concept fields
  //     (id, url, names, descriptions, source, search_meta, ...) via the
  //     ALL_COLUMNS['concepts'] paths. Spread conceptForMapping first so
  //     those fields exist at top level.
  //   - Card view: the renderer reads candidate/conceptDefinition/conceptRow.
  //     Spread the rowView after legacy so the tuple fields survive.
  //   - Click lookup: SearchResults.handleRowClick uses
  //     `row.version_url || row.url || row.id`. Set those explicitly at the
  //     end so neither earlier spread can clobber them.
  const rowsForTable = (rowViews || []).map(view => {
    const legacy = conceptForMapping(view) || {}
    const def = view?.conceptDefinition
    const idForLookup = legacy.id || def?.ocl_url || def?.reference?.code
    return {
      ...legacy,
      ...view,
      id: idForLookup,
      url: legacy.url || def?.ocl_url,
      version_url: legacy.url || def?.ocl_url
    }
  })
  // Helper: a rowView is mappable only when its concept belongs to the
  // project's target repo (cascade targets in bridge flows DO; bridge
  // intermediaries don't). The comparison uses canonical URL in the
  // common case, but also tolerates canonical drift via the OCL
  // relative-URL fallback.
  const isTargetRepoView = (view) => {
    if(!targetCanonical && !targetRelativeUrl) return true
    return conceptBelongsToTargetRepo(view?.conceptDefinition, targetCanonical, targetRelativeUrl)
  }
  const results = {total: onFetchMore ? rowsForTable.length : 1, results: rowsForTable}
  const isCollapsed = collapsed.includes(bucketId)
  const onCollapseToggle = () => {
    onCollapse(isCollapsed ? without(collapsed, bucketId): [...collapsed, bucketId])
  }

  const getExtraColumns = () => {
    let cols = [
      {
        sortable: false,
        id: 'mappings',
        labelKey: 'common.action',
        align: 'center',
        renderer: rowView => {
          // Map action only renders for target-repo concepts. Bridge
          // intermediaries (CIEL when target is ICD/LOINC) are reference
          // metadata about the cascade — they're not mappable themselves.
          if(!isTargetRepoView(rowView)) return null
          const conceptToMap = conceptForMapping(rowView)
          return (
            <MapButton
              simple
              selected={rowView?.candidate?.map_type}
              onClick={(event, applied, mapType) => onMap(event, conceptToMap, !applied, mapType)}
              isMapped={isSelectedForMap(conceptToMap)}
              sx={{marginLeft: '8px'}}
            />
          )
        },
      },
    ]
    if(display === 'card')
      cols = [
        {
          sortable: false,
          id: 'mappings',
          labelKey: 'mapping.same_as_mappings',
          renderer: rowView => {
            // Bridge mappings panel: list bridge_children as cascade-style
            // mappings. For non-bridge rows the panel is empty.
            const bridgeChildren = rowView?.bridgeChildren || []
            if(!bridgeChildren.length) return null
            const synthetic = {
              mappings: bridgeChildren.map(child => ({
                map_type: child.candidate?.map_type,
                cascade_target_source_name: child.conceptDefinition?.source,
                cascade_target_concept_name: child.conceptDefinition?.display_name,
                to_concept_code: child.conceptDefinition?.id || child.conceptDefinition?.reference?.code
              }))
            }
            return <Mappings item={synthetic} />
          },
        },
        ...cols
      ]
    return cols
  }
  const count = rowViews.length
  const showHeader = byAlgorithm || showEmptyHeader || count > 0
  return (
    <ul>
      <SearchResults
        id={rowIndex}
        resultSize='small'
        sx={{
          borderRadius: '10px 10px 0 0',
          '.MuiTableCell-root': {
            padding: '6px !important',
            verticalAlign: 'top',
          },
          '.MuiTableCell-head': {
            padding: '2px 6px !important',
            whiteSpace: 'normal',
            verticalAlign: 'middle',
          },
          '.MuiToolbar-root': {
            borderRadius: '10px 10px 0 0',
          }
        }}
        subheader={
          (showAnalysis && openAnalysis) ? (
            <div className='col-xs-12 padding-0' style={{display: 'inline-flex', flexDirection: 'column'}}>
              <AICandidatesAnalysis
                analysis={analysis}
                onClose={onCloseAnalysis}
                sx={{marginBottom: '4px'}}
                isCoreUser={isCoreUser}
                isInProgress={isInProgress}
                page={analysisPage}
                onPageChange={setAnalysisPage}
              />
              {
                showHeader &&
                  <SubHeader count={count} onClick={onCollapseToggle} isCollapsed={isCollapsed} header={header} indicatorColor={bgColor} indicatorIcon={headerIndicatorIcon} isFirst={isFirst} />
              }
            </div>
          ) :
            (
              showHeader &&
                <SubHeader count={count} onClick={onCollapseToggle} isCollapsed={isCollapsed} header={header} indicatorColor={bgColor} indicatorIcon={headerIndicatorIcon} isFirst={isFirst} />
            )
        }
        title=' '
        renderer={props => {
          const rowView = props?.concept
          const key = `${bucketId}-${rowView?.candidate?.id || rowView?.conceptDefinition?.key}-${Math.random(100).toString()}`
          return <Concept
            {...props}
            _id={`${bucketId}-${rowView?.candidate?.id || rowView?.conceptDefinition?.key}`}
            key={key}
            onMap={onMap}
            isSelectedForMap={isSelectedForMap}
            setShowHighlights={setShowHighlights}
            repoVersion={repoVersion}
            AIRecommendedCandidateId={AIRecommendedCandidateId}
            AIAlternateCandidateIds={AIAlternateCandidateIds}
            locales={locales}
            notClickable={Boolean(scispacy)}
            showAlgo={showAlgo}
            candidatesScore={candidatesScore}
            algoScoreFirst={algoScoreFirst}
            targetCanonical={targetCanonical}
            targetRelativeUrl={targetRelativeUrl}
          />
        }}
        display={display}
        onDisplayChange={onDisplayChange}
        nested
        results={isCollapsed ? [] : results}
        resource='concepts'
        noPagination
        noSorting
        noHeader={noToolbar}
        noToolbar={noToolbar}
        toolbarControl={toolbarControl}
        alignToolbarLeft={alignToolbarLeft}
        rightControl={rightControl}
        orderBy={sortBy}
        order={order}
        resultContainerStyle={{height: 'auto', '.MuiTable-root': {tableLayout: 'fixed'}}}
        onShowItemSelect={rowView => {
          setShowItem(conceptForMapping(rowView))
          setTimeout(() => {
            highlightTexts([rowView?.conceptDefinition], null, false)
          }, 100)
        }}
        selectedToShow={showItem}
        extraColumns={getExtraColumns()}
        properties={repoVersion?.meta?.display?.concept_summary_properties}
        propertyFilters={repoVersion?.filters}
        repoDefaultFilters={repoVersion?.meta?.display?.default_filter}
      />
    </ul>
  )
}

// Candidates reads exclusively from the unified-model state:
//   rowState     — RowState for `rowIndex` (algorithm_responses, candidates,
//                  concept_rows). Provided by MapProject via
//                  rowMatchStateRef.current[rowIndex].
//   conceptCache — project-wide ConceptDefinition store, keyed by concept_key.
//   algosSelected — algorithm definitions (for headers/grouping).
// (plans/unified-mapper-model.md "How the views map onto this model".)
const Candidates = ({rowIndex, alert, setAlert, rowState, conceptCache, targetCanonical, targetRelativeUrl, setShowItem, showItem, setShowHighlights, isSelectedForMap, onMap, onFetchMore, isLoading, candidatesScore, repoVersion, analysis, onFetchRecommendation, appliedFacets, setAppliedFacets, filters, facets, columns, defaultFilters, locales, models, selectedModel, onModelChange, promptTemplates, promptTemplate, onPromptTemplateChange, onRefreshClick, rowStage, inAIAssistantGroup, algosSelected, isCoreUser}) => {
  const { t } = useTranslation();
  const [sortBy, setSortBy] = React.useState('rerank_score')
  const [groupBy, setGroupBy] = React.useState('quality')
  const [collapsed, setCollapsed] = React.useState([`${rowIndex}-low-ranked`])
  const [openFilters, setOpenFilters] = React.useState(false)
  const [display, setDisplay] = React.useState('card')
  const [openAIAnalysis, setOpenAIAnalysis] = React.useState(undefined)
  const [analysisPage, setAnalysisPage] = React.useState(0)
  const recommendedScore = candidatesScore?.recommended
  const availableScore = candidatesScore?.available
  const analysisArray = Array.isArray(analysis) ? analysis : (analysis ? [analysis] : [])
  const analysisCount = analysisArray.length
  // Resolve the AI-recommended candidate against conceptCache: prefer the
  // v2 concept_key passthrough, then canonical_reference.code (PR2a shim),
  // then the legacy concept_id/id. The resolved code is matched against
  // ConceptDefinition.reference.code in Concept.jsx for highlighting.
  const isRecommendInProgress = rowStage?.recommend === 0
  const prevAnalysisCountRef = React.useRef(0)
  const prevIsInProgressRef = React.useRef(false)
  React.useEffect(() => {
    if(analysisCount > prevAnalysisCountRef.current)
      setAnalysisPage(Math.max(0, analysisCount - 1))
    else if(isRecommendInProgress && !prevIsInProgressRef.current)
      setAnalysisPage(analysisCount)
    else if(!isRecommendInProgress && prevIsInProgressRef.current)
      setAnalysisPage(page => Math.min(page, Math.max(0, analysisCount - 1)))
    prevAnalysisCountRef.current = analysisCount
    prevIsInProgressRef.current = isRecommendInProgress
  }, [analysisCount, isRecommendInProgress])
  React.useEffect(() => {
    setAnalysisPage(analysisCount > 0 ? analysisCount - 1 : 0)
  }, [rowIndex, analysisCount])
  React.useEffect(() => {
    if(groupBy === 'ai_analysis' && analysisCount === 0)
      setGroupBy('quality')
  }, [analysisCount, groupBy])
  const selectedAnalysis = isRecommendInProgress && analysisPage >= analysisCount
    ? undefined
    : analysisArray[analysisPage]
  const selectedAnalysisForGrouping = selectedAnalysis || analysisArray[analysisCount - 1]
  const primary = selectedAnalysis?.output?.primary_candidate || selectedAnalysis?.primary_candidate
  const AIRecommendedCandidateId = resolveAICandidateID(primary, conceptCache)
  const alternateCandidates = selectedAnalysis?.output?.alternative_candidates || selectedAnalysis?.alternative_candidates || []
  const AIAlternateCandidateIds = [...new Set(alternateCandidates
    .map(candidate => resolveAICandidateID(candidate, conceptCache))
    .filter(id => id && id !== AIRecommendedCandidateId))]
  const groupedAnalysisPrimaryId = resolveAICandidateID(
    selectedAnalysisForGrouping?.output?.primary_candidate || selectedAnalysisForGrouping?.primary_candidate,
    conceptCache
  )
  const groupedAnalysisAlternateIds = [...new Set(
    (selectedAnalysisForGrouping?.output?.alternative_candidates || selectedAnalysisForGrouping?.alternative_candidates || [])
      .map(candidate => resolveAICandidateID(candidate, conceptCache))
      .filter(id => id && id !== groupedAnalysisPrimaryId)
  )]

  // Quality (score-grouped) view shows ONLY target-repo concepts. Bridge
  // intermediaries live in algorithm view as metadata-about-the-target;
  // surfacing them in Quality view double-counts and confuses the bucketing.
  // Algorithm view (buildAlgorithmRowViews) keeps the full mix for
  // by-algorithm browsing.
  const qualityRowViews = React.useMemo(() => {
    const views = buildQualityRowViews(rowState, conceptCache)
    if(!targetCanonical && !targetRelativeUrl) return views
    return views.filter(v => conceptBelongsToTargetRepo(v.conceptDefinition, targetCanonical, targetRelativeUrl))
  }, [rowState, conceptCache, targetCanonical, targetRelativeUrl])
  const hasAnyView = qualityRowViews.length > 0
  const isNoneLoaded = !rowState || (isEmpty(rowState.candidates) && isEmpty(rowState.algorithm_responses))
  const canFetchMore = hasAnyView
  const algoStagesValue = values(rowStage || {}).filter((_, i) => Object.keys(rowStage || {})[i] !== 'recommend')
  const areAlgoRun = algoStagesValue.length > 0 && algoStagesValue.every(v => v === 1)
  const { label } = getRowProgressLabel(rowStage, algosSelected);

  const byAlgoScore = sortBy === 'algo_score'
  const byRerankScore = sortBy === 'rerank_score'
  const byScore = byAlgoScore || byRerankScore
  const noCandidatesFound = !isLoading && !isNoneLoaded && !hasAnyView && !label
  const algoScoreFirst = byAlgoScore
  const order = byScore ? 'desc' : 'asc'

  const baseProps = {
    rowIndex: rowIndex,
    onMap: onMap,
    isSelectedForMap: isSelectedForMap,
    setShowHighlights: setShowHighlights,
    sortBy: sortBy,
    order: order,
    setShowItem: setShowItem,
    showItem: showItem,
    isLoading: isLoading,
    display: display,
    repoVersion: repoVersion,
    AIRecommendedCandidateId: AIRecommendedCandidateId,
    AIAlternateCandidateIds: AIAlternateCandidateIds,
    locales: locales,
    candidatesScore: candidatesScore,
    algoScoreFirst: algoScoreFirst,
    isCoreUser: isCoreUser,
    targetCanonical: targetCanonical,
    targetRelativeUrl: targetRelativeUrl,
    analysisPage: analysisPage,
    setAnalysisPage: setAnalysisPage
  }

  const onSort = option => {
    // Plain "click to select" — no implicit fallbacks. The previous
    // `option === sortBy` branch silently flipped any same-option click
    // back to 'rerank_score', so re-clicking Raw in algo view kicked
    // the user into Unified mode. Picking Raw still implies the algo
    // view (raw scores aren't comparable across algos in the Quality
    // grouping), so that side-effect stays.
    if(!option) return
    setSortBy(option)
    if(option === 'algo_score' && groupBy !== 'algorithm')
      setGroupBy('algorithm')
  }

  const onRecommend = () => {
    setOpenAIAnalysis(true)
    onFetchRecommendation()
  }

  const onGroup = option => {
    setGroupBy(option)
    if(option === 'algorithm')
      setSortBy('algo_score')
    if(!option || option === 'quality' || option === 'ai_analysis')
      setSortBy('rerank_score')
  }

  const getCandidates = () => {
    if(groupBy === 'algorithm') {
      const sortedAlgos = orderBy(
        algosSelected.map(algo => {
          const views = buildAlgorithmRowViews(rowState, conceptCache, algo.id)
          return { algo, views, hasCandidates: views.length > 0 }
        }),
        ['hasCandidates', 'algo.order'],
        ['desc', 'asc']
      )
      // A candidate's algorithm_id can fall outside the project's configured
      // algorithms[] — the project was reconfigured after running algorithms,
      // or the PR3-C v1->v2 migration tagged it with an id that isn't current.
      // These "orphan-algo" candidates already show in the quality view and the
      // AI payload (both gated by target-repo membership, never by
      // algorithm_id), but the by-algorithm grouping above only iterates the
      // configured algos — so they'd appear in no bucket here. Surface one
      // bucket per orphan id, after all configured algos. Like the configured
      // buckets, these keep the by-algo "full mix" (no target-repo filter);
      // per-row mappability stays gated downstream as before.
      const orphanAlgos = getOrphanAlgorithmIds(rowState, algosSelected.map(a => a.id)).map(id => ({
        algo: { id, name: t('map_project.unrecognized_algorithm'), order: Infinity },
        views: buildAlgorithmRowViews(rowState, conceptCache, id)
      }))
      return {
        byAlgoCandidates: [...sortedAlgos, ...orphanAlgos].map(({algo, views}) => ({
          algo,
          // Sort the top-level (bridge intermediaries and standard candidates)
          // and, for each bridge, sort its nested cascade targets by the same
          // key/order so the children's order tracks the parent rule. Bridge
          // children don't have their own raw score; sorting by algo_score
          // leaves them in insertion order via sortRowViews' -1 sentinel.
          candidates: sortRowViews(views, sortBy, order).map(view => (
            view.type === 'bridge' && view.bridgeChildren?.length
              ? { ...view, bridgeChildren: sortRowViews(view.bridgeChildren, sortBy, order) }
              : view
          ))
        }))
      }
    }
    if(groupBy === 'ai_analysis') {
      const sorted = sortRowViews(qualityRowViews, 'rerank_score', 'desc')
      const primaryCandidate = []
      const alternateCandidates = []
      const rest = []
      sorted.forEach(view => {
        const code = view?.conceptDefinition?.reference?.code
        if(groupedAnalysisPrimaryId && code === groupedAnalysisPrimaryId) {
          primaryCandidate.push(view)
          return
        }
        if(groupedAnalysisAlternateIds.includes(code)) {
          alternateCandidates.push(view)
          return
        }
        rest.push(view)
      })
      return { primaryCandidate, alternateCandidates, rest }
    }
    let recommended = []
    let available = []
    let lowRanked = []
    let pendingRerank = []
    sortRowViews(qualityRowViews, sortBy, order).forEach(view => {
      const score = view.conceptRow?.rerank_score
      if(byScore) {
        // Bucket on score presence first: unscored rows belong in their
        // own "pending rerank" group — not in low_ranked. Falling them
        // into low_ranked (the prior `score || 0` behavior) mis-implied
        // they were poor matches; they're simply not ranked yet. Rerank
        // landing will re-bucket them naturally on the next render.
        if(typeof score !== 'number') pendingRerank.push(view)
        else if(score >= recommendedScore) recommended.push(view)
        else if(score >= availableScore) available.push(view)
        else lowRanked.push(view)
      } else {
        available.push(view)
      }
    })
    return { recommended, available, lowRanked, pendingRerank }
  }

  const { byAlgoCandidates, recommended, available, lowRanked, pendingRerank, primaryCandidate, alternateCandidates: aiAlternateCandidates, rest } = getCandidates()
  const aiPrimaryBucketId = `${rowIndex}-ai-primary`
  const aiAlternatesBucketId = `${rowIndex}-ai-alternates`
  const aiRestBucketId = `${rowIndex}-ai-rest`
  const hasAIPrimaryCandidates = (primaryCandidate || []).length > 0
  const hasAIAlternateCandidates = (aiAlternateCandidates || []).length > 0

  React.useEffect(() => {
    if(groupBy !== 'ai_analysis') return
    setCollapsed(prev => {
      const withoutAIBuckets = prev.filter(id => ![aiPrimaryBucketId, aiAlternatesBucketId, aiRestBucketId].includes(id))
      const nextCollapsed = [...withoutAIBuckets]
      if(hasAIPrimaryCandidates || hasAIAlternateCandidates)
        nextCollapsed.push(aiRestBucketId)
      return nextCollapsed
    })
  }, [groupBy, rowIndex, hasAIPrimaryCandidates, hasAIAlternateCandidates])

  const getRightControls = () => {
      return (
        <span style={{display: 'flex', alignItems: 'center'}}>
          {
            !areAlgoRun && label &&
              <Chip icon={<CircularProgress sx={{width: '14px !important', height: '14px !important', marginLeft: '6px !important', marginRight: '0px !important'}} />} variant='outlined' color='warning' size='small' label={label} sx={{margin: '0 8px'}} />
          }
          {
            // Refresh stays visible even when there are zero candidates so
            // the user can retry an algorithm that errored out (e.g. scispacy
            // returns 503 during its 2-5 min cold-start; previously the
            // toolbar disappeared and the row had no recovery path).
            // Group/Sort only render when there are candidates to organize.
          }
          <Tooltip title={t('map_project.refresh_candidates_tooltip')}>
            <span>
              <IconButton color='secondary' onClick={onRefreshClick} disabled={!areAlgoRun} size='small' sx={{margin: '0 4px'}}>
                <RefreshIcon />
              </IconButton>
            </span>
          </Tooltip>
          {
            !noCandidatesFound &&
              <>
                <Group onGroup={onGroup} selected={groupBy} hasAIAnalysis={analysisCount > 0} />
                {
                  groupBy !== 'ai_analysis' &&
                    <Sort onSort={onSort} selected={sortBy} />
                }
              </>
          }
          {
            inAIAssistantGroup &&
              <AIAssistantButton
                models={models}
                selected={selectedModel}
                onClick={onRecommend}
                sx={{margin: '0 8px'}}
                onModelChange={onModelChange}
                promptTemplates={promptTemplates}
                promptTemplate={promptTemplate}
                onPromptTemplateChange={onPromptTemplateChange}
                isCoreUser={isCoreUser}
                hasExistingAnalysis={analysisCount > 0}
                isAnalysisOpen={Boolean(openAIAnalysis)}
                onViewExistingAnalysis={() => setOpenAIAnalysis(true)}
                disabled={!areAlgoRun}
                isInProgress={isRecommendInProgress}
              />
          }
        </span>
      )
  }

  React.useEffect(() => {
    setOpenAIAnalysis(isEmpty(analysis) ? false : (openAIAnalysis !== false))
  }, [rowIndex])

  React.useEffect(() => {
    if(isRecommendInProgress)
      setOpenAIAnalysis(true)
  }, [isRecommendInProgress])


  return (
    <div className='col-xs-12 padding-0'>
      <Collapse in={Boolean(alert?.message)}>
        <Alert
          severity={alert?.severity || 'error'}
          action={
            <Button
              aria-label="close"
              color="inherit"
              size="small"
              onClick={() => setAlert(false)}
            >
              <CloseIcon fontSize="inherit" />
            </Button>
          }
          sx={{ mb: 2 }}
        >
          {alert.message}
        </Alert>
      </Collapse>
    <div className='col-xs-12 padding-0' style={{display: 'flex'}}>
      {
        !isEmpty(facets) &&
          <div className='col-xs-4 padding-0' style={openFilters ? {borderRight: '1px solid lightgray'} : {width: 0, display: 'none'}}>
            <SearchFilters
              open={openFilters}
              resource='concepts'
              filters={facets}
              appliedFilters={appliedFacets || {}}
              onChange={setAppliedFacets}
              repoDefaultFilters={filters}
              defaultFilters={defaultFilters}
              properties={repoVersion?.meta?.display?.concept_summary_properties}
              propertyFilters={repoVersion?.filters}
              heightToSubtract={523}
              columns={columns}
            />
          </div>
      }
      <div className={openFilters ? 'col-xs-8' : 'col-xs-12'} style={{padding: 0, paddingLeft: openFilters ? '8px' : 0}}>
        {
          noCandidatesFound &&
            <NoResults text='We could not find any candidates for this row.' height='300px' />
        }
        <List
          sx={{
            marginTop: '4px',
            width: '100%',
            position: 'relative',
            overflow: 'auto',
            maxHeight: 'calc(100vh - 522px)',
            '& ul': { padding: 0 },
          }}
          subheader={<li />}
          id='candidates-list'
        >
          {
            groupBy === 'quality' &&
              <>
                <li>
              <CandidateList
                {...baseProps}
                rowViews={recommended}
                header={t('map_project.recommended_candidates')}
                onFetchMore={onFetchMore}
                bgColor={SCORES_COLOR.recommended}
                bucketId={`${rowIndex}-recommended`}
                noToolbar={false}
                onDisplayChange={setDisplay}
                toolbarControl={
                  <Button color={(isEmpty(appliedFacets) && !openFilters) ? undefined : 'primary'} sx={{minWidth: 'auto'}} onClick={() => setOpenFilters(!openFilters)} disabled={isEmpty(facets)}>
                    <Badge badgeContent={flatten(values(appliedFacets).map(v => values(v))).length} color='primary'>
                      <FilterListIcon sx={{color: (isEmpty(appliedFacets) && !openFilters) ? '#000': 'primary'}} />
                    </Badge>
                  </Button>
                }
                alignToolbarLeft
                rightControl={getRightControls()}
                analysis={analysis}
                showAnalysis
                openAnalysis={Boolean(openAIAnalysis)}
                onCloseAnalysis={() => setOpenAIAnalysis(false)}
                isInProgress={isRecommendInProgress}
                showAlgo
                collapsed={collapsed}
                onCollapse={setCollapsed}
                candidatesScore={candidatesScore}
                isFirst={recommended.length > 0}
              />
          </li>
          <li>
            {
              (isLoading && isNoneLoaded) ?
                <Skeleton height={60} /> :
              <CandidateList
                {...baseProps}
                rowViews={available}
                header={byScore ? t('map_project.available_candidates') : t('map_project.all_candidates')}
                onFetchMore={onFetchMore}
                bgColor={byScore ? SCORES_COLOR.available : undefined}
                bucketId={`${rowIndex}-available`}
                noToolbar
                showAlgo
                collapsed={collapsed}
                onCollapse={setCollapsed}
                candidatesScore={candidatesScore}
                isFirst={recommended.length === 0 && available.length > 0}
              />
            }
          </li>
          <li>
            {
              (isLoading && isNoneLoaded) ?
                <Skeleton height={60} /> :
              <CandidateList
                {...baseProps}
                rowViews={lowRanked}
                header={t('map_project.low_ranked_candidates')}
                onFetchMore={onFetchMore}
                bgColor={SCORES_COLOR.low_ranked}
                bucketId={`${rowIndex}-low-ranked`}
                noToolbar
                showAlgo
                collapsed={collapsed}
                onCollapse={setCollapsed}
                candidatesScore={candidatesScore}
                isFirst={recommended.length === 0 && available.length === 0 && lowRanked.length > 0}
              />
            }
          </li>
          <li>
            {
              // Transient bucket for candidates whose rerank hasn't landed
              // yet. They reorganize into recommended/available/low_ranked
              // automatically once a numeric rerank_score arrives on their
              // ConceptRow. Neutral gray indicator so it visually reads as
              // "in progress" rather than "poor match".
              pendingRerank.length > 0 &&
                <CandidateList
                  {...baseProps}
                  rowViews={pendingRerank}
                  header={t('map_project.unranked_candidates', 'Unranked Candidates')}
                  onFetchMore={onFetchMore}
                  bgColor={SCORES_COLOR.pending_rerank}
                  bucketId={`${rowIndex}-pending-rerank`}
                  noToolbar
                  showAlgo
                  collapsed={collapsed}
                  onCollapse={setCollapsed}
                  candidatesScore={candidatesScore}
                  isFirst={recommended.length === 0 && available.length === 0 && lowRanked.length === 0}
                />
            }
          </li>
              </>
          }
          {
            groupBy === 'ai_analysis' &&
              <>
                <li>
                  <CandidateList
                    {...baseProps}
                    rowViews={primaryCandidate || []}
                    header={t('map_project.primary_candidate')}
                    headerIndicatorIcon={<AssistantIcon color='primary' fontSize='small' sx={{marginRight: '6px', fontSize: '0.95rem'}} />}
                    onFetchMore={onFetchMore}
                    bgColor={SCORES_COLOR.recommended}
                    bucketId={aiPrimaryBucketId}
                    noToolbar={false}
                    onDisplayChange={setDisplay}
                    toolbarControl={
                      <Button color={(isEmpty(appliedFacets) && !openFilters) ? undefined : 'primary'} sx={{minWidth: 'auto'}} onClick={() => setOpenFilters(!openFilters)} disabled={isEmpty(facets)}>
                        <Badge badgeContent={flatten(values(appliedFacets).map(v => values(v))).length} color='primary'>
                          <FilterListIcon sx={{color: (isEmpty(appliedFacets) && !openFilters) ? '#000': 'primary'}} />
                        </Badge>
                      </Button>
                    }
                    alignToolbarLeft
                    rightControl={getRightControls()}
                    analysis={analysis}
                    showAnalysis
                    openAnalysis={Boolean(openAIAnalysis)}
                    onCloseAnalysis={() => setOpenAIAnalysis(false)}
                    isInProgress={isRecommendInProgress}
                    showAlgo
                    showEmptyHeader
                    collapsed={collapsed}
                    onCollapse={setCollapsed}
                    candidatesScore={candidatesScore}
                    isFirst
                  />
                </li>
                <li>
                  <CandidateList
                    {...baseProps}
                    rowViews={aiAlternateCandidates || []}
                    header={t('map_project.alternate_candidates')}
                    headerIndicatorIcon={<AssistantIcon color='warning' fontSize='small' sx={{marginRight: '6px', fontSize: '0.95rem'}} />}
                    onFetchMore={onFetchMore}
                    bgColor={SCORES_COLOR.available}
                    bucketId={aiAlternatesBucketId}
                    noToolbar
                    showAlgo
                    showEmptyHeader
                    collapsed={collapsed}
                    onCollapse={setCollapsed}
                    candidatesScore={candidatesScore}
                  />
                </li>
                <li>
                  <CandidateList
                    {...baseProps}
                    rowViews={rest || []}
                    header={t('map_project.rest')}
                    onFetchMore={onFetchMore}
                    bucketId={aiRestBucketId}
                    noToolbar
                    showAlgo
                    collapsed={collapsed}
                    onCollapse={setCollapsed}
                    candidatesScore={candidatesScore}
                  />
                </li>
              </>
          }
          {
            groupBy === 'algorithm' &&
              (isLoading && isNoneLoaded) ?
              <>
                {
                  times(algosSelected?.length || 1, i => {
                    return <Skeleton key={i} height={60} />
                  })
                }
              </> :
              <>
                {
                  map(
                    byAlgoCandidates, (result, i) => {
                      const algo = result.algo
                      return (
                        <li key={i}>
              <CandidateList
                {...baseProps}
                byAlgorithm
                rowViews={result.candidates || []}
                header={algo.name ? `${algo.name} (${algo.id})` : algo.id}
                onFetchMore={onFetchMore}
                bucketId={`${rowIndex}-${algo.id}`}
                noToolbar={i !== 0}
                isFirst={i === 0}
                bridge={algo.type?.includes('bridge')}
                scispacy={algo.id === 'ocl-scispacy-loinc'}
                collapsed={collapsed}
                onCollapse={setCollapsed}
                candidatesScore={candidatesScore}
                {
                  ...(
                    i === 0 ?
                      {
                        onDisplayChange: setDisplay,
                        toolbarControl: (
                          <Button color={(isEmpty(appliedFacets) && !openFilters) ? undefined : 'primary'} sx={{minWidth: 'auto'}} onClick={() => setOpenFilters(!openFilters)} disabled={isEmpty(facets)}>
                            <Badge badgeContent={flatten(values(appliedFacets).map(v => values(v))).length} color='primary'>
                              <FilterListIcon sx={{color: (isEmpty(appliedFacets) && !openFilters) ? '#000': 'primary'}} />
                            </Badge>
                          </Button>
                        ),
                        alignToolbarLeft: true,
                        rightControl: getRightControls(),
                        analysis: analysis,
                        showAnalysis: true,
                        openAnalysis: Boolean(openAIAnalysis),
                        onCloseAnalysis: () => setOpenAIAnalysis(false),
                        isInProgress: isRecommendInProgress
                      } :
                    {}
                  )
                }
              />
          </li>
                      )
                    }
                  )
                }
              </>
          }
        </List>
        {
          onFetchMore && canFetchMore &&
            <div className='col-xs-12 padding-0' style={{textAlign: 'right', marginTop: '4px'}}>
              <Button disabled={isLoading} size='small' variant='text' sx={{textTransform: 'none'}} onClick={onFetchMore}>
                {isLoading ? t('map_project.fetching') : t('map_project.fetch_more')}
              </Button>
            </div>
        }
      </div>
    </div>
    </div>

  )
}

export default Candidates
