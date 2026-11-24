import React from 'react'
import axios from 'axios'
import { useTranslation } from 'react-i18next'

import { currentUserToken, getAPIURL } from '../../common/utils'
import { getNotices, getResourceNoticesRequest } from './limitNotice.js'

// The API's first notice for one repository or map project (`resource`, its
// relative URL), asked for once per resource and language
// (OpenConceptLab/ocl_online#702). null until the reply arrives, and when the
// API sends none, refuses (401), fails or has no such route (404). axios
// directly, not APIService, so a missing route skips its sign-out and
// throttling handling.
const useResourceNotice = resource => {
  const { i18n } = useTranslation()
  const [reply, setReply] = React.useState({resource: null, notice: null})

  React.useEffect(() => {
    const request = getResourceNoticesRequest({baseURL: getAPIURL(), token: currentUserToken(), resource, lang: i18n.language})
    if(!request)
      return undefined
    // only this request's reply, while it's the latest
    let current = true
    axios.get(request.url, {params: request.params, headers: request.headers, timeout: 10000})
      .then(response => current && setReply({resource, notice: getNotices(response.data)[0] || null}))
      .catch(() => {})
    return () => {
      current = false
    }
  }, [resource, i18n.language])

  return reply.resource === resource ? reply.notice : null
}

export default useResourceNotice
