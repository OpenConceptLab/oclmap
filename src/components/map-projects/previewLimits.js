export const PREVIEW_LIMIT_ERROR_CODES = new Set([
  'mapper_rows_per_project_limit_reached',
  'mapper_match_operations_limit_reached',
  'mapper_projects_limit_reached',
  'mapper_org_projects_denied',
  'mapper_access_denied',
  'mapper_custom_algorithms_denied',
  'mapper_ai_assistant_denied',
  'mapper_scispacy_denied',
  'mapper_rows_per_project_not_entitled',
  'mapper_match_operations_not_entitled',
  'mapper_projects_not_entitled',
  'ai_assistant_calls_limit_reached',
  'ai_assistant_calls_not_entitled',
])

export const PREVIEW_LIMIT_COPY_KEY = {
  mapper_rows_per_project_limit_reached: 'rows',
  mapper_match_operations_limit_reached: 'match_operations',
  mapper_projects_limit_reached: 'projects',
  mapper_org_projects_denied: 'org_projects',
  mapper_access_denied: 'access',
  mapper_custom_algorithms_denied: 'custom_algorithms',
  mapper_ai_assistant_denied: 'ai_assistant',
  mapper_scispacy_denied: 'scispacy',
  mapper_rows_per_project_not_entitled: 'rows_not_entitled',
  mapper_match_operations_not_entitled: 'match_operations_not_entitled',
  mapper_projects_not_entitled: 'projects_not_entitled',
  ai_assistant_calls_limit_reached: 'ai_assistant',
  ai_assistant_calls_not_entitled: 'ai_assistant',
}

export const getPreviewLimitError = value => {
  const response = value?.response?.data || value?.data || value
  return PREVIEW_LIMIT_ERROR_CODES.has(response?.error_code) ? response : null
}

export const isPreviewLimitError = value => Boolean(getPreviewLimitError(value))

export const isAIPreviewLimitError = errorCode =>
  errorCode === 'ai_assistant_calls_limit_reached'
  || errorCode === 'ai_assistant_calls_not_entitled'
  || errorCode === 'mapper_ai_assistant_denied'
