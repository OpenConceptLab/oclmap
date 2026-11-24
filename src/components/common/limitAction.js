// A limit refusal can come with a next step from the connected OCL Online
// service (OpenConceptLab/ocl_online#367). Open code shows only what the
// service sends; with no service configured it shows nothing.

// What each refusal is about, as the service names it: the capability for a
// limit, the permission for an access check.
const LIMIT_SUBJECTS = {
  mapper_match_operations_limit_reached: {capability: 'mapper.match_operations'},
  mapper_match_operations_not_entitled: {capability: 'mapper.match_operations'},
  mapper_rows_per_project_limit_reached: {capability: 'mapper.rows_per_project'},
  mapper_rows_per_project_not_entitled: {capability: 'mapper.rows_per_project'},
  mapper_projects_limit_reached: {capability: 'mapper.projects'},
  mapper_projects_not_entitled: {capability: 'mapper.projects'},
  ai_assistant_calls_limit_reached: {capability: 'ai_assistant.calls'},
  ai_assistant_calls_not_entitled: {capability: 'ai_assistant.calls'},
  ai_assistant_change_comments_limit_reached: {capability: 'ai_assistant.change_comments'},
  mapper_access_denied: {permission: 'users.mapper_use'},
  mapper_org_projects_denied: {permission: 'users.mapper_org_projects'},
  mapper_custom_algorithms_denied: {permission: 'users.mapper_custom_algorithms'},
  mapper_ai_assistant_denied: {permission: 'users.mapper_ai_assistant'},
  mapper_scispacy_denied: {permission: 'users.mapper_scispacy'},
}

// A refusal that names its own capability is asked about that one
// (OpenConceptLab/ocl_online#641).
export const getLimitSubject = (errorCode, capability) =>
  typeof capability === 'string' && capability ? {capability} : (LIMIT_SUBJECTS[errorCode] || {})

// Whose limit refused: a user's or an organization's relative URL, from the
// refusal's `quota` (OpenConceptLab/ocl_online#701).
const OWNER_URL = /^\/(users|orgs)\/[^/]+\/$/
export const getRefusalOwner = body => {
  const owner = body?.quota?.owner
  return typeof owner === 'string' && OWNER_URL.test(owner) ? owner : null
}

// The next step is asked for whose limit it was, when the refusal says.
export const getLimitActionRequest = ({baseURL, token, errorCode, capability, owner, lang}) => {
  if(!baseURL || !token)
    return null
  return {
    url: `${baseURL.replace(/\/+$/, '')}/billing/plan/`,
    params: {context: 'limit', ...getLimitSubject(errorCode, capability), ...(owner ? {owner} : {}), lang},
    headers: {Authorization: `Token ${token}`},
  }
}

// Only an http(s) link with a label becomes a button.
export const toLimitAction = data => {
  const { kind, url, label, message } = data?.action || {}
  if(typeof label !== 'string' || !label.trim() || typeof url !== 'string')
    return null
  let href
  try {
    href = new URL(url)
  } catch(_) {
    return null
  }
  if(!['https:', 'http:'].includes(href.protocol))
    return null
  return {kind, url: href.href, label, message: typeof message === 'string' && message.trim() ? message : null}
}
