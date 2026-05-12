import React from 'react'
import ListItemButton from '@mui/material/ListItemButton'
import ListItem from '@mui/material/ListItem'
import ListItemText from '@mui/material/ListItemText'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import isString from 'lodash/isString'
import map from 'lodash/map'

import Retired from '../common/Retired'
import Score from './Score'
import MapButton from './MapButton'
import ConceptSummaryProperties from '../concepts/ConceptSummaryProperties'
import { conceptForMapping } from './viewBuilders.js'


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


const Item = ({candidate, conceptDefinition, conceptRow, bridgeConceptDefinition, setShowHighlights, onMap, isSelectedForMap, noScore, repoVersion, synonymPrefix, isAIRecommended, showAlgo, candidatesScore, algoScoreFirst, placeholderMap, bridgeChild}) => {
  const conceptToMap = conceptForMapping({candidate, conceptDefinition, conceptRow, bridgeConceptDefinition})
  const idLabel = conceptDefinition?.id || conceptDefinition?.reference?.code
  const sourceLabel = conceptDefinition?.source
  const mapTypeToApply = candidate?.map_type
  const bridgeMappingPrefix = bridgeConceptDefinition
    ? `${bridgeConceptDefinition.source || ''}:${bridgeConceptDefinition.id || bridgeConceptDefinition.reference?.code} ${bridgeConceptDefinition.display_name || ''}`
    : false
  // SearchHighlightsDialog reads concept.search_meta.search_highlight and
  // calls getScoreDetails on the same shape. Project the tuple through
  // conceptForMapping so the dialog gets the legacy concept shape it
  // expects (search_meta.search_highlight comes from candidate.highlights).
  const showHighlightsPayload = setShowHighlights
    ? () => setShowHighlights(conceptToMap)
    : null
  return (
    <>
      <ListItemText
        primary={
          <span>
            <span>
              {
                !bridgeChild &&
                  <span className='searchable'>{`${sourceLabel || ''}:${idLabel}`}</span>
              }
              {
                !bridgeChild &&
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
              }
              {
                bridgeMappingPrefix &&
                  <span>
                    {!bridgeChild && <span style={{margin: '0 5px'}}>&rarr;</span>}
                    <span style={bridgeChild ? {marginRight: '8px'} : {}}>
                      {
                        bridgeChild && candidate?.map_type ?
                          <Chip size='small' label={candidate.map_type} /> :
                        (candidate?.map_type ? `[${candidate.map_type}]` : '')
                      }
                    </span>
                    {!bridgeChild && <span style={{margin: '0 5px'}}>&rarr;</span>}
                    <span className='searchable'>
                      {bridgeChild
                        ? `${sourceLabel || ''}:${idLabel} ${conceptDefinition?.display_name || ''}`
                        : (
                          conceptDefinition?.display_name
                            ? `${sourceLabel || ''}:${idLabel} ${conceptDefinition.display_name}`
                            : ''
                        )
                      }
                    </span>
                  </span>
              }
            </span>
            {
              conceptDefinition?.retired &&
                <Retired size='small' style={{margin: '0 12px'}} />
            }
          </span>
        }
        secondary={
          <div className='col-xs-12 padding-0'>
            <div className='col-xs-12 padding-0'>
              <ConceptSummaryProperties concept={conceptDefinition} repoVersion={repoVersion} />
            </div>
            {
              showAlgo && candidate?.algorithm_id ?
                <div className='col-xs-12 padding-0' style={{marginTop: '4px'}}>
                  <Chip size='small' label={candidate.algorithm_id} variant='outlined' color='warning' />
              </div> : null
            }
          </div>
        }
        sx={{margin: '2px 0', '.MuiListItemText-primary': {fontSize: '14px'}, '.MuiListItemText-secondary': {fontSize: '12px', overflow: 'scroll'}}}
      />
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


// `concept` here is a row view object built by Candidates.jsx from
// rowMatchState + conceptCache. Shape:
//   {
//     type: 'standard' | 'bridge' | 'bridge_child',
//     candidate, conceptDefinition, conceptRow,
//     bridgeConceptDefinition?,   // when type='bridge_child'
//     bridgeChildren?             // when type='bridge' (algo view nested rendering)
//   }
const Concept = ({_id, firstChild, lastChild, concept, setShowHighlights, isShown, onCardClick, onMap, isSelectedForMap, noScore, repoVersion, isAIRecommended, sx, notClickable, noSynonymPrefix, locales, showAlgo, candidatesScore, algoScoreFirst, asTarget, AIRecommendedCandidateId}) => {
  if(!concept?.conceptDefinition) return null
  const { type, candidate, conceptDefinition, conceptRow, bridgeConceptDefinition, bridgeChildren } = concept
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
                  candidate={child.candidate}
                  conceptDefinition={child.conceptDefinition}
                  conceptRow={child.conceptRow}
                  bridgeConceptDefinition={conceptDefinition}
                  repoVersion={repoVersion}
                  synonymPrefix={synonymPrefix}
                  setShowHighlights={setShowHighlights}
                  isSelectedForMap={isSelectedForMap}
                  onMap={onMap}
                  noScore={algoScoreFirst}
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
    repoVersion={repoVersion}
    synonymPrefix={synonymPrefix}
    setShowHighlights={setShowHighlights}
    isAIRecommended={isAIRecommended || isAIMatch}
    isSelectedForMap={isSelectedForMap}
    onMap={onMap}
    noScore={noScore}
    bridgeChild={type === 'bridge_child' && Boolean(bridgeConceptDefinition)}
    showAlgo={showAlgo}
    candidatesScore={candidatesScore}
    algoScoreFirst={algoScoreFirst}
  />
}

export default Concept;
