/* global globalThis */
import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const { getAnnouncement, isDismissed, msUntilExpiry, rememberDismissal } = await import('../announcement.js')

const SETTING = {
  id: 'maintenance-2026-11',
  text: {en: 'Maintenance on Saturday.', es: 'Saturday maintenance, in Spanish.', 'pt-BR': 'Saturday maintenance, in Portuguese.'},
  links: [
    {label: {en: 'Details', es: 'Details, in Spanish'}, url: 'https://status.example.org/maintenance'},
    {label: {en: 'Contact us'}, url: 'https://example.org/contact'},
  ],
  until: '2026-11-09T00:00:00Z',
}
const BEFORE = Date.parse('2026-11-01T12:00:00Z')

const announce = (setting, language = 'en', now = BEFORE) => getAnnouncement(JSON.stringify(setting), language, now)

test('no setting: no banner', () => {
  assert.equal(getAnnouncement(undefined, 'en', BEFORE), null)
  assert.equal(getAnnouncement('', 'en', BEFORE), null)
  assert.equal(getAnnouncement('  ', 'en', BEFORE), null)
})

test('a valid setting shows its text and links', () => {
  assert.deepEqual(announce(SETTING), {
    id: 'maintenance-2026-11',
    text: 'Maintenance on Saturday.',
    links: [
      {label: 'Details', url: 'https://status.example.org/maintenance'},
      {label: 'Contact us', url: 'https://example.org/contact'},
    ],
    until: Date.parse('2026-11-09T00:00:00Z'),
  })
})

test('until is optional, and links may be empty', () => {
  assert.deepEqual(announce({id: 'a', text: {en: 'Hello'}, links: []}), {id: 'a', text: 'Hello', links: [], until: null})
})

test('text is returned as it was given, for the banner to show as plain text', () => {
  assert.equal(announce({id: 'a', text: {en: '<b onmouseover="alert(1)">Hi</b>'}, links: []}).text, '<b onmouseover="alert(1)">Hi</b>')
})

test('invalid JSON: no banner', () => {
  assert.equal(getAnnouncement('{"id": "a", "text": {"en": "Hi"}', 'en', BEFORE), null)
  assert.equal(getAnnouncement('not json', 'en', BEFORE), null)
})

test('JSON that is not an object: no banner', () => {
  ['null', '[]', '"Hello"', '42', 'true'].forEach(raw => assert.equal(getAnnouncement(raw, 'en', BEFORE), null, raw))
})

test('a missing or empty id: no banner', () => {
  assert.equal(announce({...SETTING, id: undefined}), null)
  assert.equal(announce({...SETTING, id: ' '}), null)
  assert.equal(announce({...SETTING, id: 7}), null)
})

test('missing or malformed text: no banner', () => {
  assert.equal(announce({...SETTING, text: undefined}), null)
  assert.equal(announce({...SETTING, text: 'Maintenance on Saturday.'}), null)
  assert.equal(announce({...SETTING, text: {es: 'Saturday maintenance, in Spanish.'}}), null)
  assert.equal(announce({...SETTING, text: {en: ''}}), null)
  assert.equal(announce({...SETTING, text: {en: 'Hi', es: 3}}), null)
})

test('missing or malformed links: no banner', () => {
  assert.equal(announce({...SETTING, links: undefined}), null)
  assert.equal(announce({...SETTING, links: null}), null)
  assert.equal(announce({...SETTING, links: {label: {en: 'Details'}, url: 'https://example.org'}}), null)
  assert.equal(announce({...SETTING, links: ['https://example.org']}), null)
  assert.equal(announce({...SETTING, links: [{url: 'https://example.org'}]}), null)
  assert.equal(announce({...SETTING, links: [{label: {es: 'Details, in Spanish'}, url: 'https://example.org'}]}), null)
  assert.equal(announce({...SETTING, links: [{label: {en: 'Details'}}]}), null)
})

test('a link that is not https: no banner', () => {
  ['http://example.org', 'javascript:alert(1)', 'data:text/html,<script>alert(1)</script>', '/blog/post', '//example.org', 'example.org'].forEach(url => {
    assert.equal(announce({...SETTING, links: [{label: {en: 'Details'}, url}]}), null, url)
  })
})

test('hidden after until', () => {
  assert.equal(announce(SETTING, 'en', Date.parse('2026-11-09T00:00:00Z')), null)
  assert.equal(announce(SETTING, 'en', Date.parse('2026-12-01T00:00:00Z')), null)
  assert.equal(announce(SETTING, 'en', Date.parse('2026-11-08T23:59:59Z')).id, 'maintenance-2026-11')
})

test('the banner is checked again when its until arrives', () => {
  assert.equal(msUntilExpiry(announce(SETTING), Date.parse('2026-11-08T23:00:00Z')), 60 * 60 * 1000)
  assert.equal(msUntilExpiry(announce({...SETTING, until: undefined})), null)
})

test('checking again at each delay hides a banner at its until, even weeks away', () => {
  const setting = {...SETTING, until: '2027-03-01T00:00:00Z'}
  let now = BEFORE, checks = 0
  for(let shown = announce(setting, 'en', now); shown; shown = announce(setting, 'en', now)) {
    const delay = msUntilExpiry(shown, now)
    assert.ok(delay > 0 && delay <= 2 ** 31 - 1, `a delay setTimeout can wait: ${delay}`)
    now += delay
    assert.ok(++checks < 10)
  }
  assert.equal(now, Date.parse('2027-03-01T00:00:00Z'))
})

test('an until that is not a date: no banner', () => {
  assert.equal(announce({...SETTING, until: 'next week'}), null)
  assert.equal(announce({...SETTING, until: 1762646400000}), null)
})

test('shows the user\'s language, or its base language, or en', () => {
  assert.equal(announce(SETTING, 'es').text, 'Saturday maintenance, in Spanish.')
  assert.deepEqual(announce(SETTING, 'es').links.map(link => link.label), ['Details, in Spanish', 'Contact us'])
  assert.equal(announce(SETTING, 'pt-BR').text, 'Saturday maintenance, in Portuguese.')
  assert.equal(announce(SETTING, 'es-MX').text, 'Saturday maintenance, in Spanish.')
  assert.equal(announce(SETTING, 'zh').text, 'Maintenance on Saturday.')
  assert.equal(announce(SETTING, undefined).text, 'Maintenance on Saturday.')
  assert.equal(announce(SETTING, 'constructor').text, 'Maintenance on Saturday.')
})

test('a dismissed announcement stays dismissed, and a new id shows again', () => {
  const items = {}
  globalThis.localStorage = {getItem: key => key in items ? items[key] : null, setItem: (key, value) => { items[key] = String(value) }}
  assert.equal(isDismissed('maintenance-2026-11'), false)
  rememberDismissal('maintenance-2026-11')
  assert.equal(isDismissed('maintenance-2026-11'), true)
  assert.equal(isDismissed('maintenance-2026-12'), false)
})

test('without storage, the banner shows and dismissing it does not throw', () => {
  globalThis.localStorage = {getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('blocked') }}
  assert.equal(isDismissed('maintenance-2026-11'), false)
  assert.doesNotThrow(() => rememberDismissal('maintenance-2026-11'))
})

// start-prod.sh writes the setting into env-config.js with its js_string function.
const START_PROD = readFileSync(new URL('../../../start-prod.sh', import.meta.url), 'utf8')
const JS_STRING = START_PROD.match(/^js_string\(\) \{\n[\s\S]*?^\}$/m)[0]
const envConfigLine = value => execFileSync('bash', ['-c', `${JS_STRING}\necho "var ANNOUNCEMENT = $(js_string "$1");"`, 'bash', value], {encoding: 'utf8'})

test('start-prod.sh writes the setting as one string literal that reads back unchanged', () => {
  [
    JSON.stringify(SETTING),
    '{"id": "a", "text": {"en": "Say \\"hi\\"\\n to C:\\\\ and 中文 ✓"}}',
    'line one\nline two\r\nline three',
    'a\\', '\\"', 'tab\there', '\u2028\u2029', '</script><script>alert(1)</script>',
  ].forEach(value => {
    const context = {}
    vm.runInNewContext(envConfigLine(value), context)
    assert.deepEqual(Object.keys(context), ['ANNOUNCEMENT'], value)
    assert.equal(context.ANNOUNCEMENT, value)
  })
})

test('a setting cannot end the string and run script in env-config.js', () => {
  ['"; globalThis.ran = true; "', '\\"; globalThis.ran = true; //', '"\nglobalThis.ran = true\n"', '"\rglobalThis.ran = true\r"'].forEach(value => {
    const context = {}
    vm.runInNewContext(envConfigLine(value), context)
    assert.equal(context.ran, undefined, value)
    assert.equal(context.ANNOUNCEMENT, value)
  })
})
