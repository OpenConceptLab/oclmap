import React from 'react'
import axios from 'axios'
import { useTranslation } from 'react-i18next'

import { currentUserToken, getAPIURL } from '../../common/utils'
import { getNotices, getResourceNoticesRequest } from './limitNotice.js'

const PENDING = {loaded: false, notice: null}

// The API's answer about one repository or map project (`resource`, its
// relative URL), asked for once per resource and language
// (OpenConceptLab/ocl_online#702): {loaded, notice, requestedAt}. loaded once
// the latest request is answered, with its first notice or none, and when it
// was asked for (performance.now()); not while it waits, and never when the
// API refuses (401), fails or has no such route (404). axios directly, not
// APIService, so a missing route skips its sign-out and throttling handling.
const useResourceNotice = resource => {
  const { i18n } = useTranslation()
  const key = JSON.stringify([resource, i18n.language])
  const [reply, setReply] = React.useState({key: null, ...PENDING})

  React.useEffect(() => {
    const request = getResourceNoticesRequest({baseURL: getAPIURL(), token: currentUserToken(), resource, lang: i18n.language})
    if(!request)
      return undefined
    // only this request's reply, while it's the latest
    let current = true
    const requestedAt = performance.now()
    axios.get(request.url, {params: request.params, headers: request.headers, timeout: 10000})
      .then(response => current && setReply({key, loaded: true, notice: getNotices(response.data)[0] || null, requestedAt}))
      .catch(() => {})
    return () => {
      current = false
    }
  }, [key])

  return reply.key === key ? reply : PENDING
}

export default useResourceNotice
