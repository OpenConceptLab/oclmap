import React, { useEffect } from 'react'
import { getLoginURL } from '../../common/utils'

const SigninRedirect = props => {
  useEffect(() => {
    const queryParams = new URLSearchParams(props.location?.search)
    const returnTo = queryParams.get('returnTo')
    getLoginURL(returnTo).then(url => { window.location.href = url })
  }, [])

  return <h4>Redirecting...</h4>
}

export default SigninRedirect
