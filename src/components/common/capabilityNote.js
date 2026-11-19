// A line the API may send to show beside a form, about a capability and the
// owner the form is for (OpenConceptLab/ocl_online#700). Open code shows only
// the text it's sent: an API without the route sends nothing, and nothing shows.

export const getCapabilityNoteRequest = ({baseURL, token, capability, owner, lang}) => {
  if(!baseURL || !token || !capability || !owner)
    return null
  return {
    url: `${baseURL.replace(/\/+$/, '')}/capabilities/${capability}/note/`,
    params: {owner, lang},
    headers: {Authorization: `Token ${token}`},
  }
}

// Only a non-empty string becomes a line.
export const toCapabilityNote = data =>
  typeof data?.message === 'string' && data.message.trim() ? data.message.trim() : null

// What a line is for: the capability, the owner and the language. None while
// there's nothing to ask about.
export const toCapabilityNoteKey = ({capability, owner, lang, enabled = true}) =>
  enabled && capability && owner ? JSON.stringify([capability, owner, lang]) : null

// The line kept for `key`, never one kept for another owner or language.
export const getKeptCapabilityNote = (kept, key) => key && kept?.key === key ? kept.note : null
