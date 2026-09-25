/*eslint no-process-env: 0*/
import React from 'react';
import { withTranslation } from 'react-i18next';
import Button from '@mui/material/Button';
import {
  refreshCurrentUserCache, consumeStoredPKCECodeVerifier, consumeAndValidateOAuthState,
  isSignupOAuthState, isLoggedIn, getLoginURL
} from '../../common/utils';
import APIService from '../../services/APIService'
import GAService from '../../services/GAService'
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
    const next = queryParams.get('next')
    const state = queryParams.get('state')
    if(code) {
      /*eslint no-undef: 0*/
      const { setAlert } = this.context
      const isStateValid = consumeAndValidateOAuthState(state)
      const codeVerifier = consumeStoredPKCECodeVerifier()
      if(!isStateValid || !codeVerifier) {
        this.onSignInStartedElsewhere(state, next)
        return
      }
      setAlert({message: this.props.t('auth.signing_in'), severity: 'info'})
      this.setState({next: next && next !== '/' ? next : null }, () => {
        const redirectURL = this.state.next ? window.location.origin + this.state.next : (window.LOGIN_REDIRECT_URL || process.env.LOGIN_REDIRECT_URL)
        const clientId = window.OIDC_RP_CLIENT_ID || process.env.OIDC_RP_CLIENT_ID

        APIService.users().appendToUrl('oidc/code-exchange/').post({code: code, redirect_uri: redirectURL, client_id: clientId, code_verifier: codeVerifier}).then(res => {
          if(res.data?.access_token) {
            GAService.recordSignupComplete()
            localStorage.removeItem('server_configs')
            localStorage.setItem('token', res.data.access_token)
            localStorage.setItem('id_token', res.data.id_token)
            sessionStorage.removeItem('session_expired')
            setAlert({
              duration: 2000,
              severity: 'success',
              message: this.props.t('auth.sign_in_success')
            })
            this.cacheUserData()
          } else {
            GAService.clearSignupFlow()
            setAlert({severity: 'error', message: res.data?.error_description || this.props.t('auth.sign_in_error')})
          }
        })
      })
    }
  }

  // Keycloak finished a sign-in this tab didn't start: the email-verification or password-reset link opened
  // in a new tab, or an old callback URL reopened. With no PKCE verifier here the code can't be redeemed, so
  // drop it and let the user sign in normally. Sign-up, verification and sign-in stay separate steps.
  onSignInStartedElsewhere = (state, next) => {
    const { setAlert } = this.context
    const isSignup = isSignupOAuthState(state)
    if(isSignup)
      GAService.recordSignupVerified()
    if(!isLoggedIn())
      setAlert({
        severity: isSignup ? 'success' : 'info',
        message: this.props.t(isSignup ? 'auth.email_verified_sign_in' : 'auth.sign_in_to_continue'),
        action: (
          <Button color='inherit' size='small' onClick={() => getLoginURL(window.location.href).then(url => { window.location.href = url })}>
            {this.props.t('auth.sign_in')}
          </Button>
        )
      })
    window.location.hash = '#' + (next || '/')
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
