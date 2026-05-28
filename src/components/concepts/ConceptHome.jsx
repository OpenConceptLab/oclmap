import React from 'react';
import { useLocation } from 'react-router-dom'
import Fade from '@mui/material/Fade';
import Skeleton from '@mui/material/Skeleton';
import APIService from '../../services/APIService';
import { toParentURI } from '../../common/utils'
import ConceptHeader from './ConceptHeader';
import ConceptForm from './ConceptForm'
import ConceptDetails from './ConceptDetails'

const ConceptHome = props => {
  const location = useLocation()
  const isInitialMount = React.useRef(true);

  const [concept, setConcept] = React.useState(props.concept || {})

  const [repo, setRepo] = React.useState(props.repo || {})
  const [edit, setEdit] = React.useState(false)

  const [loading, setLoading] = React.useState(false)
  const [loadingOwnerMappings, setLoadingOwnerMappings] = React.useState(null)
  const [mappings, setMappings] = React.useState([])
  const [reverseMappings, setReverseMappings] = React.useState([])
  const [ownerMappings, setOwnerMappings] = React.useState([])
  const [reverseOwnerMappings, setReverseOwnerMappings] = React.useState([])

  React.useEffect(() => {
    setLoading(true)
    setConcept(props.concept || {})
    getService().get().then(response => {
      const resource = response.data
      setConcept({...resource, search_meta: {...(props?.concept?.search_meta || {})}})
      props.repo?.id ? setRepo(repo) : fetchRepo(resource)
      getMappings(resource)
    })
  }, [props.concept?.id, props.url])

  React.useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
    } else {
      props?.onClose()
    }
  }, [location])

  const fetchRepo = _concept => props?.repo?.id ? setRepo(props.repo) : APIService.new().overrideURL(getRepoURL(_concept)).get().then(response => setRepo(response.data))

  const getRepoURL = _concept => {
    if(props?.repo?.id)
      return props?.repo?.version_url || props?.repo?.url
    let url = toParentURI(_concept?.version_url || _concept?.url || props?.url || '')
    const repoVersion = _concept?.latest_source_version || concept?.latest_source_version
    if(repoVersion)
      url += repoVersion + '/'
    return url
  }

  const onEdit = () => setEdit(true)

  const getService = () => {
    let _concept = props.concept?.id ? props.concept : concept
    let url = _concept?.version_url || _concept?.url || props.url
    const parentURL = getRepoURL()
    if(parentURL && _concept?.id)
      url = `${parentURL}concepts/${encodeURIComponent(_concept.id)}/`

    return APIService.new().overrideURL(encodeURI(url))
  }

  const getMappings = (concept, directOnly) => {
    getService()
      .appendToUrl('$cascade/')
      .get(
        null,
        null,
        {
          uri: concept?.source_url,
          cascadeLevels: 1,
          method: 'sourceToConcepts',
          view: 'hierarchy',
        }
      )
      .then(response => {
        setMappings(response?.data?.entry?.entries || [])
        if(directOnly)
          setTimeout(() => setLoading(false), 300)
        !directOnly && getInverseMappings(concept)
      })
  }

  const getInverseMappings = concept => {
    getService()
      .appendToUrl('$cascade/')
      .get(
        null,
        null,
        {
          uri: concept?.source_url,
          cascadeLevels: 1,
          method: 'sourceToConcepts',
          view: 'hierarchy',
          reverse: true,
        })
      .then(response => {
        setReverseMappings(response?.data?.entry?.entries || [])
        setTimeout(() => setLoading(false), 300)
      })
  }

  const getOwnerMappings = (concept, directOnly) => {
    setLoadingOwnerMappings(true)
    APIService
      .mappings()
      .get(null, null, {
        ownerType: concept.owner_type,
        owner: concept.owner,
        fromConcept: concept.id,
        fromConceptSource: concept.source,
        source: `!${concept.source}`,
        brief: true,
        pageSize: 1000
      })
      .then(response => {
        setOwnerMappings(response?.data || [])
        if(directOnly)
          setTimeout(() => setLoadingOwnerMappings(false), 300)
        !directOnly && getInverseOwnerMappings(concept)
      })
  }

  const getInverseOwnerMappings = concept => {
    APIService
      .mappings()
      .get(null, null, {
        ownerType: concept.owner_type,
        owner: concept.owner,
        toConcept: concept.id,
        toConceptSource: concept.source,
        source: `!${concept.source}`,
        brief: true,
        pageSize: 1000
      })
      .then(response => {
        setReverseOwnerMappings(response?.data || [])
        setTimeout(() => setLoadingOwnerMappings(false), 300)
      })
  }

  return (concept?.id && repo?.id) ? (
    <>
      <Fade in={edit}>
        <div className='col-xs-12 padding-0'>
          {
            edit &&
              <ConceptForm
                edit
                repoSummary={props.repoSummary}
                concept={concept}
                source={repo}
                repo={repo}
                onClose={() => setEdit(false)}
              />
          }
        </div>
      </Fade>
      <Fade in={!edit}>
        <div className='col-xs-12' style={{padding: '8px 16px 12px 16px', ...props.style}}>
          {
            !edit &&
              <>
                {
                  !props.hideHeader &&
                    <div className='col-xs-12 padding-0'>
                      <ConceptHeader
                        concept={concept}
                        onClose={props.onClose}
                        repoURL={getRepoURL()}
                        onEdit={onEdit}
                        repo={repo}
                        nested={props.nested}
                        loading={loading}
                        onMap={props.onMap}
                        isSelectedForMap={props.isSelectedForMap}
                        aiRecommended={props.aiRecommended}
                        aiAlternate={props.aiAlternate}
                        crossRowCode={props.crossRowCode}
                        hideClose={props.hideClose}
                        hideDragHandle={props.hideDragHandle}
                      />
                    </div>
                }
                <ConceptDetails
                  style={props.detailsStyle}
                  concept={concept}
                  repo={repo}
                  mappings={mappings}
                  reverseMappings={reverseMappings}
                  loading={loading}
                  ownerMappings={ownerMappings}
                  reverseOwnerMappings={reverseOwnerMappings}
                  loadingOwnerMappings={loadingOwnerMappings}
                  onLoadOwnerMappings={() => getOwnerMappings(concept)}
                  effectiveLocales={props.effectiveLocales}
                  linkedConceptUrls={props.linkedConceptUrls}
                  linkedConceptLabel={props.linkedConceptLabel}
                />
              </>
          }
        </div>
      </Fade>
    </>
  ) : <Skeleton variant="rounded" width='100%' height='100%' />
}


export default ConceptHome;
