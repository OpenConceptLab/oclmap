/*eslint no-process-env: 0*/
import 'core-js/features/url-search-params';
import React from 'react';
import ReactGA from 'react-ga4';
import moment from 'moment';
import { Tooltip } from '@mui/material';
import {
  filter, difference, compact, find, reject, intersectionBy, size, keys, omitBy, isEmpty,
  get, includes, map, isArray, values, pick, sortBy, zipObject, orderBy, isObject, merge,
  uniqBy, cloneDeep, isEqual, without, capitalize, last, nth, startCase, uniq, flatten, pickBy, upperFirst
} from 'lodash';
import {
  DATE_FORMAT, TIME_FORMAT, DATETIME_FORMAT, OCL_SERVERS_GROUP, OCL_FHIR_SERVERS_GROUP, HAPI_FHIR_SERVERS_GROUP,
  OPENMRS_URL, DEFAULT_FHIR_SERVER_FOR_LOCAL_ID, OPERATIONS_PANEL_GROUP
} from './constants';
import APIService from '../services/APIService';
import { SERVER_CONFIGS } from './serverConfigs';

export const currentPath = () => window.location.hash.split('?')[0];

export const isAtGlobalSearch = () => window.location.hash.includes('#/search') || isAtRoot();

export const isAtRoot = () => currentPath() === '#/';

export const formatDate = date => moment(date).format(DATE_FORMAT);
export const formatTime = date => moment(date).format(TIME_FORMAT);
export const formatDateTime = date => moment(date).format(DATETIME_FORMAT);

export const formatWebsiteLink = (value, style, text) => {
  if(value && value.trim()) {
    let href = value.trim();
    if(!href.startsWith('http://') && !href.startsWith('https://'))
      href = 'https://' + href;

    return (
      <a
        target='_blank'
        rel="noopener noreferrer"
        href={href}
        className="ellipsis-text"
        style={merge({maxWidth: '100px'}, (style || {}))}>
        {text || value.trim()}
      </a>
    );
  }
  return '';
}

export const formatWebsiteLinkTruncated = (value, style, text) => {
  if(value && value.trim()) {
    let href = value.trim();
    if(!href.startsWith('http://') && !href.startsWith('https://'))
      href = 'https://' + href;

    const label = text || value.trim()

    return (
      <Tooltip title={label}>
        <a
          target='_blank'
          rel="noopener noreferrer"
          href={href}
          className="ellipsis-text"
          style={merge({width: 'auto', display: 'inline-block'}, (style || {}))}>
          {label}
        </a>
      </Tooltip>
    );
  }
  return '';
}

export const getIndirectMappings = (mappings, concept_url) => filter(mappings, {to_concept_url: concept_url});

export const getDirectMappings = (mappings, concept_url) => filter(mappings, {from_concept_url: concept_url});

export const getDirectExternalMappings = (mappings, concept_url) => filter(mappings, mapping => Boolean(mapping.from_concept_url === concept_url && mapping.external_id));

export const getLinkedQuestions = (mappings, concept_url) => filter(mappings, {to_concept_url: concept_url, map_type: 'Q-AND-A'});

export const getLinkedAnswers = (mappings, concept_url) => filter(mappings, {from_concept_url: concept_url, map_type: 'Q-AND-A'});

export const getSetParents = (mappings, concept_url) => filter(mappings, {to_concept_url: concept_url, map_type: 'CONCEPT-SET'});

export const getSetMembers = (mappings, concept_url) => filter(mappings, {from_concept_url: concept_url, map_type: 'CONCEPT-SET'});

export const getMappingsDistributionByMapType = (mappings, concept_url) => {
  const linkedQuestions = getLinkedQuestions(mappings, concept_url);
  const linkedAnswers = getLinkedAnswers(mappings, concept_url);
  const setParents = getSetParents(mappings, concept_url);
  const setMembers = getSetMembers(mappings, concept_url);
  const directExternalMappings = getDirectExternalMappings(
    difference(mappings, [...linkedAnswers, ...linkedQuestions, ...setParents, ...setMembers]),
    concept_url
  );
  const directInternalMappings = getDirectMappings(
    difference(mappings, [...linkedAnswers, ...linkedQuestions, ...setParents, ...setMembers, ...directExternalMappings]),
    concept_url
  );
  const indirectMappings = getIndirectMappings(
    difference(mappings, [...linkedAnswers, ...linkedQuestions, ...setParents, ...setMembers, ...directExternalMappings, ...directInternalMappings]),
    concept_url
  );

  return {
    'Linked Question': linkedQuestions,
    'Linked Answers': linkedAnswers,
    'Set Parent': setParents,
    'Set Members': setMembers,
    'Direct External Mapping': directExternalMappings,
    'Direct Internal Mapping': directInternalMappings,
    'Inverse Mapping': indirectMappings,
  }
}

export const getAPIURL = () => {
  const savedConfigs = getSelectedServerConfig();
  /*eslint no-undef: 0*/
  return get(savedConfigs, 'url') || window.API_URL || process.env.API_URL;
}

export const toFullURL = uri => window.location.origin + '/#' + uri;

export const toFullAPIURL = uri => getAPIURL() + uri;

export const toRelativeURL = url => url.replace(getAPIURL(), '');

export const copyToClipboard = copyText => {
  if(copyText)
    navigator.clipboard.writeText(copyText);
}

export const copyURL = url => copyToClipboard(url, 'Copied URL to clipboard!');

export const toParentURI = uri => uri.split('/').splice(0, 5).join('/') + '/';
export const toParentVersionURI = uri => uri.split('/').splice(0, 6).join('/') + '/';

export const toOwnerURI = uri => uri && uri.split('/').splice(0, 3).join('/') + '/';

export const headFirst = versions => compact([find(versions, version => (version.version || version.id) === 'HEAD'), ...reject(versions, version => (version.version || version.id) === 'HEAD')]);

export const currentUserToken = () => localStorage.token;

export const isLoggedIn = () => Boolean(currentUserToken());

export const getCurrentUser = () => {
  const data = localStorage.user;
  if(data)
    return JSON.parse(data);

  return null;
};

export const getCurrentUserOrgs = () => {
  const user = getCurrentUser()
  return sortOrgs(user?.subscribed_orgs)
};

export const sortOrgs = orgs => {
  return [
    ...orderBy(filter(orgs, 'logo_url'), [org => org?.id?.toLowerCase()], 'asc'),
    ...orderBy(reject(orgs, 'logo_url'), [org => org?.id?.toLowerCase()], 'asc')
  ]
}

export const getCurrentUserUsername = () => get(getCurrentUser(), 'username');

export const nonEmptyCount = (object, attributes) => size(intersectionBy(keys(omitBy(object, val => (isEmpty(val) || includes(['none', 'None'], val)))), attributes));

export const isCurrentUserMemberOf = orgId => Boolean(orgId && includes(map(getCurrentUserOrgs(), 'id'), orgId));

export const canAccessUser = username => {
  const currentUser = getCurrentUser()
  return currentUser?.is_staff || currentUser?.username === username
}

export const canEditUser = username => getCurrentUser()?.username === username

export const defaultDeletePin = (service, callback) => {
  if(service) {
    service.delete().then(response => {
      if(callback && get(response, 'status') === 204)
        callback();
    });
  }
}

export const isAdminUser = () => {
  const currentUser = getCurrentUser();
  return get(currentUser, 'is_staff') || get(currentUser, 'is_superuser');
}

export const isSuperuser = () => get(getCurrentUser(), 'is_superuser');

export const toObjectArray = obj => isEmpty(obj) ? [] : map(keys(obj), k => pick(obj, k));

export const sortObjectBy = (obj, comparator) => {
  const _keys = sortBy(keys(obj), key => comparator ? comparator(obj[key], key) : key);
  return zipObject(_keys, map(_keys, key => obj[key]));
}

export const arrayToObject = arr => {
  if(isEmpty(arr))
    return {};

  return arr.reduce((prev, curr) => {
    if(curr.key)
      prev[curr.key] = curr.value;
    return prev;
  }, {});
}

export const currentUserHasAccess = () => hasAccessToURL(window.location.hash.replace('#/', ''))

export const hasAccessToURL = url => {
  if(!isLoggedIn())
    return false;
  if(isAdminUser())
    return true;

  if(!url)
    return false;

  const url_parts = compact(url.split('/'));

  const ownerType = url_parts[0];
  const owner = url_parts[1];
  if(!owner || !ownerType)
    return false;

  const currentUser = getCurrentUser();
  if(ownerType === 'users')
    return currentUser?.username === owner;
  if(ownerType === 'orgs')
    return isSubscribedTo(owner);

  return false;
}

export const isSubscribedTo = org => Boolean(org && includes(map(get(getCurrentUser(), 'subscribed_orgs'), 'id'), org));

export const getCurrentURL = () => window.location.href.replace(new RegExp('/$'), '');

export const downloadObject = (obj, format, filename) => {
  const data = new Blob([obj], {type: format});
  downloadFromURL(window.URL.createObjectURL(data), filename);
}

export const downloadFromURL = (url, filename) => {
  const tempLink = document.createElement('a');
  tempLink.href = url;
  tempLink.setAttribute('download', filename);
  tempLink.click();
}

export const arrayToCSV = objArray => {
  const array = typeof objArray !== 'object' ? JSON.parse(objArray) : objArray;
  let str = `${Object.keys(array[0]).map(value => `"${value}"`).join(",")}` + '\r\n';

  return array.reduce((str, next) => {
    str += `${Object.values(next).map(value => isObject(value) ? `"${JSON.stringify(value)}"` : `"${value}"`).join(",")}` + '\r\n';
    return str;
  }, str);
}

export const refreshCurrentUserCache = callback => {
  APIService.user().get(null, null, {includeAuthGroups: true, includeSubscribedOrgs: true}).then(response => {
    if(response.status === 200) {
      localStorage.setItem('user', JSON.stringify(response.data));
      if(callback) callback(response);
    }
  });
}

export const replaceCurrentUserCacheWith = data => localStorage.setItem('user', JSON.stringify(data));

export const formatByteSize = bytes => {
  if(bytes < 1024) return bytes + " bytes";
  else if(bytes < 1048576) return(bytes / 1024).toFixed(3) + " KB";
  else if(bytes < 1073741824) return(bytes / 1048576).toFixed(3) + " MB";
  else return(bytes / 1073741824).toFixed(3) + " GB";
};


export const memorySizeOf = (obj, format=true) => {
  var bytes = 0;

  const sizeOf = obj => {
    if(obj !== null && obj !== undefined) {
      switch(typeof obj) {
        case 'number':
          bytes += 8;
          break;
        case 'string':
          bytes += obj.length * 2;
          break;
        case 'boolean':
          bytes += 4;
          break;
        case 'object':
          var objClass = Object.prototype.toString.call(obj).slice(8, -1);
          if(objClass === 'Object' || objClass === 'Array') {
            for(var key in obj) {
              if(!Object.prototype.hasOwnProperty.call(obj, key)) continue;
              sizeOf(obj[key]);
            }
          } else bytes += obj.toString().length * 2;
          break;
      }
    }
    return bytes;
  };


  const byteSize = sizeOf(obj);

  if(format)
    return formatByteSize(byteSize);

  return byteSize;
};

export const getCurrentUserCollections = callback => {
  const username = getCurrentUserUsername();
  if(username) {
    APIService
      .users(username)
      .collections()
      .get(null, null, {limit: 1000, includeSummary: true})
      .then(response => isArray(response.data) ? callback(response.data) : false);
    APIService
      .users(username)
      .orgs()
      .appendToUrl('collections/')
      .get(null, null, {limit: 1000, includeSummary: true})
      .then(response => isArray(response.data) ? callback(response.data) : false);
  }
}

export const getCurrentUserSources = callback => {
  const username = getCurrentUserUsername();
  if(username) {
    APIService
      .users(username)
      .sources()
      .get(null, null, {limit: 1000, includeSummary: true})
      .then(response => isArray(response.data) ? callback(response.data) : false);
    APIService
      .users(username)
      .orgs()
      .appendToUrl('sources/')
      .get(null, null, {limit: 1000, includeSummary: true})
      .then(response => isArray(response.data) ? callback(response.data) : false);
  }
}

export const isValidPassword = (password, strength, minStrength = 3) => {
  return Boolean(
    password &&
    strength >= minStrength &&
    password.length >= 8 &&
    password.match(new RegExp(/(?=.*[0-9])(?=.*[a-zA-Z])(?=\S+$)./g))
  );
}

export const getUserInitials = user => {
  user = user || getCurrentUser();
  if(!user)
    return '';

  let result = '';
  const first_name = get(user, 'first_name', '').trim();
  const last_name = get(user, 'last_name', '').trim();
  const username = user.username;
  const hasValidFirstName = first_name && first_name !== '-';
  const hasValidLastName = last_name && last_name !== '-';
  if(!hasValidFirstName && !hasValidLastName && username)
    result = username.slice(0, 2);
  if(hasValidFirstName)
    result = first_name[0];
  if(hasValidLastName)
    result += last_name[0];
  if(result.length == 1 && hasValidFirstName)
    result += first_name[1];

  return result.toUpperCase();
}

export const jsonifySafe = data => {
  if(!data)
    return data;

  try {
    return JSON.parse(data);
  } catch (err) {
    return data;
  }
}

export const getSelectedServerConfig = () => {
  const serverConfig = localStorage.getItem('server');
  if(serverConfig)
    return JSON.parse(serverConfig);
}

export const getAppliedServerConfig = () => {
  const selectedConfig = getSelectedServerConfig();

  if(selectedConfig)
    return selectedConfig;

  const APIURL = window.API_URL || process.env.API_URL;
  return find(SERVER_CONFIGS, {url: APIURL});
}

export const isServerSwitched = () => {
  const selectedServer = getSelectedServerConfig()
  return selectedServer && selectedServer.id !== getDefaultServerConfig()?.id;
};

export const getDefaultServerConfig = () => {
  const APIURL = window.API_URL || process.env.API_URL;
  return find(SERVER_CONFIGS, {url: APIURL});
}

export const getLocalFHIRServerConfig = () => find(SERVER_CONFIGS, {type: 'fhir', local: true});
export const getDefaultFHIRServerConfig = () => find(SERVER_CONFIGS, {id: DEFAULT_FHIR_SERVER_FOR_LOCAL_ID});

export const getFHIRServerConfigFromCurrentContext = () => {
  const server = getAppliedServerConfig();
  if(server.type === 'fhir')
    return server;
  if(server.fhirServerId)
    return find(SERVER_CONFIGS, {type: 'fhir', id: server.fhirServerId});
  if(server.local)
    return getLocalFHIRServerConfig() || getDefaultFHIRServerConfig();
}

export const canSwitchServer = () => {
  const user = getCurrentUser();

  return Boolean(
    getSelectedServerConfig() ||
    get(user, 'is_superuser') ||
      hasAuthGroup(user, 'server')
  );
}

export const hasAuthGroup = (user, groupName) => Boolean(find(user?.auth_groups, group => group.includes(groupName)))

export const canViewOperationsPanel = () => {
  const user = getCurrentUser()

  return Boolean(
    get(user, 'is_staff') ||
    hasAuthGroup(user, OPERATIONS_PANEL_GROUP)
  )
}

export const isFHIRServer = () => get(getAppliedServerConfig(), 'type') === 'fhir';

export const isConcept = uri => Boolean(uri.match('/concepts/'));
export const isMapping = uri => Boolean(uri.match('/mappings/'));


// https://stackoverflow.com/questions/10420352/converting-file-size-in-bytes-to-human-readable-string
/**
 * Format bytes as human-readable text.
 *
 * @param bytes Number of bytes.
 * @param si True to use metric (SI) units, aka powers of 1000. False to use
 *           binary (IEC), aka powers of 1024.
 * @param dp Number of decimal places to display.
 *
 * @return Formatted string.
 */
export const humanFileSize = (bytes, si=false, dp=1) => {
  const thresh = si ? 1000 : 1024;

  if (Math.abs(bytes) < thresh) {
    return bytes + ' B';
  }

  const units = si
              ? ['KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
              : ['KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB'];
  let u = -1;
  const r = 10**dp;

  do {
    bytes /= thresh;
    ++u;
  } while (Math.round(Math.abs(bytes) * r) / r >= thresh && u < units.length - 1);


  return bytes.toFixed(dp) + ' ' + units[u];
}

export const getServerConfigsForCurrentUser = () => {
  if(isAdminUser())
    return SERVER_CONFIGS;

  const defaultConfig = getDefaultServerConfig();
  const appliedConfig = getAppliedServerConfig();

  let eligible = [];
  if(isLoggedIn()) {
    const { auth_groups } = getCurrentUser();
    if(includes(auth_groups, OCL_SERVERS_GROUP))
      eligible = [...eligible, ...filter(SERVER_CONFIGS, {type: 'ocl'})];
    if(includes(auth_groups, OCL_FHIR_SERVERS_GROUP))
      eligible = [...eligible, ...filter(SERVER_CONFIGS, {type: 'fhir', hapi: false})];
    if(includes(auth_groups, HAPI_FHIR_SERVERS_GROUP))
      eligible = [...eligible, ...filter(SERVER_CONFIGS, {type: 'fhir', hapi: true})];
  } else {
    eligible = JSON.parse(localStorage.getItem('server_configs')) || [];
  }

  eligible = compact([defaultConfig, appliedConfig, ...eligible]);
  return uniqBy(eligible, 'id');
}

export const arrayToSentence = (arr, separator, lastSeparator=' and ') => {
  if(arr.length <= 2)
    return arr.join(lastSeparator);

  const newArr = cloneDeep(arr);
  newArr.push( `${lastSeparator}${newArr.pop()}`);
  return newArr.join(separator);
}

export const generateRandomString = () => Math.random().toString(36).substring(7);

export const getEnv = forURL => {
  const fqdn = window.location.origin;

  if(fqdn.match('app.staging.openconceptlab'))
    return 'staging';
  if(fqdn.match('app.qa.openconceptlab'))
    return 'qa';
  if(fqdn.match('app.demo.openconceptlab'))
    return 'demo';
  if(fqdn.match('app.dev.openconceptlab'))
    return 'dev';
  if(fqdn.match('app.staging.who.openconceptlab'))
    return forURL ? 'staging.who' : 'staging-who';
  if(fqdn.match('app.openconceptlab'))
    return forURL ? '' : 'production';

  return 'development';
}

export const getOpenMRSURL = () => {
  let env = getEnv(true);

  if(env === 'development')
    env = 'qa';

  if(env) env += '.';

  return OPENMRS_URL.replace('openmrs.', `openmrs.${env}`);
}

export const recordGAPageView = () => {
  /*eslint no-undef: 0*/
  ReactGA.initialize(window.GA_ACCOUNT_ID || process.env.GA_ACCOUNT_ID);
  ReactGA.send({ hitType: "pageview", page: window.location.pathname + window.location.hash });
}

export const recordGAAction = (category, action, label) => {
  /*eslint no-undef: 0*/
  if(category && action) {
    ReactGA.initialize(window.GA_ACCOUNT_ID || process.env.GA_ACCOUNT_ID);
    ReactGA.event({category: category, action: action, label: label || action, transport: "xhr"});
  }
}

export const recordGAUpsertEvent = (category, edit, resource) => {
  const actionPrefix = edit ? 'update' : 'create'
  resource = resource || category.replaceAll(' ', '_').toLowerCase()
  let action = `${actionPrefix}_${resource}`
  let label = `${startCase(actionPrefix)} ${startCase(resource)}`
  recordGAAction(category, action, label)
}

export const setUpRecentHistory = history => {
  history.listen(location => {
    recordGAPageView()
    let visits = JSON.parse(get(localStorage, 'visits', '[]'));
    let urlParts = compact(location.pathname.split('/'));
    let type = '';
    let category = '';
    let format = false;
    if(location.pathname.match('/login') || location.pathname === '/')
      return;
    if(location.pathname.match('/imports')) {
      type = category = 'import';
      format = true;
    } else if(location.pathname.match('/search/')) {
      category = 'search';
      const queryParams = new URLSearchParams(location.search);
      type = queryParams.get('type');
      format = true;
    } else if(location.pathname.match('/compare')) {
      category = 'compare';
      type = 'concepts';
      format = true;
    } else {
      if(urlParts.length <= 3) {
        type = category = urlParts[0];
        urlParts = without(urlParts, 'orgs', 'users');
      }
      if(urlParts.length == 4) {
        type = category = urlParts[2];
        urlParts = without(urlParts, 'orgs', 'users', 'sources', 'collections');
      }
      if(urlParts.length == 5) {
        if(includes(['mappings', 'concepts', 'versions', 'references'], last(urlParts))) {
          type = category = last(urlParts);
        }
        urlParts = without(urlParts, 'orgs', 'users', 'sources', 'collections');
      }
      if(urlParts.length >= 6) {
        if(location.pathname.match('/concepts/')) {
          type = category = 'concept';
        }
        if(location.pathname.match('/mappings/')) {
          type = category = 'mapping';
        }
        if(location.pathname.match('/references')) {
          type = category = 'reference';
        }
        if(location.pathname.match('/expansions')) {
          type = category = 'expansion';
        }
        urlParts = without(urlParts, 'orgs', 'users', 'sources', 'collections');
      }
    }
    if(!includes(['concepts', 'mappings'], last(urlParts)))
      urlParts = without(urlParts, 'concepts', 'mappings');
    let name = format ? map(urlParts, capitalize).join(' / ') : urlParts.join(' / ');
    if(category !== type && type)
      name += ' / ' + type;
    const lastVisit =  visits[0];
    if(isEqual(get(lastVisit, 'name'), name))
      visits.shift();
    visits.push({name: name, location: location, type: type || '', category: category || '', at: new Date().getTime()});
    visits = orderBy(visits, 'at', 'desc').slice(0, 10);
    localStorage.setItem('visits', JSON.stringify(visits));
  });
}

export const getSiteTitle = () => get(getAppliedServerConfig(), 'info.site.title', 'OCL');

export const getRandomColor = () => `#${Math.floor(Math.random()*16777215).toString(16)}`;

export const logoutUser = (redirectToLogin, forced) => {
  const clearTokens = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('id_token');
    localStorage.removeItem('user');
    localStorage.removeItem('visits');
  }

  const returnTo = window.location.origin + '/' + window.location.hash
  if(forced)
    sessionStorage.setItem('session_expired', 'true')

  const redirectURL = forced ?
    window.location.origin + '/#/signin?returnTo=' + encodeURIComponent(returnTo) :
    undefined
  const logoutURL = getSSOLogoutURL(redirectURL)

  clearTokens()
  if(logoutURL)
    window.location = logoutURL
  else if(redirectToLogin)
    window.location.href = getLoginURL(forced ? returnTo : undefined)
  else {
    window.location.hash = '#/';
    window.location.reload();
  }
}


export const paramsToParentURI = (params, versioned=false) => {
  let uri = '';
  if(params.org)
    uri += `/orgs/${params.org}`;
  else if (params.user)
    uri += `/users/${params.user}`;
  if(params.source)
    uri += `/sources/${params.source}`;
  else if(params.collection)
    uri += `/collections/${params.collection}`;
  if(params.version && !versioned && params.version !== 'summary')
    uri += `/${params.version}`;

  return uri + '/';
}

export const paramsToURI = (params, versioned=false, expansion=false) => {
  let uri = '';
  if(params.org)
    uri += `/orgs/${params.org}`;
  else if (params.user)
    uri += `/users/${params.user}`;
  if(params.source)
    uri += `/sources/${params.source}`;
  else if(params.collection)
    uri += `/collections/${params.collection}`;
  if(params.version && !versioned)
    uri += `/${params.version}`;
  if(params.expansion && !expansion)
    uri += `/expansions/${params.expansion}`;
  if(params.concept)
    uri += `/concepts/${params.concept}`;
  else if(params.mapping)
    uri += `/mappings/${params.mapping}`;
  if(params.conceptVersion && !versioned)
    uri += `/${params.conceptVersion}`;
  if(params.mappingVersion && !versioned)
    uri += `/${params.mappingVersion}`;

  return uri + '/';
}

export const URIToOwnerParams = uri => {
  const ownerURI = toOwnerURI(uri)
  let owner = {ownerType: undefined, owner: undefined, uri: ownerURI}
  if(ownerURI?.includes('/orgs/')) {
    owner.ownerType = 'Organization'
    owner.owner = ownerURI.split('/orgs/')[1].replaceAll('/', '')
  } else {
    owner.ownerType = 'User'
    owner.owner = ownerURI?.split('/users/')[1]?.replaceAll('/', '')
  }
  return owner
}

export const URIToParentParams = (uri, includeVersion=false) => {
  if(!uri)
    return {}
  const parentURI = includeVersion ? toParentVersionURI(uri) : toParentURI(uri)
  let parent = {ownerType: undefined, owner: undefined, url: parentURI, repo: undefined, repoType: undefined}
  const parts = parentURI.split('/')
  if(parts[1] === 'orgs') {
    parent.ownerType = 'Organization'
  } else {
    parent.ownerType = 'User'
  }
  parent.owner = parts[2]
  parent.repoType = upperFirst(parts[3]?.slice(0, -1))
  parent.repo = parts[4]
  if(includeVersion)
    parent.repoVersion = parts[5]
  return parent
}

export const getWidthOfText = (txt, fontname, fontsize) => {
  if(getWidthOfText.c === undefined){
    getWidthOfText.c=document.createElement('canvas');
    getWidthOfText.ctx=getWidthOfText.c.getContext('2d');
  }
  var fontspec = fontsize + ' ' + fontname;
  if(getWidthOfText.ctx.font !== fontspec)
    getWidthOfText.ctx.font = fontspec;
  return getWidthOfText.ctx.measureText(txt).width + 60;
}

export const getParamsFromObject = item => {
  let params = {};
  if(item.owner_type === 'Organization')
    params.org = item.owner;
  else if(item.owner_type === 'User')
    params.user = item.owner;
  if(item.source)
    params.source = item.source;
  if(item.map_type)
    params.mapping = item.id;
  else if (item.concept_class)
    params.concept = item.id;

  return params;
}

export const dropVersion = uri => {
  if(!uri)
    return uri

  const parts = uri.split('/')

  if (parts.length <= 4)
    return uri

  const resource = nth(parts, -4)
  const name = nth(parts, -3)
  const version = nth(parts, -2)
  if (['concepts', 'mappings', 'sources', 'collections'].includes(resource) && name && version)
    return parts.splice(0, parts.indexOf(nth(parts, -2))).join('/') + '/'

  return uri

}

// Internet Explorer 6-11
export const isIE = () => /*@cc_on!@*/false || !!document.documentMode;

// Chrome 1 - 71
export const isChrome = () => !!window.chrome && (!!window.chrome.webstore || !!window.chrome.runtime);

// Opera 8.0+
export const isOpera = () => (!!window.opr && !!opr.addons) || !!window.opera || navigator.userAgent.indexOf(' OPR/') >= 0;

export const isDeprecatedBrowser = () => isIE() || isOpera();

export const getLoginURL = returnTo => {
  const oidClientID = window.OIDC_RP_CLIENT_ID || process.env.OIDC_RP_CLIENT_ID
  let redirectURL = window.LOGIN_REDIRECT_URL || process.env.LOGIN_REDIRECT_URL
  redirectURL = redirectURL.replace(/([^:]\/)\/+/g, "$1");
  if(returnTo && returnTo.includes('/#/') && returnTo.split('/#/')[1])
    redirectURL = returnTo.replace('/#/', '/')
  return `${getAPIURL()}/users/login/?client_id=${oidClientID}&state=fj8o3n7bdy1op5&nonce=13sfaed52le09&redirect_uri=${redirectURL}`
}

export const getResetPasswordURL = returnTo => {
  let redirectURL = returnTo || window.LOGIN_REDIRECT_URL || process.env.LOGIN_REDIRECT_URL
  const oidClientID = window.OIDC_RP_CLIENT_ID || process.env.OIDC_RP_CLIENT_ID

  redirectURL = redirectURL.replace(/([^:]\/)\/+/g, "$1");

  return `${getAPIURL()}/users/password/reset/?client_id=${oidClientID}&redirect_uri=${redirectURL}`
}

export const getRegisterURL = returnTo => {
  let redirectURL = returnTo || window.LOGIN_REDIRECT_URL || process.env.LOGIN_REDIRECT_URL
  const oidClientID = window.OIDC_RP_CLIENT_ID || process.env.OIDC_RP_CLIENT_ID

  redirectURL = redirectURL.replace(/([^:]\/)\/+/g, "$1");

  return `${getAPIURL()}/users/signup/?client_id=${oidClientID}&state=fj8o3n7bdy1op5&nonce=13sfaed52le09&redirect_uri=${redirectURL}`
}


export const getSSOLogoutURL = returnTo => {
  const redirectURL = returnTo || window.LOGIN_REDIRECT_URL || process.env.LOGIN_REDIRECT_URL
  const idToken = localStorage.id_token
  if(redirectURL && idToken)
    return `${getAPIURL()}/users/logout/?id_token_hint=${idToken}&post_logout_redirect_uri=${redirectURL}`
}


export const urlSearchParamsToObject = urlSearchParams => {
  const result = {}
  for(const [key, value] of urlSearchParams.entries()) { // each 'entry' is a [key, value] tuple
    result[key] = value;
  }
  return result;
}

export const toNumDisplay = number => number ? number.toLocaleString() : number


export const getSiblings = elem => {

	// Setup siblings array and get the first sibling
	var siblings = [];
	var sibling = elem.parentNode.firstChild;

	// Loop through each sibling and push to the array
	while (sibling) {
		if (sibling.nodeType === 1 && sibling !== elem) {
			siblings.push(sibling);
		}
		sibling = sibling.nextSibling
	}

	return siblings;

};

export const sortValuesBySourceSummary = (data, summary, summaryField, isLocale) => {
  if(isEmpty(compact(data)) || !summary)
    return data
  let _data = compact(data).map(d => {
    d.resultType = 'Ordered'
    return d
  })
  const summaryValues = get(summary, summaryField)
  let suggested = []
  if(summaryValues) {
    const usedValues = map(summaryValues, value => value[0])
    usedValues.forEach(used => {
      const _used = find(_data, _d => {
        const id = _d?.id?.toLowerCase()?.replace('-', '')?.replace('_', '')?.replace(' ', '')
        const _used = used?.toLowerCase()?.replace('-', '')?.replace('_', '')?.replace(' ', '')
        return _used === id
      })
      if(_used) {
        suggested.push({..._used, resultType: 'Suggested'})
        _data = reject(_data, {id: _used?.id})
      }
    })
  }

  let values = [...suggested, ...orderBy(_data, 'name', 'asc')]

  if(isLocale) {
    values = uniqBy(
      [
        {...find(values, {id: summary.default_locale}), resultType: 'Suggested'},
        ...filter(
            values,
            val => (summary.supported_locales || []).includes(val.id)
        ).map(val => ({...val, resultType: 'Suggested'})),
        ...values
      ],
      'id'
    )
  }

  return values
}


const extractTextBetweenEmTags = str => {
  const regex = /<em>(.*?)<\/em>/g;
  const matches = [];
  let match;
  while ((match = regex.exec(str)) !== null) {
    matches.push(match[1]);
    if(match[1] && match[1].includes('_'))
      matches.push(match[1].replace('_', '-'))
  }
  return matches;
}

const getHighlightedTexts = items => {
  return uniq(
    flatten(
      map(
        flatten(
          flatten(
            flatten(
              map(
                items,
                i => values(
                  pickBy(
                    i?.search_meta?.search_highlight,
                    (value, key) => !key.startsWith('_')
                  )
                )
              )
            )
          )
        ),
        val => extractTextBetweenEmTags(val)
      )
    )
  )
}


export const highlightTexts = (items, texts, unmark=false, additionalTexts) => {
  const containers = document.querySelectorAll('.searchable');
  if (!containers?.length) return;
  const mark = new Mark(containers)
  let terms = texts ?? getHighlightedTexts(items);
  if (additionalTexts?.length) terms = [...terms, ...additionalTexts];
  terms = [...new Set((terms || []).map(t => (t || '').trim()))].filter(Boolean);
  const options = {
    element: "span",
    className: "highlight-search-results",
    separateWordSearch: false,
    caseSensitive: false,
    ignoreJoiners: true,
    diacritics: true,
    exclude: ['.highlight-search-results']
  }

  const doMark = () => {
    if (!terms.length) return;
    mark.mark(terms, options);
  };

  if(unmark)
    mark.unmark({done: doMark})
  else
    doMark()
}

export const pluralize = (count, singular, plural) => `${count?.toLocaleString()} ${count === 1 ? singular : plural}`;

export const toV3URL = path => {
  let url = 'https://app.v3.openconceptlab.org'
  if(window.location.host?.includes('localhost'))
    url = 'http://localhost:4002'
  if(['map.dev.openconceptlab.org', 'map.demo.openconceptlab.org'].includes(window.location.host))
    url = 'https://app.v3.qa.openconceptlab.org'
  if(window.location.host.match('map.*.openconceptlab.org'))
    url = window.location.origin.replace('//map.', '//app.v3.')

  let referrerParams = `referrer=${window.location.href}`
  if(isLoggedIn())
    referrerParams += '?auth=true'

  return `${url}/#${path || '/'}?${referrerParams}`
}

export const isV3URL = url => {
  if(!url)
    return false
  if(url.startsWith('http://localhost:4002'))
    return true
  if(!url.includes('.openconceptlab.org'))
    return false
  if(url.startsWith('https://app.v3.'))
    return true
  return false
}

export const isV2URL = url => {
  if(!url)
    return false
  if(url.startsWith('http://localhost:4000'))
    return true
  if(!url.includes('.openconceptlab.org'))
    return false
  if(url.startsWith('https://app.'))
    return true
  return false
}

export const isCommunitySiteURL = url => {
  if(!url)
    return false
  if(url.startsWith('https://openconceptlab.org'))
    return true
  if(url.startsWith('http://localhost:4006'))
    return true
  if(!url.includes('.openconceptlab.org'))
    return false
  if(url.startsWith('https://preview.'))
    return true
  return false
}

export const isOtherOCLClientURL = referrer => referrer && (isV3URL(referrer) || isV2URL(referrer) || isCommunitySiteURL(referrer))

export const isRedirectingToLoginViaReferrer = location => {
  const { search, hash } = location
  const queryParams = new URLSearchParams(search)
  const referrer = queryParams.get('referrer')
  const parts = hash ? hash.split('?') : referrer?.split('?')
  let params = new URLSearchParams(parts[1])
  return isOtherOCLClientURL(referrer) && params.get('auth') === 'true'
}

export const toCamelCase = str => {
  return str
    .replace(/[-_\s]+(.)?/g, (_, c) => c ? c.toUpperCase() : '')
    .replace(/^(.)/, (m) => m.toLowerCase());
}

export const isInWaitlist = () => getCurrentUser()?.auth_groups?.includes('mapper-waitlist')


export const isNumeric = value => {
  if (value === null || value === undefined || value === '') return false;
  if (typeof value !== "string") return false;
  if (value.trim() === "") return false;
  return Number.isFinite(Number(value));
};

export const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
