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
  buildQualityRowViews,
  candidateToRowView,
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

const Group = ({ selected, onGroup }) => {
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
    </Menu>
    </>
  )
}

const SubHeader = ({count, onClick, isCollapsed, header, indicatorColor, isFirst}) => {
  return (
    <ListSubheader sx={{lineHeight: '28px', padding: '2px 8px', display: 'inline-flex', justifyContent: 'space-between', width: '100%', color: '#000', fontSize: '12px', borderBottom: '2px solid', cursor: 'pointer', alignItems: 'center', opacity: count === 0 ? 0.5 : 1, marginTop: isFirst ? 0 : '16px'}} onClick={count === 0 ? undefined : onClick}>
      <span style={{display: 'flex', alignItems: 'center'}}>
        {
          isCollapsed ?
            <ExpandMoreIcon fontSize='small' sx={{marginRight: '4px'}} /> :
          <ExpandLessIcon fontSize='small' sx={{marginRight: '4px'}} />
        }
        {
          indicatorColor &&
            <ConceptIcon fontSize='small' selected sx={{fill: indicatorColor, fontSize: '0.85rem', marginRight: '6px'}} />
        }
        <b>{header}</b>
      </span>
      <span className="tag-count-label--count" style={{backgroundColor: PRIMARY_COLORS['90'], fontSize: '12px', height: '22px'}}>
        {count.toLocaleString()}
      </span>
    </ListSubheader>
  )
}


const CandidateList = ({rowViews, header, rowIndex, sortBy, order, setShowItem, showItem, setShowHighlights, isSelectedForMap, onMap, onFetchMore, bgColor, bucketId, display, onDisplayChange, noToolbar, toolbarControl, repoVersion, alignToolbarLeft, rightControl, analysis, showAnalysis, openAnalysis, onCloseAnalysis, AIRecommendedCandidateId, locales, scispacy, showAlgo, collapsed, onCollapse, candidatesScore, algoScoreFirst, byAlgorithm, isFirst, isCoreUser}) => {
  const results = {total: onFetchMore ? rowViews?.length : 1, results: rowViews || []}
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
  const showHeader = byAlgorithm || count > 0
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
              <AICandidatesAnalysis analysis={analysis} onClose={onCloseAnalysis} sx={{marginBottom: '4px'}} isCoreUser={isCoreUser} />
              {
                showHeader &&
                  <SubHeader count={count} onClick={onCollapseToggle} isCollapsed={isCollapsed} header={header} indicatorColor={bgColor} isFirst={isFirst} />
              }
            </div>
          ) :
            (
              showHeader &&
                <SubHeader count={count} onClick={onCollapseToggle} isCollapsed={isCollapsed} header={header} indicatorColor={bgColor} isFirst={isFirst} />
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
            locales={locales}
            notClickable={Boolean(scispacy)}
            showAlgo={showAlgo}
            candidatesScore={candidatesScore}
            algoScoreFirst={algoScoreFirst}
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
const Candidates = ({rowIndex, alert, setAlert, rowState, conceptCache, setShowItem, showItem, setShowHighlights, isSelectedForMap, onMap, onFetchMore, isLoading, candidatesScore, repoVersion, analysis, onFetchRecommendation, appliedFacets, setAppliedFacets, filters, facets, columns, defaultFilters, locales, models, selectedModel, onModelChange, promptTemplates, promptTemplate, onPromptTemplateChange, onRefreshClick, rowStage, inAIAssistantGroup, algosSelected, isCoreUser}) => {
  const { t } = useTranslation();
  const [sortBy, setSortBy] = React.useState('rerank_score')
  const [groupBy, setGroupBy] = React.useState('quality')
  const [collapsed, setCollapsed] = React.useState([`${rowIndex}-low-ranked`])
  const [openFilters, setOpenFilters] = React.useState(false)
  const [display, setDisplay] = React.useState('card')
  const [openAIAnalysis, setOpenAIAnalysis] = React.useState(undefined)
  const recommendedScore = candidatesScore?.recommended
  const availableScore = candidatesScore?.available
  // Resolve the AI-recommended candidate against conceptCache: prefer the
  // v2 concept_key passthrough, then canonical_reference.code (PR2a shim),
  // then the legacy concept_id/id. The resolved code is matched against
  // ConceptDefinition.reference.code in Concept.jsx for highlighting.
  const primary = analysis?.output?.primary_candidate || analysis?.primary_candidate
  const AIRecommendedCandidateId = resolveAICandidateID(primary, conceptCache)

  const qualityRowViews = React.useMemo(() => buildQualityRowViews(rowState, conceptCache), [rowState, conceptCache])
  const hasAnyView = qualityRowViews.length > 0
  const isNoneLoaded = !rowState || (isEmpty(rowState.candidates) && isEmpty(rowState.algorithm_responses))
  const canFetchMore = hasAnyView
  const algoStagesValue = values(rowStage || {}).filter((_, i, arr) => Object.keys(rowStage || {})[i] !== 'recommend')
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
    locales: locales,
    candidatesScore: candidatesScore,
    algoScoreFirst: algoScoreFirst,
    isCoreUser: isCoreUser
  }

  const onSort = option => {
    if(option === sortBy || option === 'rerank_score') {
      setSortBy('rerank_score')
    } else if(option === 'algo_score') {
      setSortBy(option)
      setGroupBy('algorithm')
    } else {
      setSortBy(option)
    }
  }

  const onRecommend = () => {
    setOpenAIAnalysis(true)
    onFetchRecommendation()
  }

  const onGroup = option => {
    setGroupBy(option)
    if(option === 'algorithm')
      setSortBy('algo_score')
    if(!option || option === 'quality')
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
      return {
        byAlgoCandidates: sortedAlgos.map(({algo, views}) => ({
          algo,
          candidates: sortRowViews(views, sortBy, order)
        }))
      }
    }
    let recommended = []
    let available = []
    let lowRanked = []
    sortRowViews(qualityRowViews, sortBy, order).forEach(view => {
      let score = view.conceptRow?.rerank_score || 0
      if(byScore) {
        if(score >= recommendedScore) recommended.push(view)
        else if(score >= availableScore) available.push(view)
        else lowRanked.push(view)
      } else {
        available.push(view)
      }
    })
    return { recommended, available, lowRanked }
  }

  const { byAlgoCandidates, recommended, available, lowRanked } = getCandidates()

  const getRightControls = () => {
      return (
        <span style={{display: 'flex', alignItems: 'center'}}>
          {
            !areAlgoRun && label &&
              <Chip icon={<CircularProgress sx={{width: '14px !important', height: '14px !important', marginLeft: '6px !important', marginRight: '0px !important'}} />} variant='outlined' color='warning' size='small' label={label} sx={{margin: '0 8px'}} />
          }
          {
            !noCandidatesFound &&
              <>
                <Tooltip title={t('map_project.refresh_candidates_tooltip')}>
                  <span>
                    <IconButton color='secondary' onClick={onRefreshClick} disabled={!areAlgoRun} size='small' sx={{margin: '0 4px'}}>
                      <RefreshIcon />
                    </IconButton>
                  </span>
                </Tooltip>
                <Group onGroup={onGroup} selected={groupBy} />
                <Sort onSort={onSort} selected={sortBy} />
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
                disabled={!areAlgoRun}
              />
          }
        </span>
      )
  }

  React.useEffect(() => {
    setOpenAIAnalysis(isEmpty(analysis) ? false : (openAIAnalysis !== false))
  }, [rowIndex])


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
                        onCloseAnalysis: () => setOpenAIAnalysis(false)
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
