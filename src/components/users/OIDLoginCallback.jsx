/*eslint no-process-env: 0*/
import React from 'react';
import { withTranslation } from 'react-i18next';
import {
  refreshCurrentUserCache
} from '../../common/utils';
import APIService from '../../services/APIService'
import { OperationsContext } from '../app/LayoutContext';

class OIDLoginCallback extends React.Component {
  static contextType = OperationsContext
  constructor(props) {
    super(props)
    this.state = {
      next: null,
    }
  }
  componentDidMount() {
    this.exchangeCodeForToken()
  }

  exchangeCodeForToken = () => {
    const queryParams = new URLSearchParams(this.props.location.search)
    const code = queryParams.get('code')
    const idToken = queryParams.get('id_token')
    const next = queryParams.get('next')
    if(code) {
      /*eslint no-undef: 0*/
      const { setAlert } = this.context
      setAlert({message: this.props.t('auth.signing_in'), severity: 'info'})
      this.setState({next: next && next !== '/' ? next : null }, () => {
        const redirectURL = this.state.next ? window.location.origin + this.state.next : (window.LOGIN_REDIRECT_URL || process.env.LOGIN_REDIRECT_URL)
        const clientSecret = window.OIDC_RP_CLIENT_SECRET || process.env.OIDC_RP_CLIENT_SECRET
        const clientId = window.OIDC_RP_CLIENT_ID || process.env.OIDC_RP_CLIENT_ID

        APIService.users().appendToUrl('oidc/code-exchange/').post({code: code, redirect_uri: redirectURL, client_id: clientId, client_secret: clientSecret}).then(res => {
          if(res.data?.access_token) {
            localStorage.removeItem('server_configs')
            localStorage.setItem('token', res.data.access_token)
            localStorage.setItem('id_token', idToken)
            const sessionExpired = sessionStorage.getItem('session_expired')
            sessionStorage.removeItem('session_expired')
            setAlert({
              duration: 2000,
              severity: sessionExpired ? 'info' : 'success',
              message: sessionExpired ? this.props.t('auth.session_expired') : this.props.t('auth.sign_in_success')
            })
            this.cacheUserData()
          } else {
            setAlert({severity: 'error', message: res.data?.error_description || this.props.t('auth.sign_in_error')})
          }
        })
      })
    }
  }

  cacheUserData() {
    refreshCurrentUserCache(() => {
      if(this.state.next)
        window.location.hash = '#' + this.state.next
      else {
        let returnToURL = '/'
        if(this.props?.location?.search) {
          const queryParams = new URLSearchParams(this.props.location.search)
          if(queryParams && queryParams.get('returnTo'))
            returnToURL = queryParams.get('returnTo')
        }
        window.location.hash  = '#' + returnToURL
      }
    })
  }

  render() {
    return (<React.Fragment />)
  }
}

export default withTranslation('translations')(OIDLoginCallback);
