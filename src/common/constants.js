import packageJson from '../../package.json';

export const OCL_CLIENT = `oclmap/${packageJson.version}`;
export const LANGUAGES = [
  {locale: 'en', name: 'English'},
  {locale: 'es', name: "Español"},
  {locale: 'zh', name: "中文"}
]


export const DATE_FORMAT = 'M/D/YYYY';
export const TIME_FORMAT = 'h:mm A';
export const DATETIME_FORMAT = DATE_FORMAT + ' ' + TIME_FORMAT;
export const DEFAULT_LIMIT = 25;
export const EMPTY_VALUE = '-';
export const SOURCE_TYPES = [
  'Dictionary',
  'Interface Terminology',
  'Indicator Registry',
  'External'
];
export const COLLECTION_TYPES = [
  'Dictionary',
  'Interface Terminology',
  'Indicator Registry',
  'Value Set',
  'Subset',
];
/*eslint no-useless-escape: 0*/
export const SOURCE_CHILD_URI_REGEX = /\/(orgs|users)\/([a-zA-Z0-9\-\.\_\@]+)\/(sources|collections)\/([a-zA-Z0-9\-\.\_\@]+)\/(concepts|mappings)\/([a-zA-Z0-9\-\.\_\@]+)?\/?([a-zA-Z0-9\-\.\_\@]+)?\/?/;
export const OCL_SERVERS_GROUP = 'ocl_servers';
export const OCL_FHIR_SERVERS_GROUP = 'ocl_fhir_servers';
export const HAPI_FHIR_SERVERS_GROUP = 'hapi_fhir_servers';
export const OPERATIONS_PANEL_GROUP = 'operations_panel';
export const AUTH_GROUPS = [
  {id: OCL_SERVERS_GROUP, name: 'OCL Servers'},
  {id: OCL_FHIR_SERVERS_GROUP, name: 'OCL FHIR Servers'},
  {id: HAPI_FHIR_SERVERS_GROUP, name: 'HAPI FHIR Servers'},
  {id: OPERATIONS_PANEL_GROUP, name: 'Operations Panel'},
];
export const ROUTE_ID_PATTERN = "[a-zA-Z0-9\-\.\_\@]+";
export const TABLE_LAYOUT_ID = 'table';
export const LIST_LAYOUT_ID = 'list';
export const SPLIT_LAYOUT_ID = 'split';
export const OPENMRS_URL = 'https://openmrs.openconceptlab.org';
export const DEFAULT_FHIR_SERVER_FOR_LOCAL_ID = 6;
export const FHIR_OPERATIONS = ['$validate-code', '$lookup'];
export const UUID_LENGTH = 8+4+4+4+12+4; // last 4 is for 4 hyphens

export const CASCADE_OPTIONS = {
  method: [
    {id: 'sourcetoconcepts', name: 'Mappings & Target Concepts'},
    {id: 'sourcemappings', name: 'Mappings'},
  ],
  view: ['flat', 'hierarchy']
}
export const DEFAULT_CASCADE_PARAMS = {
  method: 'sourcetoconcepts',
  mapTypes: '',
  excludeMapTypes: '',
  returnMapTypes: '*',
  cascadeHierarchy: true,
  cascadeMappings: true,
  includeRetired: false,
  cascadeLevels: '*',
  reverse: false,
  view: 'flat',
  omitIfExistsIn: '',
  equivalencyMapType: '',
}

export const ALL = '*';
export const URL_REGISTRY_DOC_LINK = 'https://docs.openconceptlab.org/en/latest/oclapi/apireference/urlregistry.html'
export const MATCHING_ALGORITHMS_DOC_LINK = 'https://docs.openconceptlab.org/en/latest/oclmap/matching-algorithms.html'
export const MAPPER_ANNOUNCEMENT_URL = 'https://openconceptlab.org/blog?utm_source=oclmap&utm_medium=banner&utm_campaign=preview_launch'
