/*eslint no-process-env: 0*/
import axios from 'axios';
import {get, omit, isPlainObject, isString, defaults } from 'lodash';
import { currentUserToken, getAPIURL, logoutUser, sleep } from '../common/utils';

const APIServiceProvider = {};
const throttlingListeners = new Set();
const RESOURCES = [
  { name: 'concepts', relations: [] },
  { name: 'mappings', relations: [] },
  { name: 'orgs', relations: ['pins', 'sources', 'collections'] },
  { name: 'sources', relations: ['concepts', 'mappings'] },
  { name: 'collections', relations: ['concepts', 'mappings'] },
  { name: 'users', relations: ['login', 'signup', 'verify', 'password', 'pins', 'collections', 'sources', 'orgs'] },
  { name: 'user', relations: ['orgs', 'sources', 'collections', 'repos', 'orgs/sources', 'orgs/collections', 'orgs/repos'] },
  { name: 'feedback', relations: [] },
  { name: 'version', relations: [] },
  { name: 'locales', relations: [] },
  { name: 'toggles', relations: [] },
  { name: 'new', relations: [] },
];

const getHeaderValue = (headers = {}, key) => {
  if(headers && typeof headers.get === 'function') {
    const headerValue = headers.get(key) ?? headers.get(key.toLowerCase()) ?? headers.get(key.toUpperCase());
    if(headerValue !== undefined && headerValue !== null)
      return headerValue;
  }

  return headers?.[key] ?? headers?.[key.toLowerCase()] ?? headers?.[key.toUpperCase()];
};

export const getThrottlingDetails = response => {
  const retryAfter = Number(getHeaderValue(response?.headers, 'retry-after'));
  const minuteRemaining = Number(getHeaderValue(response?.headers, 'x-limitremaining-minute'));
  const dayRemaining = Number(getHeaderValue(response?.headers, 'x-limitremaining-day'));
  const hasMinuteRemaining = Number.isFinite(minuteRemaining);
  const hasDayRemaining = Number.isFinite(dayRemaining);
  let limitType = 'unknown';
  if(hasMinuteRemaining && minuteRemaining <= 0 && hasDayRemaining && dayRemaining <= 0)
    limitType = 'minute_and_day';
  else if(hasMinuteRemaining && minuteRemaining <= 0)
    limitType = 'minute';
  else if(hasDayRemaining && dayRemaining <= 0)
    limitType = 'day';

  return {
    retryAfter: Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : 0,
    limitType,
    minuteRemaining: hasMinuteRemaining ? minuteRemaining : null,
    dayRemaining: hasDayRemaining ? dayRemaining : null,
    response,
  };
}

const notifyThrottlingListeners = response => {
  const details = getThrottlingDetails(response);
  throttlingListeners.forEach(listener => listener(details));
}

const createPendingRequest = () => new Promise(() => {})

const handleAPIError = (error, raw=false) => {
  if(error?.response?.status === 401 && error?.response?.config?.url?.startsWith(getAPIURL())) {
    logoutUser(true)
    return { handled: true, result: undefined };
  }

  if(error?.response?.status === 429) {
    notifyThrottlingListeners(error.response);
    return { handled: true, result: raw ? error : createPendingRequest() };
  }

  return { handled: false };
}

class APIService {
  constructor(name, id, relations) {
    const apiURL = getAPIURL();
    if (name === 'empty') this.URL = `${apiURL}/`;
    else this.URL = `${apiURL}/${name}/`;
    this.headers = {
      'Content-Type': 'application/json',
      Accept: '*/*'
    };

    if (id) {
      this.URL += `${id}/`;
    }
    if (relations) {
      relations.forEach(relation => {
        this[relation] = relationId => {
          this.URL += `${relation}/${relationId ? `${relationId}/` : ''}`;
          return this;
        };
      });
    }
  }

  appendToUrl(s) {
    this.URL += s;
    return this;
  }

  overrideURL(url) {
    this.URL = `${getAPIURL()}${url}`;
    return this;
  }

  head(token, headers = {}, query, raw=false) {
    return this.sendRequest('HEAD', null, token, headers, query, raw);
  }

  get(token, headers = {}, query, raw=false) {
    return this.sendRequest('GET', null, token, headers, query, raw);
  }

  post(data, token, headers = {}, query, raw=false) {
    return this.sendRequest('POST', data, token, headers, query, raw);
  }

  put(data, token, headers = {}, query, raw=false) {
    return this.sendRequest('PUT', data, token, headers, query, raw);
  }

  delete(data, token, headers = {}, query, raw=false) {
    return this.sendRequest('DELETE', data, token, headers, query, raw);
  }

  sendRequest(method, data, token, headers, query, raw=false) {
    const request = this.getRequest(method, data, token, headers, query);
    return axios(request)
      .then(response => response || null)
      .catch(error => {
        const { handled, result } = handleAPIError(error, raw);
        if(handled)
          return result;

        if(raw)
          return error;

        return error.response ? error.response.data : error.message;

      });
  }

  getRequest(method, data, token, headers, query) {
    return {
      url: this.URL,
      method,
      headers: headers === false ? {} : this.getHeaders(token, headers),
      params: this.getQueryParams(query),
      data,
    };
  }

  request(method, data, token, config) {
    let headers = {};
    let query = {};
    if (isPlainObject(config)) {
      headers = get(config, 'headers', {});
      query = get(config, 'query', {});
    }
    let request = this.getRequest(method, data, token, headers, query);
    request = {...request, ...omit(config, ['headers', 'query'])};
    return axios(request).catch(error => {
      handleAPIError(error);
      return Promise.reject(error);
    });
  };

  getHeaders(token, headers) {
    token = token || (token !== false ? currentUserToken() : token);
    const obj = defaults(headers, this.headers);
    if (token) obj['Authorization'] = `Token ${token}`;
    obj['INCLUDESEARCHLATEST'] = true
    obj['X-OCL-CLIENT'] = 'oclmap/0.0.1-alpha';
    return obj;
  }

  getQueryParams(query) {
    if (isPlainObject(query)) {
      return query;
    }
    if (isString(query)) {
      const questionMarkSplit = query.split('?');
      if (questionMarkSplit.length === 2) {
        const params = {};
        const ampersandSplit = questionMarkSplit[1].split('&');
        ampersandSplit.forEach(param => {
          const paramSplit = param.split('=');
          params[paramSplit[0]] = get(paramSplit, '[1]', true);
        });
        return params;
      }
    }
    return {};
  }
}

RESOURCES.forEach(resource => {
  APIServiceProvider[resource.name] = (id, query) => new APIService(resource.name, id, resource.relations, query);
});

APIServiceProvider.onThrottle = listener => {
  throttlingListeners.add(listener);
  return () => throttlingListeners.delete(listener);
};

export const isTransientNetworkError = err => {
  if (!err?.isAxiosError) return false;
  if (!err.response) return true;
  return ['ECONNABORTED', 'ETIMEDOUT', 'ENETUNREACH'].includes(err.code);
};

export const retryWithBackoff = async (fn, { maxRetries = 2, baseDelayMs = 3000, backoffFactor = 4, jitterFactor = 0.25, isCancelled = () => false, isRetryable = () => false, onAttemptFailed = null } = {}) => {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      onAttemptFailed?.(err, attempt);
      if (attempt >= maxRetries || !isRetryable(err) || isCancelled()) throw err;
      const base = baseDelayMs * Math.pow(backoffFactor, attempt);
      const delay = base * (1 - jitterFactor + Math.random() * jitterFactor * 2);
      await sleep(delay);
    }
  }
};

export default APIServiceProvider;
