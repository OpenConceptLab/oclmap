export const getPreviewConfigAccessErrors = ({
  owner,
  userUrl,
  algosSelected = [],
  canUseOrgProjects = true,
  canUseCustomAlgorithms = true,
} = {}) => [
  ...(!canUseOrgProjects && owner && owner !== userUrl ? ['org_projects'] : []),
  ...(!canUseCustomAlgorithms && algosSelected.some(algo => algo?.type === 'custom') ? ['custom_algorithms'] : []),
]

export const getPreviewAlgorithmOptions = ({
  algos = [],
  algosSelected = [],
  canUseCustomAlgorithms = true,
  isLLMAlgoNotAllowed = false,
  canBridge = false,
  canScispacy = false,
} = {}) => {
  const hasCustomAlgorithmSelected = algosSelected.some(algo => algo?.type === 'custom')

  return algos.map(algo => {
    const next = {...algo}
    if(algo.type === 'ocl-semantic')
      next.disabled = Boolean(isLLMAlgoNotAllowed)
    else if(['ocl-bridge', 'ocl-ciel-bridge'].includes(algo.type))
      next.disabled = !canBridge
    else if(algo.type === 'ocl-scispacy')
      next.disabled = !canScispacy
    else if(algo.type === 'custom' && !canUseCustomAlgorithms)
      next.disabled = true
    return next
  }).filter(algo => canUseCustomAlgorithms || algo.type !== 'custom' || hasCustomAlgorithmSelected)
}
