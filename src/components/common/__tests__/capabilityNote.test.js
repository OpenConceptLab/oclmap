import test from 'node:test'
import assert from 'node:assert/strict'

const { getCapabilityNoteRequest, getKeptCapabilityNote, toCapabilityNote, toCapabilityNoteKey } = await import('../capabilityNote.js')

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

test('a line is shown only for the owner and language it was sent for', () => {
  const key = toCapabilityNoteKey({capability: 'example.capability', owner: '/orgs/Example/', lang: 'en'})
  const kept = {key, note: 'A line from the API.'}
  assert.equal(getKeptCapabilityNote(kept, key), 'A line from the API.')
  assert.equal(getKeptCapabilityNote(kept, toCapabilityNoteKey({capability: 'example.capability', owner: '/users/someone/', lang: 'en'})), null)
  assert.equal(getKeptCapabilityNote(kept, toCapabilityNoteKey({capability: 'example.capability', owner: '/orgs/Example/', lang: 'es'})), null)
  assert.equal(getKeptCapabilityNote(null, key), null)
})

test('nothing to ask about while disabled or with no owner', () => {
  assert.equal(toCapabilityNoteKey({capability: 'example.capability', owner: '/orgs/Example/', lang: 'en', enabled: false}), null)
  assert.equal(toCapabilityNoteKey({capability: 'example.capability', owner: '', lang: 'en'}), null)
  assert.equal(getKeptCapabilityNote({key: null, note: 'x'}, null), null)
})
