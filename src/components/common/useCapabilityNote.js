import React from 'react'
import axios from 'axios'
import { useTranslation } from 'react-i18next'

import { currentUserToken, getAPIURL } from '../../common/utils'
import { getCapabilityNoteRequest, toCapabilityNote, toCapabilityNoteKey, useKeptCapabilityNote } from './capabilityNote'

// The API's line about `capability` for `owner`, asked for again when the
// owner changes; null while `enabled` is false, until the reply arrives, and
// when the API sends none, fails or has no such route. axios directly, not
// APIService, so a missing route or a refusal skips its sign-out and
// throttling handling.
const useCapabilityNote = (capability, owner, enabled = true) => {
  const { i18n } = useTranslation()
  const key = toCapabilityNoteKey({capability, owner, lang: i18n.language, enabled})
  const [note, keep] = useKeptCapabilityNote(key)

  React.useEffect(() => {
    const request = key ?
      getCapabilityNoteRequest({baseURL: getAPIURL(), token: currentUserToken(), capability, owner, lang: i18n.language}) :
      null
    if(!request)
      return undefined
    // only this request's reply, while it's the latest
    let current = true
    axios.get(request.url, {params: request.params, headers: request.headers, timeout: 10000})
      .then(response => current && keep(key, toCapabilityNote(response.data)))
      .catch(() => {})
    return () => {
      current = false
    }
  }, [key])

  return note
}

export default useCapabilityNote
