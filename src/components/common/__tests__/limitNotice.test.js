// The notice slot's pure rules (OpenConceptLab/ocl_online#702), as in TBv3:
// known fields only, http(s) links only, the way out first (rightmost in a
// dialog), a clamped bar, and the API's detail when no notice comes. Then the
// Mapper's part: a refusal's owner and read-only, and the notices route.
import test from 'node:test'
import assert from 'node:assert/strict'

const {
  READ_ONLY_ERROR_CODE, getLocks, getNotice, getNoticeDetail, getNoticeIcon, getNoticeTone, getNotices,
  getResourceNoticesRequest, isReadOnlyRefusal, locksEditing, normalizeNotice, orderActions, safeURL, toLimitRefusal,
} = await import('../limitNotice.js')

const NOTICE = {
  kind: 'read_only',
  tone: 'info',
  scope_type: 'account',
  title: 'Example notice',
  scope: 'Example scope',
  meter: {label: 'Example meter', fraction: 0.5, tone: 'info'},
  reset: 'Example reset.',
  restricted: 'Example restriction.',
  still_works: 'Example of what still works.',
  managed_by: 'Example managers.',
  actions: [
    {label: 'Example secondary', url: 'https://example.org/secondary', kind: 'secondary'},
    {label: 'Example way out', url: 'https://example.org/way-out', kind: 'primary'},
    {label: 'Example text', url: 'https://example.org/text', kind: 'text'},
  ],
  help: {label: 'Example help', url: 'https://example.org/help'},
  tooltip: 'Example tooltip.',
  locks: ['edit', 'delete'],
}

test('a full notice is kept as sent', () => {
  assert.deepEqual(normalizeNotice(NOTICE), NOTICE)
})

test('fields the slot does not know are dropped, and empty ones too', () => {
  const notice = normalizeNotice({...NOTICE, html: '<b>x</b>', note: 'Example note.', scope: '  ', reset: 7, restricted: {text: 'x'}, still_works: null})
  for(const field of ['html', 'note', 'scope', 'reset', 'restricted', 'still_works'])
    assert.equal(field in notice, false, field)
  assert.equal(notice.title, 'Example notice')
})

test('no usable notice without a title', () => {
  for(const payload of [null, undefined, 'Example notice', [], {}, {...NOTICE, title: ''}, {...NOTICE, title: undefined}])
    assert.equal(normalizeNotice(payload), null, JSON.stringify(payload))
})

test('only http(s) links are kept, and an action or help link needs one', () => {
  for(const url of ['javascript:alert(1)', 'data:text/html,x', 'ftp://example.org/', '/relative', '', null, 42])
    assert.equal(safeURL(url), null, String(url))
  assert.equal(safeURL('http://example.org/x'), 'http://example.org/x')
  const notice = normalizeNotice({...NOTICE, actions: [
    {label: 'Bad link', url: 'javascript:alert(1)', kind: 'primary'},
    {label: '', url: 'https://example.org/', kind: 'primary'},
    {url: 'https://example.org/'},
    {label: 'Unknown kind', url: 'https://example.org/unknown', kind: 'shiny'},
    'not an action',
  ], help: {label: 'Example help', url: 'javascript:void(0)'}})
  assert.deepEqual(notice.actions, [{label: 'Unknown kind', url: 'https://example.org/unknown', kind: 'secondary'}])
  assert.equal('help' in notice, false)
  assert.equal('actions' in normalizeNotice({...NOTICE, actions: [{label: 'x', url: 'javascript:x'}]}), false)
})

test('the meter fraction is clamped, and drives no bar unless it is a number', () => {
  assert.equal(normalizeNotice({...NOTICE, meter: {label: 'm', fraction: 1.7}}).meter.fraction, 1)
  assert.equal(normalizeNotice({...NOTICE, meter: {label: 'm', fraction: -0.2}}).meter.fraction, 0)
  for(const fraction of ['0.5', null, undefined, NaN, Infinity])
    assert.deepEqual(normalizeNotice({...NOTICE, meter: {label: 'm', fraction}}).meter, {label: 'm'}, String(fraction))
  assert.equal('meter' in normalizeNotice({...NOTICE, meter: {tone: 'info'}}), false)
})

test('unknown kinds, tones and scope types are dropped, and locks keep oclapi2 write actions once each', () => {
  const notice = normalizeNotice({...NOTICE, tone: 'loud', kind: 'other', scope_type: 'planet', locks: ['edit', 'fly', 3, 'edit']})
  for(const field of ['tone', 'kind', 'scope_type'])
    assert.equal(field in notice, false, field)
  assert.deepEqual(notice.locks, ['edit'])
})

test('a read-only notice is never dismissible', () => {
  assert.equal(normalizeNotice({...NOTICE, dismissible: true}).dismissible, undefined)
  assert.equal(normalizeNotice({...NOTICE, kind: 'quota', dismissible: true}).dismissible, true)
})

test('the notice and the detail are read from an axios error, a response or the body', () => {
  const body = {detail: 'Example detail.', error_code: 'example_limit_reached', notice: NOTICE}
  for(const value of [{response: {data: body}}, {data: body}, body]) {
    assert.equal(getNotice(value).title, 'Example notice')
    assert.equal(getNoticeDetail(value), 'Example detail.')
  }
  assert.equal(getNotice({detail: 'Example detail.'}), null)
  assert.equal(getNoticeDetail({error: 'Example error.'}), 'Example error.')
  assert.equal(getNoticeDetail({}), null)
})

test('the notices route answer keeps usable notices only', () => {
  assert.deepEqual(getNotices({notices: [{}, NOTICE, {tone: 'info'}]}).map(notice => notice.title), ['Example notice'])
  for(const data of [{notices: []}, {}, null, {notices: 'x'}])
    assert.deepEqual(getNotices(data), [], JSON.stringify(data))
})

test('the way out leads: first in strips and inline notices, rightmost in dialogs', () => {
  const actions = normalizeNotice(NOTICE).actions
  assert.deepEqual(orderActions(actions, 'strip').map(action => action.kind), ['primary', 'secondary', 'text'])
  assert.deepEqual(orderActions(actions, 'inline').map(action => action.kind), ['primary', 'secondary', 'text'])
  assert.deepEqual(orderActions(actions, 'dialog').map(action => action.kind), ['text', 'secondary', 'primary'])
  assert.deepEqual(orderActions(undefined, 'dialog'), [])
})

test('tone and icon come from the payload', () => {
  assert.equal(getNoticeTone({tone: 'error'}), 'error')
  assert.equal(getNoticeTone({meter: {tone: 'warning'}}), 'warning')
  assert.equal(getNoticeTone({}), 'info')
  assert.equal(getNoticeIcon({kind: 'read_only', tone: 'error'}), 'lock')
  assert.equal(getNoticeIcon({kind: 'not_included', tone: 'error'}), 'info')
  assert.equal(getNoticeIcon({kind: 'quota', tone: 'warning'}), 'warning')
  assert.equal(getNoticeIcon(null), 'info')
})

test('a project is read-only while its notice locks edit', () => {
  assert.deepEqual(getLocks([normalizeNotice(NOTICE), {locks: ['publish', 'edit']}]), ['edit', 'delete', 'publish'])
  assert.equal(locksEditing(normalizeNotice(NOTICE)), true)
  assert.equal(locksEditing(normalizeNotice({...NOTICE, locks: ['delete']})), false)
  assert.equal(locksEditing(normalizeNotice({...NOTICE, locks: undefined})), false)
  assert.equal(locksEditing(null), false)
})

test('a refusal shows its notice, else its detail, and says whose limit it was', () => {
  const body = {
    detail: 'Example detail.', error_code: 'example_limit_reached', capability: 'example.capability',
    quota: {kind: 'quota', unit: 'calls', owner: '/orgs/Example/', resets_at: null}, notice: NOTICE,
  }
  const refusal = toLimitRefusal({response: {data: body}})
  assert.equal(refusal.errorCode, 'example_limit_reached')
  assert.equal(refusal.capability, 'example.capability')
  assert.equal(refusal.owner, '/orgs/Example/')
  assert.equal(refusal.notice.title, 'Example notice')
  assert.equal(refusal.detail, 'Example detail.')
  assert.equal(refusal.readOnly, false)

  const bare = toLimitRefusal({detail: 'Example detail.', error_code: READ_ONLY_ERROR_CODE, capability: 'example.capability'})
  assert.equal(bare.notice, null)
  assert.equal(bare.owner, null)
  assert.equal(bare.detail, 'Example detail.')
  assert.equal(bare.readOnly, true)
  assert.deepEqual(toLimitRefusal(undefined), {errorCode: null, capability: null, owner: null, notice: null, detail: null, readOnly: false})
})

test('a read-only refusal is known by its code', () => {
  assert.equal(isReadOnlyRefusal({error_code: 'content_read_only'}), true)
  assert.equal(isReadOnlyRefusal({response: {data: {error_code: 'content_read_only'}}}), true)
  assert.equal(isReadOnlyRefusal({error_code: 'example_limit_reached'}), false)
  assert.equal(isReadOnlyRefusal(null), false)
})

test('the notices route is asked about one resource, signed in, in the UI language', () => {
  assert.deepEqual(
    getResourceNoticesRequest({baseURL: 'https://api.example.org/', token: 'personal-token', resource: '/users/someone/map-projects/7/', lang: 'pt-BR'}),
    {
      url: 'https://api.example.org/capabilities/notices/',
      params: {resource: '/users/someone/map-projects/7/', lang: 'pt-BR'},
      headers: {Authorization: 'Token personal-token'},
    }
  )
  assert.equal(getResourceNoticesRequest({baseURL: 'https://api.example.org', token: undefined, resource: '/users/someone/map-projects/7/'}), null)
  assert.equal(getResourceNoticesRequest({baseURL: '', token: 'personal-token', resource: '/users/someone/map-projects/7/'}), null)
  assert.equal(getResourceNoticesRequest({baseURL: 'https://api.example.org', token: 'personal-token', resource: null}), null)
})
