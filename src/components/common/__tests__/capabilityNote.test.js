import test from 'node:test'
import assert from 'node:assert/strict'

const {
  capabilityNoteReducer, getCapabilityNoteRequest, getKeptCapabilityNote, toCapabilityNote, toCapabilityNoteKey,
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
const run = actions => actions.reduce(capabilityNoteReducer, {asked: null, kept: null})

test('a line shows for the owner and language it was sent for, once it arrives', () => {
  assert.equal(getKeptCapabilityNote(run([{type: 'ask', key: ORG}]), ORG), null)
  const replied = run([{type: 'ask', key: ORG}, {type: 'reply', key: ORG, note: 'A line from the API.'}])
  assert.equal(getKeptCapabilityNote(replied, ORG), 'A line from the API.')
  assert.equal(getKeptCapabilityNote(replied, PERSONAL), null)
  assert.equal(getKeptCapabilityNote(replied, keyFor('/orgs/Example/', 'es')), null)
})

test('a new owner never shows the last one\'s line, and returning waits for a fresh reply', () => {
  const asked = [{type: 'ask', key: PERSONAL}, {type: 'reply', key: PERSONAL, note: 'Personal line.'}, {type: 'ask', key: ORG}]
  assert.equal(getKeptCapabilityNote(run(asked), ORG), null)
  // back to the first owner before the organization replies, and its new request fails (no reply)
  const back = run([...asked, {type: 'ask', key: PERSONAL}])
  assert.equal(getKeptCapabilityNote(back, PERSONAL), null)
  // the organization's late reply is dropped
  assert.equal(getKeptCapabilityNote(run([...asked, {type: 'ask', key: PERSONAL}, {type: 'reply', key: ORG, note: 'Org line.'}]), PERSONAL), null)
  assert.equal(getKeptCapabilityNote(run([...asked, {type: 'ask', key: PERSONAL}, {type: 'reply', key: ORG, note: 'Org line.'}]), ORG), null)
})

test('nothing to ask about while disabled or with no owner', () => {
  assert.equal(toCapabilityNoteKey({capability: 'example.capability', owner: '/orgs/Example/', lang: 'en', enabled: false}), null)
  assert.equal(toCapabilityNoteKey({capability: 'example.capability', owner: '', lang: 'en'}), null)
  const disabled = run([{type: 'ask', key: ORG}, {type: 'reply', key: ORG, note: 'x'}, {type: 'ask', key: null}, {type: 'reply', key: null, note: 'y'}])
  assert.equal(getKeptCapabilityNote(disabled, null), null)
  assert.equal(getKeptCapabilityNote(disabled, ORG), null)
})
