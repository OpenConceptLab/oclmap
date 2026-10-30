export const trayItems = (user, hasMapper) => [
  {key: 'dashboard', app: 'v3', path: '/', labelKey: 'dashboard.my'},
  {key: 'repos', app: 'v3', path: `${user?.url}repos`, labelKey: 'user.my_repositories'},
  ...(hasMapper ? [{key: 'map-projects', app: 'v3', path: `${user?.url}map-projects`, labelKey: 'user.my_mapping_projects'}] : [])
]

export const createItems = (user, hasMapper) => [
  {key: 'org', app: 'v3', path: '/orgs/new'},
  {key: 'repo', app: 'v3', path: `${user?.url}repos/new`},
  ...(hasMapper ? [{key: 'map-project', app: 'mapper', path: '/map-projects/new'}] : []),
  {key: 'import', app: 'v3', path: '/imports', divider: true}
]
