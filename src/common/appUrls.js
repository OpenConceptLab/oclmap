export const PRODUCTION_TERMBROWSER_URL = 'https://app.v3.openconceptlab.org'

const OFFICIAL_MAPPER_ORIGIN = /^https:\/\/map\.([a-z]+\.)*openconceptlab\.org$/

// A TermBrowser counts as part of this installation only when it's configured
// or this is an official Mapper host; a standalone Mapper keeps its own pages.
export const resolveIntegratedV3URL = (configured, origin) => {
  const url = (configured || '').trim().replace(/\/+$/, '')
  if(url)
    return url
  if(OFFICIAL_MAPPER_ORIGIN.test(origin || ''))
    return origin.replace('//map.', '//app.v3.')
  return ''
}

export const resolveV3URL = (configured, origin, host) =>
  resolveIntegratedV3URL(configured, origin) || (host?.includes('localhost') ? 'http://localhost:4002' : PRODUCTION_TERMBROWSER_URL)
