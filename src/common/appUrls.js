export const PRODUCTION_TERMBROWSER_URL = 'https://app.v3.openconceptlab.org'

const OFFICIAL_MAPPER_ORIGIN = /^https:\/\/map\.([a-z]+\.)*openconceptlab\.org$/

export const resolveIntegratedV3URL = (configured, origin, host) => {
  const url = (configured || '').trim().replace(/\/+$/, '')
  if(url)
    return url
  if(host?.includes('localhost'))
    return 'http://localhost:4002'
  if(OFFICIAL_MAPPER_ORIGIN.test(origin || ''))
    return origin.replace('//map.', '//app.v3.')
  return ''
}

export const resolveV3URL = (configured, origin, host) => resolveIntegratedV3URL(configured, origin, host) || PRODUCTION_TERMBROWSER_URL
