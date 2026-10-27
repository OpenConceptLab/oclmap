import test from 'node:test'
import assert from 'node:assert/strict'

const { getLimitActionRequest, getLimitCapability, toLimitAction } = await import('../limitAction.js')
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

test('every refusal the dialogs show names a capability', () => {
  [
    'mapper_match_operations_limit_reached',
    'ai_assistant_calls_limit_reached',
    'ai_assistant_change_comments_limit_reached',
    'mapper_projects_limit_reached',
    'mapper_rows_per_project_limit_reached',
    ...PREVIEW_LIMIT_ERROR_CODES,
  ].forEach(errorCode => assert.ok(getLimitCapability(errorCode), errorCode))
  assert.equal(getLimitCapability('validation_error'), undefined)
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
