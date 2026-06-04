export const getTargetRepoVersionId = repoVersion => repoVersion?.id || repoVersion?.version || ''
export const getTargetRepoVersionFromUrl = url => {
  const parts = (url || '').split('/').filter(Boolean)
  return parts[4] || ''
}

export const isLLMBridgeRepoVersion = version => version?.match_algorithms?.includes('llm')

export const getDefaultTargetRepoVersion = versions => {
  if(!Array.isArray(versions) || versions.length === 0)
    return false
  if(versions.length === 1)
    return versions[0]

  const releasedVersions = versions.filter(version => version?.released)
  if(releasedVersions.length === 1)
    return releasedVersions[0]

  return false
}

export const getDefaultBridgeRepoVersion = versions => {
  if(!Array.isArray(versions) || versions.length === 0)
    return false

  const latestReleasedLLMVersion = versions.find(version => version?.released && isLLMBridgeRepoVersion(version))
  if(latestReleasedLLMVersion)
    return latestReleasedLLMVersion

  return versions.find(isLLMBridgeRepoVersion) || false
}

export const getProjectTargetRepoVersion = projectData => {
  const versionFromUrl = getTargetRepoVersionFromUrl(projectData?.target_repo_url)
  return versionFromUrl || projectData?.target_repo?.source_version || ''
}

export const hasSelectedTargetRepoVersion = repoVersion => Boolean(getTargetRepoVersionId(repoVersion))
