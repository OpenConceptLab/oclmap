import test from 'node:test'
import assert from 'node:assert/strict'

const { getLimitActionRequest, getLimitSubject, getRefusalOwner, toLimitAction } = await import('../limitAction.js')
const { PREVIEW_LIMIT_ERROR_CODES } = await import('../../map-projects/previewLimits.js')

const ACTION = {kind: 'example', url: 'https://online.example.org/next', label: 'Next step', message: 'A message from the service.'}

test('no online-api URL or no token: no request', () => {
  assert.equal(getLimitActionRequest({baseURL: '', token: 'personal-token', errorCode: 'mapper_access_denied', lang: 'en'}), null)
  assert.equal(getLimitActionRequest({baseURL: undefined, token: 'personal-token'}), null)
  assert.equal(getLimitActionRequest({baseURL: 'https://online.example.org', token: undefined}), null)
})

test('asks about the refused capability in the UI language, with the person\'s token', () => {
  assert.deepEqual(
    getLimitActionRequest({baseURL: 'https://online.example.org/', token: 'personal-token', errorCode: 'mapper_rows_per_project_not_entitled', lang: 'pt-BR'}),
    {
      url: 'https://online.example.org/billing/plan/',
      params: {context: 'limit', capability: 'mapper.rows_per_project', lang: 'pt-BR'},
      headers: {Authorization: 'Token personal-token'},
    }
  )
})

test('an access check asks about its permission', () => {
  assert.deepEqual(
    getLimitActionRequest({baseURL: 'https://online.example.org', token: 'personal-token', errorCode: 'mapper_scispacy_denied', lang: 'en'}).params,
    {context: 'limit', permission: 'users.mapper_scispacy', lang: 'en'}
  )
})

// OpenConceptLab/ocl_online#641
test('a refusal that names its capability is asked about that one', () => {
  assert.deepEqual(
    getLimitActionRequest({baseURL: 'https://online.example.org', token: 'personal-token', errorCode: 'example_service_limit_reached', capability: 'example.capability', lang: 'es'}).params,
    {context: 'limit', capability: 'example.capability', lang: 'es'}
  )
  assert.deepEqual(getLimitSubject('ai_assistant_calls_limit_reached', 'example.capability'), {capability: 'example.capability'})
  for (const capability of [undefined, null, '', 7])
    assert.deepEqual(getLimitSubject('ai_assistant_calls_limit_reached', capability), {capability: 'ai_assistant.calls'}, String(capability))
})

test('every refusal the dialogs show names one capability or permission', () => {
  [
    'mapper_match_operations_limit_reached',
    'ai_assistant_calls_limit_reached',
    'ai_assistant_change_comments_limit_reached',
    'mapper_projects_limit_reached',
    'mapper_rows_per_project_limit_reached',
    ...PREVIEW_LIMIT_ERROR_CODES,
  ].forEach(errorCode => assert.equal(Object.keys(getLimitSubject(errorCode)).length, 1, errorCode))
  assert.deepEqual(getLimitSubject('validation_error'), {})
})

test('an action with a link and a label is shown as sent', () => {
  assert.deepEqual(toLimitAction({action: ACTION}), ACTION)
  assert.deepEqual(toLimitAction({action: {...ACTION, message: null}}), {...ACTION, message: null})
  assert.equal(toLimitAction({action: {...ACTION, message: '  '}}).message, null)
})

test('no action, or one that is not a usable link, shows nothing', () => {
  assert.equal(toLimitAction({action: null}), null)
  assert.equal(toLimitAction(undefined), null)
  assert.equal(toLimitAction({action: {...ACTION, label: ''}}), null)
  assert.equal(toLimitAction({action: {...ACTION, url: 'not a url'}}), null)
  assert.equal(toLimitAction({action: {...ACTION, url: 'javascript:void(0)'}}), null)
  assert.equal(toLimitAction({action: {...ACTION, url: 'data:text/html,hi'}}), null)
  assert.equal(toLimitAction({action: {...ACTION, url: 42}}), null)
})

// OpenConceptLab/ocl_online#701
test('the next step is asked for whose limit it was, when the refusal says', () => {
  assert.deepEqual(
    getLimitActionRequest({baseURL: 'https://online.example.org', token: 'personal-token', errorCode: 'example_limit_reached', capability: 'example.capability', owner: '/orgs/Example/', lang: 'en'}).params,
    {context: 'limit', capability: 'example.capability', owner: '/orgs/Example/', lang: 'en'}
  )
  assert.equal('owner' in getLimitActionRequest({baseURL: 'https://online.example.org', token: 'personal-token', errorCode: 'mapper_access_denied', owner: null, lang: 'en'}).params, false)
})

test('a refusal\'s owner is a user\'s or an organization\'s relative URL', () => {
  assert.equal(getRefusalOwner({quota: {owner: '/users/someone/'}}), '/users/someone/')
  assert.equal(getRefusalOwner({quota: {owner: '/orgs/Example/'}}), '/orgs/Example/')
  for(const owner of [undefined, null, '', 'someone', '/users/someone', '/sources/x/', 'https://example.org/orgs/Example/', '/orgs/Example/sources/', 7])
    assert.equal(getRefusalOwner({quota: {owner}}), null, String(owner))
  assert.equal(getRefusalOwner({}), null)
  assert.equal(getRefusalOwner(null), null)
})
