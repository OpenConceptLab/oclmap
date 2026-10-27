/*eslint no-process-env: 0*/
import React from 'react'
import axios from 'axios'
import { useTranslation } from 'react-i18next'

import GAService from '../../services/GAService'
import { currentUserToken } from '../../common/utils'
import { getLimitActionRequest, getLimitCapability, toLimitAction } from './limitAction'

/*eslint no-undef: 0*/
const getOnlineAPIURL = () => window.OCL_ONLINE_API_URL || process.env.OCL_ONLINE_API_URL

// Records the refusal and, when online-api is configured, asks it for the
// person's next step. Not configured, failing or nothing to offer: no action.
// axios directly, not APIService, so online-api's errors skip its sign-out and throttling handling.
const useLimitAction = (open, errorCode) => {
  const { i18n } = useTranslation()
  const [action, setAction] = React.useState(null)
  const capability = getLimitCapability(errorCode)

  React.useEffect(() => {
    setAction(null)
    if(!open)
      return undefined
    GAService.recordActionEvent('Limit', 'limit_hit', errorCode, {capability})
    const request = getLimitActionRequest({baseURL: getOnlineAPIURL(), token: currentUserToken(), errorCode, lang: i18n.language})
    if(!request)
      return undefined
    let current = true
    axios.get(request.url, {params: request.params, headers: request.headers, timeout: 10000})
      .then(response => current && setAction(toLimitAction(response.data)))
      .catch(() => {})
    return () => {
      current = false
    }
  }, [open, errorCode])

  const onActionClick = () => GAService.recordActionEvent('Limit', 'limit_action_click', errorCode, {capability, action_kind: action?.kind})

  return {action, onActionClick}
}

export default useLimitAction
