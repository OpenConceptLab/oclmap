import React from 'react'
import axios from 'axios'
import { useTranslation } from 'react-i18next'

import { currentUserToken, getAPIURL } from '../../common/utils'
import { getCapabilityNoteRequest, toCapabilityNote } from './capabilityNote'

// The API's line about `capability` for `owner`, asked for again when the
// owner changes; null while `enabled` is false, and when the API sends none,
// fails or has no such route. axios directly, not APIService, so a missing
// route or a refusal skips its sign-out and throttling handling.
const useCapabilityNote = (capability, owner, enabled = true) => {
  const { i18n } = useTranslation()
  const [note, setNote] = React.useState(null)

  React.useEffect(() => {
    setNote(null)
    const request = enabled ?
      getCapabilityNoteRequest({baseURL: getAPIURL(), token: currentUserToken(), capability, owner, lang: i18n.language}) :
      null
    if(!request)
      return undefined
    // a reply for an owner no longer chosen is dropped
    let current = true
    axios.get(request.url, {params: request.params, headers: request.headers, timeout: 10000})
      .then(response => current && setNote(toCapabilityNote(response.data)))
      .catch(() => {})
    return () => {
      current = false
    }
  }, [capability, owner, enabled, i18n.language])

  return note
}

export default useCapabilityNote
