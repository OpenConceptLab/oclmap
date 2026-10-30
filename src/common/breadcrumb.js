export const projectCrumbs = (ownerURL, integrated, toV3URL) => [
  {key: 'owner', href: integrated ? toV3URL(ownerURL) : null},
  {key: 'projects', href: integrated ? toV3URL(`${ownerURL}map-projects`) : '#/map-projects'}
]
