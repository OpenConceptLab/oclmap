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

export const getLimitSubject = errorCode => LIMIT_SUBJECTS[errorCode] || {}

export const getLimitActionRequest = ({baseURL, token, errorCode, lang}) => {
  if(!baseURL || !token)
    return null
  return {
    url: `${baseURL.replace(/\/+$/, '')}/billing/plan/`,
    params: {context: 'limit', ...getLimitSubject(errorCode), lang},
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
