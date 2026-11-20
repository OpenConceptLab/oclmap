import test from 'node:test'
import assert from 'node:assert/strict'

const {
  capabilityNoteReducer, getCapabilityNoteRequest, toCapabilityNote, toCapabilityNoteKey,
} = await import('../capabilityNote.js')

const REQUEST = {baseURL: 'https://api.example.org/', token: 'personal-token', capability: 'example.capability', owner: '/orgs/Example/', lang: 'pt-BR'}

test('asks the API about the capability for the chosen owner, in the UI language, with the person\'s token', () => {
  assert.deepEqual(getCapabilityNoteRequest(REQUEST), {
    url: 'https://api.example.org/capabilities/example.capability/note/',
    params: {owner: '/orgs/Example/', lang: 'pt-BR'},
    headers: {Authorization: 'Token personal-token'},
  })
})

test('no API URL, token, capability or owner: no request', () => {
  for(const field of ['baseURL', 'token', 'capability', 'owner'])
    assert.equal(getCapabilityNoteRequest({...REQUEST, [field]: ''}), null, field)
})

test('shows only a non-empty string it is sent', () => {
  assert.equal(toCapabilityNote({message: ' A line from the API. '}), 'A line from the API.')
  for(const data of [undefined, null, {}, {message: null}, {message: ''}, {message: '  '}, {message: 3}, {message: {text: 'x'}}, 'text'])
    assert.equal(toCapabilityNote(data), null, JSON.stringify(data))
})

const keyFor = (owner, lang = 'en') => toCapabilityNoteKey({capability: 'example.capability', owner, lang})
const ORG = keyFor('/orgs/Example/')
const PERSONAL = keyFor('/users/someone/')
const run = actions => actions.reduce(capabilityNoteReducer, {asked: null, note: null})

test('a line is kept once the reply to the latest ask arrives', () => {
  assert.deepEqual(run([{type: 'ask', key: ORG}]), {asked: ORG, note: null})
  assert.deepEqual(run([{type: 'ask', key: ORG}, {type: 'reply', key: ORG, note: 'A line.'}]), {asked: ORG, note: 'A line.'})
})

test('asking again drops the line, and a reply to an earlier ask is dropped', () => {
  const asked = [{type: 'ask', key: PERSONAL}, {type: 'reply', key: PERSONAL, note: 'Personal line.'}, {type: 'ask', key: ORG}]
  assert.deepEqual(run(asked), {asked: ORG, note: null})
  // back to the first owner before the organization replies; its new request fails (no reply), and the organization's
  // late reply is dropped
  assert.deepEqual(run([...asked, {type: 'ask', key: PERSONAL}, {type: 'reply', key: ORG, note: 'Org line.'}]), {asked: PERSONAL, note: null})
})

test('nothing to ask about while disabled or with no owner', () => {
  assert.equal(toCapabilityNoteKey({capability: 'example.capability', owner: '/orgs/Example/', lang: 'en', enabled: false}), null)
  assert.equal(toCapabilityNoteKey({capability: 'example.capability', owner: '', lang: 'en'}), null)
  assert.deepEqual(run([{type: 'ask', key: ORG}, {type: 'reply', key: ORG, note: 'x'}, {type: 'ask', key: null}, {type: 'reply', key: null, note: 'y'}]), {asked: null, note: null})
})
