import React from 'react'
import ListItemButton from '@mui/material/ListItemButton'
import ListItem from '@mui/material/ListItem'
import ListItemText from '@mui/material/ListItemText'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import isString from 'lodash/isString'
import map from 'lodash/map'
import find from 'lodash/find'
import keys from 'lodash/keys'

import Retired from '../common/Retired'
import Score from './Score'
import MapButton from './MapButton'
import ConceptSummaryProperties from '../concepts/ConceptSummaryProperties'


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


const Item = ({concept, setShowHighlights, onMap, isSelectedForMap, noScore, repoVersion, synonymPrefix, isAIRecommended, bridge, bridgeChild, mapping, showAlgo, candidatesScore, algoScoreFirst, placeholderMap, conceptCache}) => {
  const isValidBridge = Boolean(bridge && mapping.cascade_target_concept_code)
  const findConceptInCache = resource => {
    let id = resource?.id || resource?.code
    if(id) {
      let url = find(keys(conceptCache), url => url.endsWith(`/concepts/${id}/`))
      if(url)
        return conceptCache[url]
    }
    return null
  }
  const conceptToMap = isValidBridge ?
        {
          id: mapping.cascade_target_concept_code,
          name: mapping.cascade_target_concept_name,
          display_name: mapping.cascade_target_concept_name,
          url: mapping.cascade_target_concept_url,
          source: mapping.cascade_target_source_name,
          type: 'Concept',
          search_meta: concept.search_meta
        } : concept
  const cached = findConceptInCache(conceptToMap)
  if(cached)
    isValidBridge ? conceptToMap.target_concept = cached : conceptToMap._source = cached
  const getConceptDisplay = () => {
    if(bridge) {
      if(conceptToMap?.target_concept?.id)
        return `${conceptToMap.source || conceptToMap.target_concept.source}:${conceptToMap.target_concept.id} ${conceptToMap.target_concept.display_name}`
      return `${conceptToMap.source}:${conceptToMap.id} ${conceptToMap.display_name || ''}`
    }
  }
  let bridgeMappingPrefix = bridge && mapping.cascade_target_concept_code ? `${mapping.cascade_target_source_name}:${mapping.cascade_target_concept_code} ${mapping.cascade_target_concept_name || ''}` : false
  const mapTypeToApply = isValidBridge ? mapping?.map_type || concept?.search_meta?.map_type : concept?.search_meta?.map_type
  return (
    <>
      <ListItemText
        primary={
          <span>
            <span>
              {
                !bridgeChild &&
                  <span className='searchable'>{`${concept?.source || concept?.repo?.short_code || concept?.repo?.id || concept?.search_meta?.source}:${concept?.id}`}</span>
              }
              {
              !bridgeChild &&
                  <span style={{marginLeft: '4px'}} className='searchable'>
                    {
                      !bridge && synonymPrefix &&
                        <span className='searchable'>
                          <span dangerouslySetInnerHTML={{__html: synonymPrefix}}/>
                          <span style={{margin: '0 5px'}}>&rarr;</span>
                        </span>
                    }
                    {concept?.display_name}
                  </span>
              }
              {
                bridgeMappingPrefix &&
                  <span>
                    {!bridgeChild && <span style={{margin: '0 5px'}}>&rarr;</span>}
                    <span style={bridgeChild ? {marginRight: '8px'} : {}}>
                      {
                        bridgeChild ?
                          <Chip size='small' label={mapping.map_type} /> :
                        (`[${mapping.map_type}]`)
                      }
                    </span>
                    {!bridgeChild && <span style={{margin: '0 5px'}}>&rarr;</span>}
                    <span className='searchable'>{getConceptDisplay()}</span>
                  </span>
              }
            </span>
            {
              concept?.retired &&
                <Retired size='small' style={{margin: '0 12px'}} />
            }
          </span>
        }
        secondary={
          <div className='col-xs-12 padding-0'>
            <div className='col-xs-12 padding-0'>
              <ConceptSummaryProperties concept={concept} repoVersion={repoVersion} />
            </div>
            {
              showAlgo && concept?.search_meta?.algorithm ?
                <div className='col-xs-12 padding-0' style={{marginTop: '4px'}}>
                  <Chip size='small' label={concept.search_meta.algorithm} variant='outlined' color='warning' />
              </div> : null
            }
          </div>
        }
        sx={{margin: '2px 0', '.MuiListItemText-primary': {fontSize: '14px'}, '.MuiListItemText-secondary': {fontSize: '12px', overflow: 'scroll'}}}
      />
      <span style={{display: 'flex', alignItems: 'flex-start'}}>
        {
          !noScore &&
            <Score size='small' concept={concept} setShowHighlights={setShowHighlights} isAIRecommended={isAIRecommended} candidatesScore={candidatesScore} algoScoreFirst={algoScoreFirst} />
        }
        {
        isSelectedForMap &&
            <MapButton
              simple
              selected={mapTypeToApply}
              onClick={(event, applied, mapType) => onMap(event, conceptToMap, !applied, mapping?.map_type || mapType)}
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


const Concept = ({_id, firstChild, lastChild, concept, setShowHighlights, isShown, onCardClick, onMap, isSelectedForMap, noScore, repoVersion, isAIRecommended, AIRecommendedCandidateId, sx, notClickable, noSynonymPrefix, locales, showAlgo, candidatesScore, algoScoreFirst, asTarget, conceptCache}) => {
  const bridge = concept?.search_meta?.algorithm?.includes('bridge')
  const scispacy = concept?.search_meta?.algorithm === 'ocl-scispacy-loinc'
  const id = concept?.version_url || concept?.url || concept?.id
  const isSelectedToShow = isShown ? isShown(id) : false

  let synonymPrefix = ''
  const highlights = concept?.search_meta?.search_highlight
  const synonymHighlight = highlights?.synonyms
  const nameHighlight = highlights?.name
  if(!nameHighlight?.length && synonymHighlight?.length && !noSynonymPrefix) {
    let bestMatch = getBestSynonym(synonymHighlight) || synonymHighlight[0]
    if(locales && bestMatch) {
      let raw = bestMatch.replaceAll("<em>", "").replaceAll("</em>", "")
      let _locales = isString(locales) ? locales.split(',') : locales
      if(_locales?.length > 0 && !_locales.includes(concept.names.find(name => name.name.startsWith(raw))?.locale))
        bestMatch = ''
    }
    synonymPrefix = bestMatch.replaceAll('<em>', "<b className='searchable'>").replaceAll('</em>', '</b>')
  }

  const props = {
    id: id,
    _id: _id,
    notClickable: notClickable,
    firstChild: firstChild,
    lastChild: lastChild,
    isSelectedToShow: isSelectedToShow,
    sx: sx,
    onCardClick: onCardClick,
    conceptCache: conceptCache
  }

  if(bridge) {
    return (
      <>
      {
        algoScoreFirst &&
          <ConceptItem
            {...props}
            concept={concept}
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
          />
      }
        {
          asTarget ?
            <ConceptItem
              {...props}
              concept={concept}
              repoVersion={repoVersion}
              isSelectedForMap={false}
              placeholderMap
              noScore
              showAlgo={false}
            /> :

        <div className='col-xs-12' style={{paddingRight: 0, paddingLeft: algoScoreFirst ? '12px' : 0}}>
        {
          map(concept?.mappings, (mapping, index) => {
            return <ConceptItem
                     key={`${index}-${crypto.randomUUID()}`}
                     {...props}
                     concept={concept}
                     repoVersion={repoVersion}
                     synonymPrefix={synonymPrefix}
                     setShowHighlights={setShowHighlights}
                     isAIRecommended={
                       !isAIRecommended &&
                         AIRecommendedCandidateId === mapping?.cascade_target_concept_code
                     }
                     isSelectedForMap={isSelectedForMap}
                     onMap={onMap}
                     noScore={noScore}
                     bridge={bridge}
                     mapping={mapping}
                     showAlgo={showAlgo}
                     candidatesScore={candidatesScore}
                     algoScoreFirst={algoScoreFirst}
                     bridgeChild={algoScoreFirst}
                   />
          })
        }
        </div>
        }
      </>
    )
  }

  return <ConceptItem
           {...props}
           concept={concept}
           repoVersion={repoVersion}
           synonymPrefix={synonymPrefix}
           setShowHighlights={setShowHighlights}
           isAIRecommended={isAIRecommended}
           isSelectedForMap={isSelectedForMap}
           onMap={onMap}
           noScore={noScore}
           bridge={bridge}
           scispacy={scispacy}
           showAlgo={showAlgo}
           candidatesScore={candidatesScore}
           algoScoreFirst={algoScoreFirst}
         />
}

export default Concept;
