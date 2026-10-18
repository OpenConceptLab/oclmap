import React from 'react';
import Retired from '../common/Retired';
import OwnerIcon from '../common/OwnerIcon';
import RepoVersionButton from '../repos/RepoVersionButton';

// The Mapper lists only concepts, so they are the only resource with table
// columns (OpenConceptLab/ocl_issues#2917).
export const ALL_COLUMNS = {
  concepts: [
    {id: 'id', labelKey: 'common.id', value: 'id', sortOn: 'id_lowercase', className: 'searchable', permanent: true},
    {id: 'name', labelKey: 'concept.display_name', value: 'display_name', sortOn: '_name', className: 'searchable', sortBy: 'asc', sortable: false, permanent: true, renderer: item => (
      <span>
        <React.Fragment>
          {item.retired && <Retired style={{marginRight: '8px'}}/>} {item.display_name}
        </React.Fragment>
      </span>
    )
    },
    {id: 'concept_class', labelKey: 'concept.concept_class', value: 'concept_class', sortOn: 'concept_class', className: 'searchable', sx: {whiteSpace: 'pre'}, property: true},
    {id: 'datatype', labelKey: 'concept.datatype', value: 'datatype', sortOn: 'datatype', className: 'searchable', property: true},
    {id: 'owner', labelKey: 'common.owner', value: 'owner', sortOn: 'owner', nested: false, renderer: item => (<span style={{display: 'flex', whiteSpace: 'nowrap'}}><OwnerIcon noTooltip ownerType={item.owner_type} fontSize='small' sx={{marginRight: '4px'}}/>{item.owner}</span>)},
    {id: 'parent', labelKey: 'repo.repo', value: 'source', sortOn: 'source', nested: false, renderer: item => <RepoVersionButton repoType='Source' repo={item.source} version={item.latest_source_version} vertical />},
  ],
};


export const HIGHLIGHT_ICON_WHITELISTED_FILEDS = {
  concepts: ['external_id', 'same_as_map_codes', 'other_map_codes'],
  mappings: ['external_id'],
  sources: ['external_id'],
  collections: ['external_id'],
  organizations: ['external_id'],
  users: ['external_id'],
}

export const FACET_ORDER = {
  concepts: ['conceptClass', 'source', 'datatype', 'owner', 'locale', 'nameTypes', 'ownerType', 'descriptionTypes', 'retired', 'collection_membership', 'updatedBy'],
  mappings: [
    'owner', 'ownerType', 'source', 'mapType',
    'fromConceptOwner', 'fromConceptOwnerType', 'fromConceptSource', 'fromConcept',
    'toConceptOwner', 'toConceptOwnerType', 'toConceptSource', 'toConcept',
    'retired', 'collection_membership', 'updatedBy'
  ],
  "repos": ["sourceType", "collectionType", "owner", "ownerType", "customValidationSchema", "locale"]
}

export const SORT_ATTRS = {
  global: {
    concepts: ['score', 'ID', 'name', 'concept_class', 'datatype', 'source', 'owner'],
    mappings: ['score', 'ID', 'map_type', 'source', 'owner'],
  },
  nested: {
    concepts: ['score', 'last_update', 'ID', 'numeric_id', '_name', 'concept_class', 'datatype'],
    mappings: ['score', 'last_update', 'ID', 'map_type'],
  },
  common: {
    users: ['score', 'username', 'date_joined', 'company', 'location'],
    orgs: ['score', 'last_update', 'name', 'ID'],
    repos: ['score', 'last_update', 'ID', 'name', 'owner', 'canonical_url'],
  },
}
