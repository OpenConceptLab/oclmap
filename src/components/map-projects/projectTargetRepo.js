export const getTargetRepoVersionId = repoVersion => repoVersion?.id || repoVersion?.version || ''
export const getTargetRepoVersionFromUrl = url => {
  const parts = (url || '').split('/').filter(Boolean)
  return parts[4] || ''
}

export const getProjectTargetRepoVersion = projectData => {
  const versionFromUrl = getTargetRepoVersionFromUrl(projectData?.target_repo_url)
  return versionFromUrl || projectData?.target_repo?.source_version || ''
}

export const hasSelectedTargetRepoVersion = repoVersion => Boolean(getTargetRepoVersionId(repoVersion))
