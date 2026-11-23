/**
 * The Mapper reads a repository version's mapped-sources list once and shares
 * it between the bridge probe and the target version
 * (OpenConceptLab/ocl_issues#3064).
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import babel from '@babel/core'

import { createMappedSourcesReader, probeBridgeMappedSources } from '../mappedSources.js'

const CIEL = '/orgs/CIEL/sources/CIEL/'
const CIEL_RELEASE = '/orgs/CIEL/sources/CIEL/v2026-09-24/'

const sourcesPage = (page, count, numFound) => ({
  data: Array.from({length: count}, (_, i) => ({url: `/orgs/X/sources/S${(page - 1) * 25 + i}/`})),
  headers: {num_found: String(numFound)}
})

// A fake API that answers each page after `settle()`, and counts the reads.
const fakeAPI = (numFound = 50, {fail = () => false} = {}) => {
  const reads = []
  const pending = []
  const fetchPage = (url, page) => {
    reads.push(`${url}#${page}`)
    return new Promise(resolve => pending.push(() => resolve(
      fail(url, page) ? 'Service Unavailable' : sourcesPage(page, Math.min(25, numFound - (page - 1) * 25), numFound)
    )))
  }
  const settle = async () => {
    for(;;) {
      await new Promise(resolve => setTimeout(resolve, 0))
      if(!pending.length)
        return
      pending.splice(0).forEach(resolve => resolve())
    }
  }
  return {fetchPage, reads, settle}
}

test('the bridge probe and the target share one read of each page of the same version', async () => {
  const api = fakeAPI(50)
  const read = createMappedSourcesReader(api.fetchPage)
  const lists = {bridge: [], target: []}

  read(CIEL_RELEASE, list => lists.bridge.push(list.length))
  read(CIEL_RELEASE, list => lists.target.push(list.length))
  await api.settle()

  assert.deepEqual(api.reads, [`${CIEL_RELEASE}#1`, `${CIEL_RELEASE}#2`])
  // Each still gets the list page by page, as before.
  assert.deepEqual(lists.bridge, [25, 50])
  assert.deepEqual(lists.target, [25, 50])
})

test('asking again for a version already read reads nothing more', async () => {
  const api = fakeAPI(50)
  const read = createMappedSourcesReader(api.fetchPage)
  read(CIEL_RELEASE, () => {})
  await api.settle()

  let last
  read(CIEL_RELEASE, list => { last = list })
  read(CIEL_RELEASE.replace(/\/$/, ''), () => {})
  await api.settle()

  assert.equal(api.reads.length, 2)
  assert.equal(last.length, 50)
})

test('another version is read on its own', async () => {
  const api = fakeAPI(10)
  const read = createMappedSourcesReader(api.fetchPage)
  read(CIEL_RELEASE, () => {})
  read(`${CIEL}HEAD/`, () => {})
  await api.settle()

  assert.deepEqual(api.reads, [`${CIEL_RELEASE}#1`, `${CIEL}HEAD/#1`])
})

test('a failed page gives what was read so far and is read again on the next ask', async () => {
  let failing = true
  const api = fakeAPI(50, {fail: (_, page) => failing && page === 2})
  const read = createMappedSourcesReader(api.fetchPage)
  const lists = []
  read(CIEL_RELEASE, list => lists.push(list.length))
  await api.settle()
  assert.deepEqual(lists, [25, 25])

  failing = false
  const retried = []
  read(CIEL_RELEASE, list => retried.push(list.length))
  await api.settle()

  // Page 1 came back, so only page 2 is asked for again.
  assert.deepEqual(api.reads, [`${CIEL_RELEASE}#1`, `${CIEL_RELEASE}#2`, `${CIEL_RELEASE}#2`])
  assert.deepEqual(retried, [25, 50])
})

test('a stopped read gives nothing more', async () => {
  const api = fakeAPI(50)
  const read = createMappedSourcesReader(api.fetchPage)
  const lists = []
  const stop = read(CIEL_RELEASE, list => lists.push(list.length))
  stop()
  await api.settle()

  assert.deepEqual(lists, [])
})

// The bridge probe, with a fake $resolveReference.
const probeWith = ({algo, selected = false, namespace = '/users/jontest1/', version = 'v2026-09-24'}) => {
  const api = fakeAPI(50)
  const resolves = []
  const pins = []
  const sources = {}
  let answer
  const stop = probeBridgeMappedSources({
    algo,
    selected,
    namespace,
    resolveVersion: (url, ns) => {
      resolves.push([url, ns])
      return new Promise(resolve => { answer = () => resolve(version) })
    },
    readMappedSources: createMappedSourcesReader(api.fetchPage),
    pinVersion: (id, v) => pins.push([id, v]),
    onSources: (url, list) => { sources[url] = list.length }
  })
  return {api, resolves, pins, sources, stop, resolve: async () => { answer?.(); await api.settle() }}
}

test('a bridge algorithm with a version reads that version without resolving', async () => {
  const probe = probeWith({algo: {id: 'b', target_repo_url: CIEL, target_repo_version: 'v2026-09-24'}})
  await probe.resolve()

  assert.deepEqual(probe.resolves, [])
  assert.deepEqual(probe.api.reads, [`${CIEL_RELEASE}#1`, `${CIEL_RELEASE}#2`])
  assert.deepEqual(probe.sources, {[CIEL]: 50})
})

test('a bridge algorithm with no version reads the version it resolves to, in the namespace given', async () => {
  const probe = probeWith({algo: {id: 'b', target_repo_url: CIEL}})
  await probe.resolve()

  assert.deepEqual(probe.resolves, [[CIEL, '/users/jontest1/']])
  assert.deepEqual(probe.api.reads, [`${CIEL_RELEASE}#1`, `${CIEL_RELEASE}#2`])
  // The API's offer isn't selected: its version isn't pinned.
  assert.deepEqual(probe.pins, [])
})

test('selecting a bridge algorithm pins its resolved version', async () => {
  const probe = probeWith({algo: {id: 'b', target_repo_url: CIEL}, selected: true})
  await probe.resolve()

  assert.deepEqual(probe.pins, [['b', 'v2026-09-24']])
})

test('a probe stopped before its version resolves pins and reads nothing', async () => {
  const probe = probeWith({algo: {id: 'b', target_repo_url: CIEL}, selected: true})
  probe.stop()
  await probe.resolve()

  assert.deepEqual(probe.pins, [])
  assert.deepEqual(probe.api.reads, [])
})

test('no version, or no bridge repository, reads nothing', async () => {
  for(const algo of [undefined, {id: 'b'}, {id: 'b', target_repo_url: CIEL}]) {
    const probe = probeWith({algo, version: ''})
    await probe.resolve()
    assert.deepEqual(probe.api.reads, [])
  }
})

// MapProject can't be mounted here (these tests run without a JSX transform),
// so this reads its source.
const source = readFileSync(new URL('../MapProject.jsx', import.meta.url), 'utf8')
const ast = babel.parseSync(source, {babelrc: false, configFile: false, parserOpts: {plugins: ['jsx']}})
const code = node => source.slice(node.start, node.end)

test('the bridge probe runs again only when an input it uses changes, not on every project change', () => {
  const deps = []
  babel.traverse(ast, {
    CallExpression({node}) {
      const [effect, dependencies] = node.arguments
      if(code(node.callee) === 'React.useEffect' && effect && code(effect).includes('probeBridgeMappedSources('))
        deps.push(dependencies.elements.map(code))
    }
  })
  assert.deepEqual(deps, [[
    'bridgeProbeAlgo?.id',
    'bridgeProbeAlgo?.target_repo_url',
    'bridgeProbeAlgo?.target_repo_version',
    'bridgeEnabled',
    'bridgeNamespace'
  ]])
  assert.match(source, /const bridgeNamespace = namespace \|\| get\(project, 'owner_url'\) \|\| owner\n/)
})

test('the target version and the bridge probe read through the one shared reader', () => {
  const readers = []
  const reads = []
  babel.traverse(ast, {
    CallExpression({node}) {
      if(node.callee.name === 'createMappedSourcesReader')
        readers.push(code(node))
      if(node.callee.name === 'readMappedSources')
        reads.push(node.arguments.map(code))
    }
  })
  assert.deepEqual(readers, ['createMappedSourcesReader(fetchMappedSourcesPage)'])
  assert.deepEqual(reads, [['version.version_url', 'setMappedSources']])
  assert.match(source, /readMappedSources,\n/)
  // Nothing reads the list around the reader.
  assert.equal(source.match(/appendToUrl\('mapped-sources\/'\)/g).length, 1)
})
