import axios from 'axios'
import { useTranslation } from 'react-i18next'

import { currentUserToken, getAPIURL } from '../../common/utils'
import { getResourceNoticesRequest } from './limitNotice.js'
import useNoticeLookup from './useNoticeLookup.js'

// The API's answer about one repository or map project (`resource`, its
// relative URL), asked for once per resource and language, and again on each
// return to the page while `recheck` is true (useNoticeLookup). Never loaded
// when the API refuses (401), fails or has no such route (404). axios
// directly, not APIService, so a missing route skips its sign-out and
// throttling handling.
const useResourceNotice = (resource, recheck = false) => {
  const { i18n } = useTranslation()
  const ask = () => {
    const request = getResourceNoticesRequest({baseURL: getAPIURL(), token: currentUserToken(), resource, lang: i18n.language})
    return request && axios.get(request.url, {params: request.params, headers: request.headers, timeout: 10000})
  }
  return useNoticeLookup(JSON.stringify([resource, i18n.language]), ask, recheck)
}

export default useResourceNotice
