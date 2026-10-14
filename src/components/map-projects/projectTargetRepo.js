export const getTargetRepoVersionId = repoVersion => repoVersion?.id || repoVersion?.version || ''
export const getTargetRepoVersionFromUrl = url => {
  const parts = (url || '').split('/').filter(Boolean)
  return parts[4] || ''
}

// The OCL Semantic Algorithm runs only on versions vectorized for it.
export const isLLMBridgeRepoVersion = version => version?.match_algorithms?.includes('llm')

// The API lists versions newest first.
export const getLatestReleasedTargetRepoVersion = versions =>
  (Array.isArray(versions) && versions.find(version => version?.released)) || null

// A newly chosen repository starts on its latest release that supports
// semantic search, else its latest release, else HEAD.
export const getDefaultTargetRepoVersion = versions => {
  if(!Array.isArray(versions))
    return false

  return versions.find(version => version?.released && isLLMBridgeRepoVersion(version)) ||
    getLatestReleasedTargetRepoVersion(versions) ||
    versions.find(version => version?.id === 'HEAD') ||
    false
}

// A saved project keeps its version, never the default. HEAD's version_url
// carries no version, so a project saved on HEAD has none in its URL.
export const getSavedTargetRepoVersion = (versions, savedVersion) =>
  (Array.isArray(versions) && versions.find(version => version?.id === (savedVersion || 'HEAD'))) || false

export const getTargetRepoVersionBadges = (version, versions) => {
  const latestReleasedVersion = getLatestReleasedTargetRepoVersion(versions)
  const badges = []
  if(latestReleasedVersion && version?.id === latestReleasedVersion.id)
    badges.push('common.latest')
  if(isLLMBridgeRepoVersion(version))
    badges.push('map_project.semantic_search')
  return badges
}

// OCL keeps no release timestamp: revision_date is copied from HEAD when a
// version is created, and updated_on moves with later edits. created_on is
// what OCL orders versions by, so the latest release shows the newest date.
export const getTargetRepoVersionReleaseDate = version =>
  (version?.released && version.created_on) || null

export const getDefaultBridgeRepoVersion = versions => {
  if(!Array.isArray(versions) || versions.length === 0)
    return false

  const latestReleasedLLMVersion = versions.find(version => version?.released && isLLMBridgeRepoVersion(version))
  if(latestReleasedLLMVersion)
    return latestReleasedLLMVersion

  return versions.find(isLLMBridgeRepoVersion) || false
}

export const getLatestReleasedBridgeVersion = versions => {
  if(!Array.isArray(versions) || versions.length === 0)
    return null

  const explicitReleasedVersion = versions.find(version => version?.released)
  if(explicitReleasedVersion)
    return explicitReleasedVersion

  return versions.find(version => version?.id && version.id !== 'HEAD') || null
}

export const getProjectTargetRepoVersion = projectData => {
  const versionFromUrl = getTargetRepoVersionFromUrl(projectData?.target_repo_url)
  return versionFromUrl || projectData?.target_repo?.source_version || ''
}

export const hasSelectedTargetRepoVersion = repoVersion => Boolean(getTargetRepoVersionId(repoVersion))
