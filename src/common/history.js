let appHistory = null

export const setAppHistory = history => {
  appHistory = history
}

export const toRoutePath = path => {
  const legacy = path?.match(/^\/?#(\/.*)$/)
  return legacy ? legacy[1] : path
}

export const isSameSitePath = path => /^\/(?![/\\])/.test(path || '')

export const navigate = (path, replace=false) => {
  const routePath = toRoutePath(path)
  if(!isSameSitePath(routePath))
    return
  if(!appHistory) {
    if(replace)
      window.location.replace(routePath)
    else
      window.location.assign(routePath)
    return
  }
  if(replace)
    appHistory.replace(routePath)
  else
    appHistory.push(routePath)
}

export const legacyHashRoute = (location=window.location) => {
  const { hash, search } = location
  if(!hash.startsWith('#/') || /^#\/[/\\]/.test(hash) || /[?&]referrer=/.test(search))
    return null
  let route = hash.slice(1)
  const outer = search.replace(/^\?/, '')
  if(outer) {
    const hashAt = route.indexOf('#')
    const tail = hashAt > -1 ? route.slice(hashAt) : ''
    const head = hashAt > -1 ? route.slice(0, hashAt) : route
    route = head + (head.includes('?') ? '&' : '?') + outer + tail
  }
  return route
}

export const redirectLegacyHashRoute = () => {
  const route = legacyHashRoute()
  if(route)
    navigate(route, true)
}

const currentRoute = () => window.location.pathname + window.location.search + window.location.hash

const isPlainLeftClick = event => event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey

const appLinkRoute = event => {
  const anchor = event.target?.closest?.('a[href]')
  if(!anchor || (anchor.target && anchor.target !== '_self') || anchor.hasAttribute('download'))
    return null
  const href = anchor.getAttribute('href')
  if(!href || (href.startsWith('#') && !href.startsWith('#/')) || /^(mailto|tel|javascript):/i.test(href))
    return null
  if(href.startsWith('#/'))
    return href.slice(1)
  const url = new URL(anchor.href, window.location.href)
  if(url.origin !== window.location.origin || !/^https?:$/.test(url.protocol))
    return null
  if(url.hash && !url.hash.startsWith('#/') && url.pathname === window.location.pathname && url.search === window.location.search)
    return null
  return legacyHashRoute(url) || url.pathname + url.search + url.hash
}

export const keepLinkClickBubbling = event => {
  if(isPlainLeftClick(event) && appLinkRoute(event))
    event.stopPropagation = () => {}
}

export const handleLinkClick = event => {
  if(event.defaultPrevented || !isPlainLeftClick(event))
    return
  const route = appLinkRoute(event)
  if(!route)
    return
  event.preventDefault()
  if(route !== currentRoute())
    navigate(route)
}
