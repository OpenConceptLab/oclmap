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
const NO_WAIT = {maxRetries: 2, baseDelayMs: 0}

// Failed answers as APIService gives them in raw mode.
const httpError = status => ({isAxiosError: true, response: {status}})
const networkError = {isAxiosError: true, code: 'ERR_NETWORK'}

const sourcesPage = (page, numFound) => ({
  data: Array.from({length: Math.min(25, numFound - (page - 1) * 25)}, (_, i) => ({url: `/orgs/X/sources/S${(page - 1) * 25 + i}/`})),
  headers: {num_found: String(numFound)}
})

// A fake API that answers each page once `settle()` runs, and counts the
// reads. `answer(url, page, n)` can replace the n-th read's answer.
const fakeAPI = (numFound = 50, answer = () => undefined) => {
  const reads = []
  const pending = []
  const fetchPage = (url, page) => {
    reads.push(`${url}#${page}`)
    const n = reads.length
    return new Promise(resolve => pending.push(() => resolve(answer(url, page, n) || sourcesPage(page, numFound))))
  }
  const settle = async () => {
    for(let idle = 0; idle < 5;) {
      await new Promise(resolve => setTimeout(resolve, 0))
      if(pending.length) {
        idle = 0
        pending.splice(0).forEach(resolve => resolve())
      } else {
        idle++
      }
    }
  }
  return {fetchPage, reads, settle}
}

const readerFor = api => createMappedSourcesReader(api.fetchPage, NO_WAIT)

test('the bridge probe and the target share one read of each page of the same version', async () => {
  const api = fakeAPI(50)
  const read = readerFor(api)
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
  const read = readerFor(api)
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
  const read = readerFor(api)
  read(CIEL_RELEASE, () => {})
  read(`${CIEL}v2026-10-23/`, () => {})
  await api.settle()

  assert.deepEqual(api.reads, [`${CIEL_RELEASE}#1`, `${CIEL}v2026-10-23/#1`])
})

test('a repository\'s HEAD is one version, at its own URL or at HEAD/', async () => {
  // The versions list gives HEAD the repository's URL; a bridge resolved to
  // HEAD asks for <repository>/HEAD/.
  const api = fakeAPI(10)
  const read = readerFor(api)
  const lists = []
  read(CIEL, list => lists.push(list.length))
  read(`${CIEL}HEAD/`, list => lists.push(list.length))
  await api.settle()

  assert.deepEqual(api.reads, [`${CIEL}#1`])
  assert.deepEqual(lists, [10, 10])
})

test('a version id the API encodes in its URL is the same version as the bare id', async () => {
  const api = fakeAPI(10)
  const read = readerFor(api)
  read(`${CIEL}v1%40build/`, () => {})
  read(`${CIEL}v1@build/`, () => {})
  // oclapi2 can encode it twice: once itself, then again in Django's reverse().
  read(`${CIEL}v1%2540build/`, () => {})
  await api.settle()

  assert.deepEqual(api.reads, [`${CIEL}v1%40build/#1`])
})

test('a failed page gives what was read so far and is read again on the next ask', async () => {
  let failing = true
  const api = fakeAPI(50, (_, page) => failing && page === 2 ? httpError(404) : undefined)
  const read = readerFor(api)
  const lists = []
  read(CIEL_RELEASE, list => lists.push(list.length))
  await api.settle()
  // A 404 isn't tried again.
  assert.deepEqual(lists, [25, 25])

  failing = false
  const retried = []
  read(CIEL_RELEASE, list => retried.push(list.length))
  await api.settle()

  // Page 1 came back, so only page 2 is asked for again.
  assert.deepEqual(api.reads, [`${CIEL_RELEASE}#1`, `${CIEL_RELEASE}#2`, `${CIEL_RELEASE}#2`])
  assert.deepEqual(retried, [25, 50])
})

test('a throttled page is read again when the version is chosen again', async () => {
  const api = fakeAPI(10, (_, __, n) => n === 1 ? httpError(429) : undefined)
  const read = readerFor(api)
  const lists = []
  read(CIEL_RELEASE, list => lists.push(list.length))
  await api.settle()
  assert.deepEqual(lists, [0])

  read(CIEL_RELEASE, list => lists.push(list.length))
  await api.settle()

  assert.equal(api.reads.length, 2)
  assert.deepEqual(lists, [0, 10])
})

test('a network error or a 5xx is tried again, at most twice', async () => {
  const api = fakeAPI(10, (_, __, n) => [networkError, httpError(503)][n - 1])
  const lists = []
  readerFor(api)(CIEL_RELEASE, list => lists.push(list.length))
  await api.settle()
  assert.equal(api.reads.length, 3)
  assert.deepEqual(lists, [10])

  const failing = fakeAPI(10, () => httpError(503))
  const failed = []
  readerFor(failing)(CIEL_RELEASE, list => failed.push(list.length))
  await failing.settle()
  assert.equal(failing.reads.length, 3)
  assert.deepEqual(failed, [0])
})

test('a page isn\'t tried again once no read waits for it', async () => {
  const api = fakeAPI(10, () => httpError(503))
  const read = readerFor(api)
  const stopBridge = read(CIEL_RELEASE, () => {})
  const stopTarget = read(CIEL_RELEASE, () => {})
  stopBridge()
  stopTarget()
  await api.settle()

  assert.equal(api.reads.length, 1)
})

test('a stopped read gives nothing more', async () => {
  const api = fakeAPI(50)
  const read = readerFor(api)
  const lists = []
  const stop = read(CIEL_RELEASE, list => lists.push(list.length))
  stop()
  await api.settle()

  assert.deepEqual(lists, [])
})

// The bridge probe, with a fake $resolveReference that answers as APIService
// does in raw mode.
const resolved = version => ({data: [{result: {version}}]})
const probeWith = ({algo, selected = false, namespace = '/users/jontest1/', answers = [resolved('v2026-09-24')]}) => {
  const api = fakeAPI(50)
  const resolves = []
  const pins = []
  const sources = {}
  const stop = probeBridgeMappedSources({
    algo,
    selected,
    namespace,
    resolveVersion: (url, ns) => {
      resolves.push([url, ns])
      return Promise.resolve(answers[Math.min(resolves.length, answers.length) - 1])
    },
    readMappedSources: readerFor(api),
    pinVersion: (id, v) => pins.push([id, v]),
    onSources: (url, list) => { sources[url] = list.length },
    retry: NO_WAIT
  })
  return {api, resolves, pins, sources, stop}
}

test('a bridge algorithm with a version reads that version without resolving', async () => {
  const probe = probeWith({algo: {id: 'b', target_repo_url: CIEL, target_repo_version: 'v2026-09-24'}})
  await probe.api.settle()

  assert.deepEqual(probe.resolves, [])
  assert.deepEqual(probe.api.reads, [`${CIEL_RELEASE}#1`, `${CIEL_RELEASE}#2`])
  assert.deepEqual(probe.sources, {[CIEL]: 50})
})

test('a bridge algorithm with no version reads the version it resolves to, in the namespace given', async () => {
  const probe = probeWith({algo: {id: 'b', target_repo_url: CIEL}})
  await probe.api.settle()

  assert.deepEqual(probe.resolves, [[CIEL, '/users/jontest1/']])
  assert.deepEqual(probe.api.reads, [`${CIEL_RELEASE}#1`, `${CIEL_RELEASE}#2`])
  // The API's offer isn't selected: its version isn't pinned.
  assert.deepEqual(probe.pins, [])
})

test('selecting a bridge algorithm pins its resolved version', async () => {
  const probe = probeWith({algo: {id: 'b', target_repo_url: CIEL}, selected: true})
  await probe.api.settle()

  assert.deepEqual(probe.pins, [['b', 'v2026-09-24']])
})

test('resolving the bridge version is tried again after a network error or a 5xx', async () => {
  const probe = probeWith({algo: {id: 'b', target_repo_url: CIEL}, selected: true, answers: [httpError(503), networkError, resolved('v2026-09-24')]})
  await probe.api.settle()

  assert.equal(probe.resolves.length, 3)
  assert.deepEqual(probe.pins, [['b', 'v2026-09-24']])
  assert.deepEqual(probe.sources, {[CIEL]: 50})
})

test('a probe stopped before its version resolves pins, reads and retries nothing', async () => {
  const probe = probeWith({algo: {id: 'b', target_repo_url: CIEL}, selected: true})
  probe.stop()
  await probe.api.settle()
  assert.deepEqual(probe.pins, [])
  assert.deepEqual(probe.api.reads, [])

  const failing = probeWith({algo: {id: 'b', target_repo_url: CIEL}, answers: [httpError(503)]})
  failing.stop()
  await failing.api.settle()
  assert.equal(failing.resolves.length, 1)
})

test('no version, or no bridge repository, reads nothing', async () => {
  for(const algo of [undefined, {id: 'b'}, {id: 'b', target_repo_url: CIEL}]) {
    const probe = probeWith({algo, answers: [resolved('')]})
    await probe.api.settle()
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

test('the target version and the bridge probe read through the one shared reader, in raw mode', () => {
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
  // Leaving the project stops the target's read, and a versions answer that
  // lands after it starts none.
  assert.match(source, /if\(request !== versionsRequestRef\.current \|\| !isMountedRef\.current\)\n\s*return\n\s*let _versions/)
  assert.match(source, /React\.useEffect\(\(\) => \(\) => stopTargetMappedSourcesRef\.current\(\), \[\]\)/)
  // Nothing reads the list around the reader, and a throttled read settles.
  assert.equal(source.match(/appendToUrl\('mapped-sources\/'\)/g).length, 1)
  assert.match(source, /appendToUrl\('mapped-sources\/'\)\.get\(null, null, \{[^}]*\}, true\)/)
  assert.match(source, /resolveNamespace \? \{namespace: resolveNamespace\} : undefined, true\)/)
})
