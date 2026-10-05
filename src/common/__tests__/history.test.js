/* global globalThis */
import test from 'node:test'
import assert from 'node:assert/strict'

const location = { origin: 'http://localhost:4004', pathname: '/map-projects/', search: '', hash: '', href: 'http://localhost:4004/map-projects/' }
globalThis.window = { location }

const { legacyHashRoute, toRoutePath, navigate, setAppHistory, handleLinkClick, keepLinkClickBubbling } = await import('../history.js')

const loc = (hash, search='') => ({ hash, search })

test('legacyHashRoute turns a hash route into a path', () => {
  assert.equal(legacyHashRoute(loc('#/map-projects/')), '/map-projects/')
  assert.equal(legacyHashRoute(loc('#/orgs/CIEL/sources/CIEL/?q=malaria')), '/orgs/CIEL/sources/CIEL/?q=malaria')
})

test('legacyHashRoute keeps a nested referrer hash intact', () => {
  assert.equal(
    legacyHashRoute(loc('#/map-projects/1/?referrer=https://app.v3/#/orgs/X/?auth=true')),
    '/map-projects/1/?referrer=https://app.v3/#/orgs/X/?auth=true'
  )
})

test('legacyHashRoute merges the outer query into the route', () => {
  assert.equal(legacyHashRoute(loc('#/search/', '?foo=1')), '/search/?foo=1')
  assert.equal(legacyHashRoute(loc('#/search/?q=1', '?foo=1')), '/search/?q=1&foo=1')
})

test('legacyHashRoute ignores in-page anchors, empty hashes and referrer hashes', () => {
  assert.equal(legacyHashRoute(loc('#heading')), null)
  assert.equal(legacyHashRoute(loc('')), null)
  assert.equal(legacyHashRoute(loc('#/orgs/X/?auth=true', '?referrer=https://app.v3/')), null)
})

test('toRoutePath strips a legacy hash prefix only', () => {
  assert.equal(toRoutePath('/#/map-projects/new'), '/map-projects/new')
  assert.equal(toRoutePath('#/map-projects/new'), '/map-projects/new')
  assert.equal(toRoutePath('/map-projects/new'), '/map-projects/new')
})

const pushed = []
setAppHistory({ push: path => pushed.push(['push', path]), replace: path => pushed.push(['replace', path]) })

test('navigate pushes or replaces through the router history', () => {
  pushed.length = 0
  navigate('/#/map-projects/new')
  navigate('/search/', true)
  assert.deepEqual(pushed, [['push', '/map-projects/new'], ['replace', '/search/']])
})

const anchor = (href, attrs={}) => ({
  href: new URL(href, location.href).href,
  target: attrs.target || '',
  getAttribute: name => name === 'href' ? href : null,
  hasAttribute: name => Boolean(attrs[name]),
})

const click = (a, extra={}) => {
  const event = {
    button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, defaultPrevented: false,
    target: { closest: () => a },
    preventDefault() { this.defaultPrevented = true },
    stopPropagation() { this.stopped = true },
    ...extra,
  }
  return event
}

test('handleLinkClick routes same-origin links in the app', () => {
  pushed.length = 0
  const event = click(anchor('/map-projects/new'))
  handleLinkClick(event)
  assert.equal(event.defaultPrevented, true)
  assert.deepEqual(pushed, [['push', '/map-projects/new']])
})

test('handleLinkClick leaves new-tab, modified, external and prevented clicks alone', () => {
  pushed.length = 0
  const cases = [
    click(anchor('/map-projects/new', { target: '_blank' })),
    click(anchor('/map-projects/new'), { metaKey: true }),
    click(anchor('/map-projects/new'), { button: 1 }),
    click(anchor('https://app.v3.openconceptlab.org/#/orgs/CIEL/')),
    click(anchor('#section')),
    click(anchor('/map-projects/new'), { defaultPrevented: true }),
  ]
  cases.forEach(event => handleLinkClick(event))
  assert.deepEqual(pushed, [])
})

test('keepLinkClickBubbling neutralises stopPropagation only for app links', () => {
  const appLink = click(anchor('/map-projects/new'))
  keepLinkClickBubbling(appLink)
  appLink.stopPropagation()
  assert.equal(appLink.stopped, undefined)

  const external = click(anchor('https://openconceptlab.org/'))
  keepLinkClickBubbling(external)
  external.stopPropagation()
  assert.equal(external.stopped, true)
})
