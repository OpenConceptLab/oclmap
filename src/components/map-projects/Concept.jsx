import React from 'react'
import ListItemButton from '@mui/material/ListItemButton'
import ListItem from '@mui/material/ListItem'
import ListItemText from '@mui/material/ListItemText'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Tooltip from '@mui/material/Tooltip'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import isString from 'lodash/isString'
import map from 'lodash/map'

import Retired from '../common/Retired'
import Score from './Score'
import MapButton from './MapButton'
import ConceptSummaryProperties from '../concepts/ConceptSummaryProperties'
import { conceptForMapping } from './viewBuilders.js'

// Format a contributor descriptor for the convergence tooltip:
//   "via CIEL:1234 Activated partial thromboplastin time — SAME-AS"
const formatBridgeContributor = (entry) => {
  const def = entry?.bridgeConceptDefinition
  if(!def) return ''
  const code = def.id || def.reference?.code || ''
  const head = `via ${def.source || ''}:${code} ${def.display_name || ''}`.trim()
  return entry.map_type ? `${head} — ${entry.map_type}` : head
}

// Inline map-type chip — sized to fit the surrounding text line-height so
// it doesn't disrupt vertical flow when embedded mid-sentence (e.g.
// "CIEL:1234 ... [SAME-AS] LOINC:52767-1 ...").
const MAP_TYPE_CHIP_SX = {
  height: '18px',
  borderRadius: '4px',
  margin: '0 6px',
  verticalAlign: 'baseline',
  '.MuiChip-label': {
    padding: '0 6px',
    fontSize: '11px',
    fontWeight: 500,
    letterSpacing: '0.02em'
  }
}


const getBestSynonym = (synonyms = []) => {
  return synonyms
    .map(text => {
      const matches = [...text.matchAll(/<em>(.*?)<\/em>/g)];
      const longestMatch = matches.reduce(
        (a, b) => (b[1].length > a.length ? b[1] : a),
        ""
      );

      const emTag = `<em>${longestMatch}</em>`;
      return {
        text,
        length: longestMatch.length,
        isExact: text.trim() === emTag,
        startsWith: text.startsWith(emTag)
      };
    })
    .sort((a, b) => {
      if (b.isExact !== a.isExact) return b.isExact ? 1 : -1;   // ✅ exact ALWAYS first
      if (b.length !== a.length) return b.length - a.length;   // longer match
      if (b.startsWith !== a.startsWith) return b.startsWith ? 1 : -1;
      return 0;
    })[0]?.text;
};


const Item = ({candidate, conceptDefinition, conceptRow, bridgeConceptDefinition, bridgeContributors, setShowHighlights, onMap, isSelectedForMap, noScore, repoVersion, synonymPrefix, isAIRecommended, showAlgo, candidatesScore, algoScoreFirst, placeholderMap, bridgeChild}) => {
  const conceptToMap = conceptForMapping({candidate, conceptDefinition, conceptRow, bridgeConceptDefinition})
  const idLabel = conceptDefinition?.id || conceptDefinition?.reference?.code
  const sourceLabel = conceptDefinition?.source
  const mapTypeToApply = candidate?.map_type
  const bridgePrefixLabel = bridgeConceptDefinition
    ? `${bridgeConceptDefinition.source || ''}:${bridgeConceptDefinition.id || bridgeConceptDefinition.reference?.code} ${bridgeConceptDefinition.display_name || ''}`.trim()
    : ''
  // SearchHighlightsDialog reads concept.search_meta.search_highlight and
  // calls getScoreDetails on the same shape. Project the tuple through
  // conceptForMapping so the dialog gets the legacy concept shape it
  // expects (search_meta.search_highlight comes from candidate.highlights).
  const showHighlightsPayload = setShowHighlights
    ? () => setShowHighlights(conceptToMap)
    : null
  const convergenceTooltip = (bridgeContributors || []).length
    ? bridgeContributors.map(formatBridgeContributor).filter(Boolean).join('\n')
    : ''
  // Bridge_child cards: extract the [SAME-AS] map-type chip into its own
  // flex column so primary + secondary text both align to the chip's right
  // edge. Previously the chip lived inline inside the primary span, which
  // meant secondary text (LOINC schema chips: COMPONENT/PROPERTY/...) flowed
  // flush-left and rendered visually LEFT of the chip — the artifact
  // @paynejd flagged. The flex layout fixes the alignment regardless of
  // chip label width (SAME-AS vs BROADER-THAN vs longer map_types).
  const useFlexLayout = bridgeChild && candidate?.map_type
  const listItemText = (
      <ListItemText
        primary={
          <span>
            <span>
              {
                bridgeChild ? (
                  // Two cases:
                  //   - Quality view (algoScoreFirst=false): render full cascade
                  //     inline so the user sees both ends (CIEL:1234 [SAME-AS]
                  //     LOINC:52767-1 ...). bridgePrefixLabel carries the
                  //     intermediary's source:id name.
                  //   - Algo view (algoScoreFirst=true): the parent bridge
                  //     intermediary is already rendered as the ConceptItem
                  //     above this nested child, so repeating its source:id
                  //     name on every child line is noise. Suppress the prefix.
                  <>
                    {!algoScoreFirst && bridgePrefixLabel && (
                      <span className='searchable'>{bridgePrefixLabel}</span>
                    )}
                    {/* When useFlexLayout, the chip is rendered as a sibling
                        flex column below (so primary + secondary align). In
                        the legacy non-flex path the chip stayed inline here. */}
                    {!useFlexLayout && candidate?.map_type && (
                      <Chip size='small' label={candidate.map_type} sx={MAP_TYPE_CHIP_SX} />
                    )}
                    <span className='searchable'>
                      {`${sourceLabel || ''}:${idLabel} ${conceptDefinition?.display_name || ''}`.trim()}
                    </span>
                  </>
                ) : (
                  <>
                    <span className='searchable'>{`${sourceLabel || ''}:${idLabel}`}</span>
                    <span style={{marginLeft: '4px'}} className='searchable'>
                      {
                        !bridgeConceptDefinition && synonymPrefix &&
                          <span className='searchable'>
                            <span dangerouslySetInnerHTML={{__html: synonymPrefix}}/>
                            <span style={{margin: '0 5px'}}>&rarr;</span>
                          </span>
                      }
                      {conceptDefinition?.display_name}
                    </span>
                    {
                      // Legacy algo-view path: a target row with bridge
                      // metadata attached. Renders target → [maptype] → target
                      // (the duplication is preserved from the prior render —
                      // touched-up here only structurally).
                      bridgePrefixLabel &&
                        <span>
                          <span style={{margin: '0 5px'}}>&rarr;</span>
                          {candidate?.map_type ? `[${candidate.map_type}]` : ''}
                          <span style={{margin: '0 5px'}}>&rarr;</span>
                          <span className='searchable'>
                            {conceptDefinition?.display_name
                              ? `${sourceLabel || ''}:${idLabel} ${conceptDefinition.display_name}`
                              : ''}
                          </span>
                        </span>
                    }
                  </>
                )
              }
            </span>
            {
              conceptDefinition?.retired &&
                <Retired size='small' style={{margin: '0 12px'}} />
            }
          </span>
        }
        secondary={
          // overflowWrap/wordBreak prevent LOINC's `^` and `/` separators
          // (and stretches like "peptide.B" with embedded periods) from
          // word-breaking even when there's whitespace to spare. Bridge_child
          // alignment is handled by the outer flex layout (useFlexLayout
          // branch above) — the chip lives in its own column so primary +
          // secondary both align to the right of it, no manual padding
          // needed here.
          <div
            className='col-xs-12 padding-0'
            style={{overflowWrap: 'break-word', wordBreak: 'normal'}}
          >
            <div className='col-xs-12 padding-0'>
              <ConceptSummaryProperties concept={conceptDefinition} repoVersion={repoVersion} />
            </div>
            {
              showAlgo && candidate?.algorithm_id ?
                <div className='col-xs-12 padding-0' style={{marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px'}}>
                  <Chip size='small' label={candidate.algorithm_id} variant='outlined' color='warning' />
                  {
                    convergenceTooltip &&
                      <Tooltip title={<span style={{whiteSpace: 'pre-line'}}>{convergenceTooltip}</span>} placement='top'>
                        <InfoOutlinedIcon sx={{fontSize: '14px', color: 'text.secondary', cursor: 'help'}} />
                      </Tooltip>
                  }
              </div> : null
            }
          </div>
        }
        sx={{margin: '2px 0', '.MuiListItemText-primary': {fontSize: '14px'}, '.MuiListItemText-secondary': {fontSize: '12px', overflow: 'scroll'}}}
      />
  )
  return (
    <>
      {useFlexLayout ? (
        <div style={{display: 'flex', alignItems: 'flex-start', flex: 1, minWidth: 0, gap: '6px'}}>
          <Chip
            size='small'
            label={candidate.map_type}
            sx={{...MAP_TYPE_CHIP_SX, margin: '6px 0 0 0', flexShrink: 0}}
          />
          <div style={{flex: 1, minWidth: 0}}>
            {listItemText}
          </div>
        </div>
      ) : listItemText}
      <span style={{display: 'flex', alignItems: 'flex-start'}}>
        {
          !noScore &&
            <Score
              size='small'
              candidate={candidate}
              conceptRow={conceptRow}
              setShowHighlights={setShowHighlights}
              isAIRecommended={isAIRecommended}
              candidatesScore={candidatesScore}
              algoScoreFirst={algoScoreFirst}
              onHighlightClick={showHighlightsPayload}
            />
        }
        {
          isSelectedForMap && conceptToMap &&
            <MapButton
              simple
              selected={mapTypeToApply}
              onClick={(event, applied, mapType) => onMap(event, conceptToMap, !applied, candidate?.map_type || mapType)}
              isMapped={isSelectedForMap(conceptToMap)}
              sx={{marginLeft: '8px'}}
            />
        }
        {
          !isSelectedForMap && placeholderMap &&
            <Button size='small' sx={{visibility: 'none', minWidth: '100px'}} />
        }
      </span>
    </>
  )
}


const ConceptItem = ({_id, notClickable, isSelectedToShow, firstChild, lastChild, sx, onCardClick, id,  ...rest}) => {
  const props = {
    selected: isSelectedToShow,
    sx: {
      padding: '4px',
      borderTop: firstChild ? undefined : '1px solid rgba(0, 0, 0, 0.1)',
      borderBottom: lastChild ? '1px solid rgba(0, 0, 0, 0.1)' : undefined,
      alignItems: 'flex-start',
      ...sx
    }
  }

  let item = <Item {...rest} />

  return notClickable ? (
    <ListItem {...props} id={_id}>{item}</ListItem>
  ) : (
    <ListItemButton {...props} onClick={onCardClick ? event => onCardClick(event, id) : undefined}>
      {item}
    </ListItemButton>
  )
}


// Wrap a legacy concept-shape object (id/display_name/url/search_meta) into
// a synthetic rowView so Concept renders identically whether it gets a
// unified-model tuple from Candidates or a mapSelected/searchedConcepts
// projection from the Target Code column / decision tables. The legacy
// callers don't have candidate/conceptRow context, so we synthesize
// minimal stand-ins from search_meta.
const legacyToRowView = (legacy) => {
  if(!legacy || typeof legacy !== 'object') return null
  const meta = legacy.search_meta || {}
  return {
    type: 'standard',
    candidate: {
      algorithm_id: meta.algorithm,
      score: meta.search_score,
      highlights: meta.search_highlight,
      map_type: meta.map_type
    },
    conceptDefinition: {
      reference: legacy.reference,
      ocl_url: legacy.url || legacy.ocl_url,
      id: legacy.id,
      display_name: legacy.display_name,
      source: legacy.source || legacy.repo?.short_code || legacy.repo?.id,
      owner: legacy.owner,
      names: legacy.names,
      descriptions: legacy.descriptions,
      concept_class: legacy.concept_class,
      datatype: legacy.datatype,
      retired: legacy.retired,
      properties: legacy.properties
    },
    conceptRow: {
      rerank_score: meta.search_normalized_score
    }
  }
}

// `concept` here is normally a row view object built by Candidates.jsx from
// rowMatchState + conceptCache:
//   {
//     type: 'standard' | 'bridge' | 'bridge_child',
//     candidate, conceptDefinition, conceptRow,
//     bridgeConceptDefinition?,   // when type='bridge_child'
//     bridgeChildren?             // when type='bridge' (algo view nested rendering)
//   }
// Legacy callers (Target Code column, decision tables, search results)
// pass a flat concept-shape object instead — legacyToRowView wraps those
// so a single render path covers both worlds while PR3 cleanup is pending.
const Concept = ({_id, firstChild, lastChild, concept, setShowHighlights, isShown, onCardClick, onMap, isSelectedForMap, noScore, repoVersion, isAIRecommended, sx, notClickable, noSynonymPrefix, locales, showAlgo, candidatesScore, algoScoreFirst, asTarget, AIRecommendedCandidateId, targetCanonical}) => {
  const rowView = concept?.conceptDefinition ? concept : legacyToRowView(concept)
  if(!rowView?.conceptDefinition) return null
  const { type, candidate, conceptDefinition, conceptRow, bridgeConceptDefinition, bridgeChildren, bridgeContributors } = rowView
  // Map action is gated on canonical alignment with the project's target
  // repo. Bridge intermediaries (e.g. CIEL when target is ICD) aren't
  // mappable themselves — they're reference metadata about the cascade.
  // Pass isSelectedForMap=false to Item so it renders the placeholder
  // spacer instead of a MapButton.
  const isMappable = !targetCanonical || conceptDefinition?.reference?.url === targetCanonical
  const effectiveIsSelectedForMap = isMappable ? isSelectedForMap : false
  const idForUI = conceptDefinition.ocl_url || conceptDefinition.id || conceptDefinition.reference?.code
  const isSelectedToShow = isShown ? isShown(idForUI) : false

  let synonymPrefix = ''
  const highlights = candidate?.highlights
  const synonymHighlight = highlights?.synonyms
  const nameHighlight = highlights?.name
  if(!nameHighlight?.length && synonymHighlight?.length && !noSynonymPrefix) {
    let bestMatch = getBestSynonym(synonymHighlight) || synonymHighlight[0]
    if(locales && bestMatch && conceptDefinition?.names) {
      let raw = bestMatch.replaceAll("<em>", "").replaceAll("</em>", "")
      let _locales = isString(locales) ? locales.split(',') : locales
      if(_locales?.length > 0 && !_locales.includes(conceptDefinition.names.find(name => name.name.startsWith(raw))?.locale))
        bestMatch = ''
    }
    synonymPrefix = (bestMatch || '').replaceAll('<em>', "<b className='searchable'>").replaceAll('</em>', '</b>')
  }

  const baseProps = {
    id: idForUI,
    _id: _id,
    notClickable: notClickable,
    firstChild: firstChild,
    lastChild: lastChild,
    isSelectedToShow: isSelectedToShow,
    sx: sx,
    onCardClick: onCardClick
  }

  if(type === 'bridge') {
    const isBridgeAIRecommended = AIRecommendedCandidateId && conceptDefinition.reference?.code === AIRecommendedCandidateId
    return (
      <>
        {
          algoScoreFirst &&
            <ConceptItem
              {...baseProps}
              candidate={candidate}
              conceptDefinition={conceptDefinition}
              conceptRow={conceptRow}
              repoVersion={repoVersion}
              synonymPrefix={synonymPrefix}
              setShowHighlights={setShowHighlights}
              // Bridge intermediary itself is NOT a target-repo concept and
              // can't be mapped — render a spacer instead of a MapButton.
              // Children below (cascade targets, which ARE in target_repo)
              // get the real Map action.
              isSelectedForMap={false}
              placeholderMap
              onMap={onMap}
              noScore={noScore}
              showAlgo={showAlgo}
              candidatesScore={candidatesScore}
              algoScoreFirst={algoScoreFirst}
              isAIRecommended={isBridgeAIRecommended}
            />
        }
        {
          asTarget ?
            <ConceptItem
              {...baseProps}
              candidate={candidate}
              conceptDefinition={conceptDefinition}
              conceptRow={conceptRow}
              repoVersion={repoVersion}
              isSelectedForMap={false}
              placeholderMap
              noScore
              showAlgo={false}
            /> :
          <div className='col-xs-12' style={{paddingRight: 0, paddingLeft: algoScoreFirst ? '12px' : 0}}>
            {
              map(bridgeChildren || [], (child, index) => {
                const childAIRecommended = AIRecommendedCandidateId && child.conceptDefinition?.reference?.code === AIRecommendedCandidateId
                return <ConceptItem
                  key={`${index}-${child.candidate?.id}`}
                  {...baseProps}
                  // baseProps inherits the outer card's firstChild flag, which
                  // suppresses borderTop on the first nested child — leaves a
                  // visual gap between the bridge intermediary and its first
                  // cascade target. Bridge children always have a row above
                  // them (the intermediary), so always render the divider.
                  firstChild={false}
                  candidate={child.candidate}
                  conceptDefinition={child.conceptDefinition}
                  conceptRow={child.conceptRow}
                  bridgeConceptDefinition={conceptDefinition}
                  repoVersion={repoVersion}
                  synonymPrefix={synonymPrefix}
                  setShowHighlights={setShowHighlights}
                  isSelectedForMap={isSelectedForMap}
                  onMap={onMap}
                  bridgeChild
                  showAlgo={showAlgo}
                  candidatesScore={candidatesScore}
                  algoScoreFirst={algoScoreFirst}
                  isAIRecommended={childAIRecommended}
                />
              })
            }
          </div>
        }
      </>
    )
  }

  // type === 'standard' or 'bridge_child' (the latter only when rendered
  // directly, i.e. in the score-grouped view as the target concept).
  const isAIMatch = AIRecommendedCandidateId && conceptDefinition.reference?.code === AIRecommendedCandidateId
  return <ConceptItem
    {...baseProps}
    candidate={candidate}
    conceptDefinition={conceptDefinition}
    conceptRow={conceptRow}
    bridgeConceptDefinition={bridgeConceptDefinition}
    bridgeContributors={bridgeContributors}
    repoVersion={repoVersion}
    synonymPrefix={synonymPrefix}
    setShowHighlights={setShowHighlights}
    isAIRecommended={isAIRecommended || isAIMatch}
    isSelectedForMap={effectiveIsSelectedForMap}
    placeholderMap={!isMappable}
    onMap={onMap}
    noScore={noScore}
    bridgeChild={type === 'bridge_child' && Boolean(bridgeConceptDefinition)}
    showAlgo={showAlgo}
    candidatesScore={candidatesScore}
    algoScoreFirst={algoScoreFirst}
  />
}

export default Concept;
