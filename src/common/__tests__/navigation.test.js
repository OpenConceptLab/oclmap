import test from 'node:test'
import assert from 'node:assert/strict'

const { trayItems, createItems } = await import('../navigation.js')

const user = {url: '/users/test/'}

test('tray lists dashboard, repositories and mapping projects', () => {
  assert.deepEqual(trayItems(user, true).map(i => [i.key, i.path]), [
    ['dashboard', '/'],
    ['repos', '/users/test/repos'],
    ['map-projects', '/users/test/map-projects'],
  ])
})

test('tray omits mapping projects without a mapper', () => {
  assert.deepEqual(trayItems(user, false).map(i => i.key), ['dashboard', 'repos'])
})

test('create menu sends the mapping project to the mapper app', () => {
  const items = createItems(user, true)
  assert.equal(items.find(i => i.key === 'map-project').app, 'mapper')
  assert.equal(createItems(user, false).some(i => i.key === 'map-project'), false)
  assert.equal(items.find(i => i.key === 'import').divider, true)
})

const { isTrayItemSelected } = await import('../navigation.js')

test('mapping projects stays selected on a project page', () => {
  const item = trayItems(user, true).find(i => i.key === 'map-projects')
  assert.equal(isTrayItemSelected(item, '/users/test/map-projects'), true)
  assert.equal(isTrayItemSelected(item, '/users/test/map-projects/'), true)
  assert.equal(isTrayItemSelected(item, '/users/test/map-projects/123/'), true)
  assert.equal(isTrayItemSelected(item, '/users/test/repos'), false)
})

test('dashboard is selected only on the root path', () => {
  const item = trayItems(user, true).find(i => i.key === 'dashboard')
  assert.equal(isTrayItemSelected(item, '/'), true)
  assert.equal(isTrayItemSelected(item, '/users/test/map-projects'), false)
})
