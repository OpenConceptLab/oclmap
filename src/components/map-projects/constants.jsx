import React from 'react'
import ListIcon from '@mui/icons-material/FormatListNumbered';
import UnMappedIcon from '@mui/icons-material/LinkOff';
import MappedIcon from '@mui/icons-material/Link';
import ReviewedIcon from '@mui/icons-material/FactCheckOutlined';
import { RECOMMEND_COLOR, AVAILABLE_COLOR, UNRANKED_COLOR, PENDING_RERANK_COLOR } from '../../common/colors'

const ID_HEADER = {id: 'id', label: 'ID', description: 'Exact match on concept ID'}
const COMMON_HEADERS = [
  {id: 'description', label: 'Description', description: 'Basic string search on concept descriptions'},
  {id: 'mapping_code', label: 'Mapping: Code', description: 'Matches concepts in the target repo that share a mapping with the input row. For example, the input row and target concept share a mapping to the same LOINC code.'},
  {id: 'mapping_list', label: 'Mapping: List', description: 'Matches the target repo concept ID or when an input row and a concept in the target repo share a common mapping'},
  {id: 'concept_class', label: 'Property: Class', description: 'String matching on concept class (e.g. diagnosis, symptom)'},
  {id: 'datatype', label: 'Property: Datatype', description: 'String matching on concept datatype (e.g. numeric, coded)'},
]

export const HEADERS = [
  ID_HEADER,
  {id: 'name', label: 'Name', description: 'Fuzzy string search on primary display name'},
  {id: 'synonyms', label: 'Synonyms', description: 'Fuzzy string search on all concept names and synonyms'},
  ...COMMON_HEADERS
]

export const SEMANTIC_SEARCH_HEADERS = [
  ID_HEADER,
  {id: 'name', label: 'Name', description: 'Semantic search (cosine similarity) on primary display name'},
  {id: 'synonyms', label: 'Synonyms', description: 'Semantic search (cosine similarity) on all concept names and synonyms'},
  ...COMMON_HEADERS
]

export const ROW_STATES = ['unmapped', 'readyForReview', 'reviewed']
export const VIEWS = {
  all: {
    label: 'All',
    icon: <ListIcon fontSize='small' />,
    color: 'grey',
  },
  unmapped: {
    label: 'Unmapped',
    icon: <UnMappedIcon fontSize='small' />,
    color: 'secondary',
  },
  readyForReview: {
    label: 'Proposed',
    icon: <MappedIcon fontSize='small' />,
    color: 'warning',
  },
  reviewed: {
    label: 'Approved',
    icon: <ReviewedIcon fontSize='small' />,
    color: 'primary',
  },
}

export const DECISION_TABS = ['candidates', 'search', 'propose', 'discuss']

export const SCORES_COLOR = {
  recommended: RECOMMEND_COLOR,
  available: AVAILABLE_COLOR,
  low_ranked: UNRANKED_COLOR,
  pending_rerank: PENDING_RERANK_COLOR
}

export const SEMANTIC_BATCH_SIZE = 10
export const ES_BATCH_SIZE = 50
export const CANDIDATES_LIMIT = 30

export const ROW_STAGES = {
  '-3': 'na',
  '-2': 'failed',
  '-1': 'not_started',
  '0': 'in_progress',
  '1': 'completed'
}
export const PROMPTS_KEY_DEFAULT = 'match-recommend-normalized'
export const PROMPTS_ACTION_TYPE_DEFAULT = 'match-recommend'
