import React from 'react';
import { useTranslation } from 'react-i18next';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography'
import Table from '@mui/material/Table'
import TableHead from '@mui/material/TableHead'
import TableContainer from '@mui/material/TableContainer'
import TableBody from '@mui/material/TableBody'
import TableRow from '@mui/material/TableRow'
import TableCell from '@mui/material/TableCell'
import Tooltip from '@mui/material/Tooltip'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Skeleton from '@mui/material/Skeleton'
import ButtonGroup from '@mui/material/ButtonGroup'

import SelectedIcon from '@mui/icons-material/Done';
import UpIcon from '@mui/icons-material/KeyboardArrowUp';
import DownIcon from '@mui/icons-material/KeyboardArrowDown';
import { get, isEmpty, forEach, map, find, compact, flatten, values, filter, without, has } from 'lodash';
import ConceptIcon from './ConceptIcon'
import { generateRandomString, dropVersion, URIToParentParams, toParentURI } from '../../common/utils'
import TagCountLabel from '../common/TagCountLabel'
import RepoChip from '../repos/RepoChip'

const groupMappings = (orderedMappings, concept, mappings, forward) => {
  forEach(mappings, resource => {
    if(!(find(mappings, mapping => dropVersion(mapping.cascade_target_concept_url) === dropVersion(resource.url)))) {
      let mapType = resource.map_type
      const isMapping = Boolean(mapType)
      if(!mapType)
        mapType = forward ? 'children' : 'parent';
      orderedMappings[mapType] = orderedMappings[mapType] || {order: null, direct: [], indirect: [], unknown: [], hierarchy: [], reverseHierarchy: [], self: []}
      const isSelfMapping = isMapping && dropVersion(concept.url) === dropVersion(resource.cascade_target_concept_url) && toParentURI(concept.url) === dropVersion(resource.cascade_target_concept_url)
      let _resource = isMapping ? {...resource, isSelf: isSelfMapping, cascade_target_concept_name: resource.cascade_target_concept_name || get(find(mappings, m => dropVersion(m.url) === dropVersion(resource.cascade_target_concept_url)), 'display_name')} : {...resource, cascade_target_concept_name: resource.display_name}
      if(isSelfMapping) {
        if(!map(orderedMappings[mapType].self, 'id').includes(resource.id))
          orderedMappings[mapType].self.push(_resource)
      } else {
        if(isMapping)
          forward ? orderedMappings[mapType].direct.push(_resource) : orderedMappings[mapType].indirect.push(_resource)
        else
          forward ? orderedMappings[mapType].hierarchy.push(_resource) : orderedMappings[mapType].reverseHierarchy.push(_resource)
      }
    }
  })
}


// Match a mapping row against the panel's linked-concept set (the bridge/target
// URL that connects this concept to the candidate the user clicked from). The
// mapping's "target" can surface on several different fields depending on
// direction (forward vs. reverse), shape (Mapping resource vs. hierarchy
// entry), and how the cascade endpoint resolves it. Check all known carriers
// — false negatives here mean no visual cue, which defeats the feature.
const matchesLinkedConcept = (mapping, linkedSet) => {
  if(!linkedSet || linkedSet.size === 0 || !mapping) return false
  const candidateUrls = [
    mapping.cascade_target_concept_url,
    mapping.cascade_target_concept_url_resolved,
    mapping.url,
    mapping.version_url,
    mapping.from_concept_url,
    mapping.to_concept_url,
    mapping.source_url,
  ]
  return candidateUrls.some(u => u && linkedSet.has(dropVersion(u)))
}

// Soft amber highlight for rows that link back to a panel-known concept
// (bridge → target, or target → bridge). Explicit rgba (not a theme token —
// the palette has no `warning.95` shade) so it reads as "noteworthy" without
// competing with the table chrome. Applied per-cell because MUI's TableCell
// paints its own background over the TableRow, so a row-level SX is hidden.
const LINKED_BG = 'rgba(255, 179, 0, 0.16)'
const LINKED_CELL_SX = {backgroundColor: LINKED_BG}

const MappingCells = ({mapping, isIndirect, linkedSet, linkedConceptLabel}) => {
  const { t } = useTranslation()
  const conceptCodeAttr = 'cascade_target_concept_code'
  const conceptCodeName = 'cascade_target_concept_name'
  const sourceAttr = 'cascade_target_source_name';
  const getConceptName = (mapping, attr) => {
    let name = get(mapping, attr) || get(mapping, `${attr}_resolved`);
    if(name) return name;
    return get(mapping, `${attr.split('_name')}.0.display_name`)
  }
  const isDefinedInOCL = Boolean(mapping?.type === 'Mapping' ? mapping.cascade_target_concept_url : mapping.url)
  const getTitle = () => {
    return isDefinedInOCL ?
      (isIndirect ? t('mapping.from_concept_defined') : t('mapping.to_concept_defined')) :
      (isIndirect ? t('mapping.from_concept_not_defined') : t('mapping.to_concept_not_defined'))
  }
  const isLinked = matchesLinkedConcept(mapping, linkedSet)
  const cellSx = isLinked ? LINKED_CELL_SX : undefined

  return (
    <React.Fragment>
      <TableCell sx={cellSx}>
        {/* Stack the linked-concept chip BELOW the dot+code (not inline to the
            right) so the Code column stays narrow and the Name column keeps width. */}
        <span style={{display: 'flex', flexDirection: 'column', alignItems: 'flex-start'}} className='searchable'>
          <span style={{display: 'flex', alignItems: 'center'}}>
            <Tooltip title={getTitle()}>
              <span>
                <ConceptIcon selected={isDefinedInOCL} sx={{width: '10px', height: '10px', marginRight: '12px'}} />
              </span>
            </Tooltip>
            { has(mapping, conceptCodeAttr) ? mapping[conceptCodeAttr] : mapping?.id }
          </span>
          {
            isLinked && linkedConceptLabel && (
              <Tooltip title={linkedConceptLabel}>
                <Chip
                  size='small'
                  label={linkedConceptLabel}
                  color='warning'
                  variant='outlined'
                  sx={{marginTop: '4px', height: '18px', borderRadius: '4px', '.MuiChip-label': {padding: '0 6px', fontSize: '10px', fontWeight: 600}}}
                />
              </Tooltip>
            )
          }
        </span>
      </TableCell>
      <TableCell sx={cellSx}>
        { getConceptName(mapping, conceptCodeName) }
      </TableCell>
      <TableCell align='left' sx={cellSx}>
        {has(mapping, sourceAttr) ? get(mapping, sourceAttr) : URIToParentParams(mapping.url)?.repo}
      </TableCell>
    </React.Fragment>
  )
}


const AssociationRow = ({mappings, id, mapType, isSelf, isIndirect, hide, linkedSet, linkedConceptLabel}) => {
  const { t } = useTranslation()
  const firstMapping = get(mappings, 0)
  const firstIsLinked = matchesLinkedConcept(firstMapping, linkedSet)
  return (
    <React.Fragment>
      <TableRow id={id || mapType} sx={hide ? {display: 'none'} : {}}>
        <TableCell className='sticky-col' rowSpan={mappings?.length} align='left' sx={{verticalAlign: 'top', width: '10%', paddingLeft: '8px', top: '37px', zIndex: 1, ...(firstIsLinked ? LINKED_CELL_SX : {})}}>
          <span className='flex-vertical-center'>
            <Tooltip placement='left' title={isIndirect ? t('mapping.inverse_mappings') : (isSelf ? t('mapping.self_mappings') : t('mapping.direct_mappings'))}>
              <Chip
                size='small'
                variant='outlined'
                color='default'
                sx={{color: 'rgba(0, 0, 0, 0.87)'}}
                label={
                  <span>
                    <span>{mapType}</span>
                    {isIndirect && <sup>-1</sup>}
                    {isSelf && <sup>∞</sup>}
                  </span>
                }
                style={{border: 'none'}}
              />
            </Tooltip>
          </span>
        </TableCell>
        {
          !isEmpty(firstMapping) &&
            <MappingCells mapping={firstMapping} isIndirect={isIndirect} linkedSet={linkedSet} linkedConceptLabel={linkedConceptLabel} />
        }
      </TableRow>
      {
        map(mappings?.slice(1), (mapping, index) => {
          if(!mapping || isEmpty(mapping)) return null
          return (
            <TableRow key={index} sx={hide ? {display: 'none'} : {}}>
              <MappingCells mapping={mapping} isIndirect={isIndirect} linkedSet={linkedSet} linkedConceptLabel={linkedConceptLabel} />
            </TableRow>
          )
        })
      }
    </React.Fragment>
  )
}


const borderColor = 'rgba(0, 0, 0, 0.12)'
const Associations = ({concept, mappings, reverseMappings, ownerMappings, reverseOwnerMappings, onLoadOwnerMappings, loadingOwnerMappings, linkedConceptUrls, linkedConceptLabel}) => {
  // Build a version-stripped set of URLs we want to highlight as "linked
  // back to the panel's other tab". Used for the bridge ↔ target visual
  // affordance in the unified Concept Details Panel.
  const linkedSet = React.useMemo(() => {
    if(!Array.isArray(linkedConceptUrls) || linkedConceptUrls.length === 0) return null
    const s = new Set(linkedConceptUrls.filter(Boolean).map(u => dropVersion(u)))
    return s.size > 0 ? s : null
  }, [linkedConceptUrls])
  const [scope, setScope] = React.useState('repo')
  const [orderedMappings, setOrderedMappings] = React.useState({});
  const [orderedOwnerMappings, setOrderedOwnerMappings] = React.useState({});
  const [ownerMappingsGroupedByRepo, setOwnerMappingsGroupedByRepo] = React.useState({});
  const [collapsedSections, setCollapsedSections] = React.useState([])
  const { t } = useTranslation()
  const getMappings = () => {
    let _mappings = {}
    groupMappings(_mappings, concept, mappings, true)
    groupMappings(_mappings, concept, reverseMappings, false)
    return _mappings
  }
  const getOwnerMappings = () => {
    let _ownerMappingsGroupedByRepo = {}
    let groupedMappings = {}
    forEach(ownerMappings, _mapping => {
      let url = _mapping?.version_url || _mapping?.url
      let parent = URIToParentParams(url)
      let parentURI = toParentURI(url)
      _mapping.direct = true
      _mapping.parent = parent
      _ownerMappingsGroupedByRepo[parentURI] ||= []
      _ownerMappingsGroupedByRepo[parentURI].push(_mapping)
    })
    forEach(reverseOwnerMappings, _mapping => {
      _mapping.indirect = true
      let url = _mapping?.version_url || _mapping?.url
      let parent = URIToParentParams(url)
      let parentURI = toParentURI(url)
      _mapping.parent = parent
      _ownerMappingsGroupedByRepo[parentURI] ||= []
      _ownerMappingsGroupedByRepo[parentURI].push(_mapping)
    })
    setOwnerMappingsGroupedByRepo(_ownerMappingsGroupedByRepo)
    forEach(_ownerMappingsGroupedByRepo, (mappings, repoURI) => {
      let __mappings = {}
      groupMappings(__mappings, concept, filter(mappings, {direct: true}), true)
      groupMappings(__mappings, concept, filter(mappings, {indirect: true}), false)
      groupedMappings[repoURI] = __mappings
    })
    return groupedMappings
  }

  const countOwnerMappings = ownerMappings?.length + reverseOwnerMappings?.length
  const count = flatten(compact(flatten(map(values(orderedMappings), mapping => values(mapping))))).length + countOwnerMappings

  React.useEffect(() => setOrderedMappings(getMappings()), [mappings, reverseMappings])
  React.useEffect(() => setOrderedOwnerMappings(getOwnerMappings()), [ownerMappings, reverseOwnerMappings])

  const onScopeClick = newScope => {
    setScope(newScope)
    if(['all', 'namespace'].includes(newScope)) {
      loadingOwnerMappings === null ? onLoadOwnerMappings() : undefined
    }
  }
  const toggleSection = repoURI => setCollapsedSections(collapsedSections?.includes(repoURI) ? without(collapsedSections, repoURI) : [...collapsedSections, repoURI])

  return (
    <Paper className='col-xs-12 padding-0' sx={{boxShadow: 'none', border: '1px solid', borderColor: borderColor, borderRadius: '10px'}}>
      <Typography component="span" sx={{borderBottom: '1px solid', borderColor: borderColor, padding: '12px 16px', fontSize: '16px', color: 'surface.contrastText', display: 'flex', justifyContent: 'space-between'}}>
        <TagCountLabel label={t('concept.associations')} count={scope === 'all' ? count : (scope === 'namespace' ? countOwnerMappings : count - countOwnerMappings)}/>
        <ButtonGroup size='small' color='secondary'>
          <Button selected={scope === 'repo'} startIcon={scope === 'repo' ? <SelectedIcon /> : undefined } sx={{textTransform: 'none', borderTopLeftRadius: '50px', borderBottomLeftRadius: '50px', backgroundColor: scope === 'repo' ? 'primary.90' : undefined}} onClick={() => onScopeClick('repo')}>
            <b>{t('repo.repo')}</b>
          </Button>
          <Button selected={scope === 'namespace'} startIcon={scope === 'namespace' ? <SelectedIcon /> : undefined } sx={{backgroundColor: scope === 'namespace' ? 'primary.90' : undefined, textTransform: 'none'}} onClick={() => onScopeClick('namespace')}>
            <b>{t('concept.namespace')}</b>
          </Button>
          <Button selected={scope === 'all'} startIcon={scope === 'all' ? <SelectedIcon /> : undefined } sx={{backgroundColor: scope==='all' ? 'primary.90' : undefined, textTransform: 'none', borderTopRightRadius: '50px', borderBottomRightRadius: '50px'}} onClick={() => onScopeClick('all')}>
            <b>{t('common.all')}</b>
          </Button>
        </ButtonGroup>
      </Typography>
      <TableContainer sx={{ maxHeight: 400, borderRadius: '10px' }}>
        <Table stickyHeader size='small'>
          <TableHead>
            <TableRow>
              <TableCell sx={{width: '10%', zIndex: 3}} className='sticky-col'><b>{t('mapping.relationship')}</b></TableCell>
              <TableCell sx={{width: '20%'}}><b>{t('mapping.code')}</b></TableCell>
              <TableCell sx={{width: '40%'}}><b>{t('common.name')}</b></TableCell>
              <TableCell sx={{width: '20%'}}><b>{t('repo.source')}</b></TableCell>
            </TableRow>
          </TableHead>
          <TableBody sx={{ '.MuiTableRow-root': {'&:last-child td': {border: 0, borderRadius: '10px'}} }}>
            {
              ['repo', 'all'].includes(scope) &&
                <React.Fragment>
                  {
                    map(orderedMappings, (oMappings, mapType) => {
                      const key = generateRandomString()
                      const hasSelfMappings = !isEmpty(oMappings.self)
                      return hasSelfMappings &&
                        <React.Fragment key={key}>
                          <AssociationRow
                            key={mapType}
                            mapType='SAME-AS'
                            mappings={oMappings.self}
                            isSelf
                            linkedSet={linkedSet}
                            linkedConceptLabel={linkedConceptLabel}
                          />
                        </React.Fragment>
                    })
                  }
                  {
                    !isEmpty(orderedMappings?.children?.hierarchy) &&
                      <AssociationRow
                        mappings={orderedMappings?.children?.hierarchy}
                        id='has-child'
                        mapType={t('mapping.has_child')}
                        isHierarchy
                        linkedSet={linkedSet}
                        linkedConceptLabel={linkedConceptLabel}
                      />
                  }
                  {
                    !isEmpty(orderedMappings?.parent?.reverseHierarchy) &&
                      <AssociationRow
                        mappings={orderedMappings?.parent?.reverseHierarchy}
                        id='has-parent'
                        mapType={t('mapping.has_parent')}
                        isHierarchy
                        isIndirect
                        linkedSet={linkedSet}
                        linkedConceptLabel={linkedConceptLabel}
                      />
                  }
                  {
                    map(orderedMappings, (oMappings, mapType) => {
                      const key = generateRandomString()
                      const hasDirectMappings = !isEmpty(oMappings.direct)
                      return (
                        <React.Fragment key={key}>
                          {
                            hasDirectMappings &&
                              <AssociationRow
                                key={mapType}
                                mapType={mapType}
                                mappings={oMappings.direct}
                                linkedSet={linkedSet}
                                linkedConceptLabel={linkedConceptLabel}
                              />
                          }
                        </React.Fragment>
                      )
                    })
                  }
                  {
                    map(orderedMappings, (oMappings, mapType) => {
                      const key = generateRandomString()
                      const hasMappings = !isEmpty(oMappings.indirect)
                      return (
                        <React.Fragment key={key}>
                          {
                            hasMappings &&
                              <AssociationRow
                                key={mapType}
                                mappings={oMappings.indirect}
                                mapType={mapType}
                                isIndirect
                                linkedSet={linkedSet}
                                linkedConceptLabel={linkedConceptLabel}
                              />
                          }
                        </React.Fragment>
                      )
                    })
                  }
                </React.Fragment>
            }
            {
              ['namespace', 'all'].includes(scope) &&
                <React.Fragment>
                  {
                    loadingOwnerMappings === true ?
                      <TableRow>
                        <TableCell colSpan={4}>
                          <Skeleton width='100%' />
                        </TableCell>
                      </TableRow> :
                    <React.Fragment>
                      {
                        map(orderedOwnerMappings, (gMappings, repoURI) => {
                          const repoMappings = ownerMappingsGroupedByRepo[repoURI]
                          const repo = repoMappings[0].parent
                          const isCollapsed = collapsedSections.includes(repoURI)
                          return (
                            <React.Fragment key={repoURI}>
                              <TableRow>
                                <TableCell align='left' colSpan={4} sx={{cursor: 'pointer', fontSize: '12px', padding: '6px 12px', backgroundColor: 'primary.95'}} onClick={() => toggleSection(repoURI)}>
                                <span style={{display: 'flex', alignItems: 'center'}}>
                                  {isCollapsed ? <DownIcon /> : <UpIcon />}
                                  <TagCountLabel
                                    label={
                                      <RepoChip
                                        filled
                                        color='primary'
                                        size='medium'
                                        sx={{
                                          marginLeft: '10px',
                                          padding: '0 0 0 3px !important',
                                          height: '28px !important',
                                          background: 'transparent',
                                          border: 'none',
                                          '.MuiAvatar-root .MuiSvgIcon-root': {
                                            color: 'primary.main'
                                          }
                                        }}
                                        repo={{...repo, url: repoURI, id: repo.repo, type: repo.repoType}}
                                      />
                                    }
                                    count={repoMappings?.length}
                                  />
                                  </span>
                                </TableCell>
                              </TableRow>
                              {
                                map(gMappings, (oMappings, mapType) => {
                                  const key = generateRandomString()
                                  const hasMappings = !isEmpty(oMappings.direct)
                                  return (
                                    <React.Fragment key={key}>
                                      {
                                        hasMappings &&
                                          <AssociationRow
                                            hide={isCollapsed}
                                            key={mapType}
                                            mapType={mapType}
                                            mappings={oMappings.direct}
                                            linkedSet={linkedSet}
                                            linkedConceptLabel={linkedConceptLabel}
                                          />
                                      }
                                    </React.Fragment>
                                  )
                                })
                              }
                              {
                                map(gMappings, (oMappings, mapType) => {
                                  const key = generateRandomString()
                                  const hasMappings = !isEmpty(oMappings.indirect)
                                  return (
                                    <React.Fragment key={key}>
                                      {
                                        hasMappings &&
                                          <AssociationRow
                                            hide={isCollapsed}
                                            key={mapType}
                                            mapType={mapType}
                                            mappings={oMappings.indirect}
                                            isIndirect
                                            linkedSet={linkedSet}
                                            linkedConceptLabel={linkedConceptLabel}
                                          />
                                      }
                                    </React.Fragment>
                                  )
                                })
                              }
                            </React.Fragment>
                          )
                        })
                      }
                    </React.Fragment>
                  }
                </React.Fragment>
            }
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  )
}

export default Associations;
