/*eslint no-process-env: 0*/
import React from 'react';
import { Route, Switch, withRouter } from 'react-router-dom';
import {
  recordGAPageView, isLoggedIn, getLoginURL, isV3URL, isV2URL, isRedirectingToLoginViaReferrer,
  isInWaitlist, getEnv
} from '../../common/utils';
import Error404 from '../errors/Error404';
import Error403 from '../errors/Error403';
import Error401 from '../errors/Error401';
import WaitListing from '../errors/WaitListing'
import NetworkError from '../errors/NetworkError'
import ThrottlingError from '../errors/ThrottlingError'
import ErrorBoundary from '../errors/ErrorBoundary';
import CheckAuth from './CheckAuth'
import Footer from './Footer';
import DocumentTitle from "./DocumentTitle"
import SigninRedirect from './SigninRedirect'
import './App.scss';
import { hotjar } from 'react-hotjar';
import APIService from '../../services/APIService'
import Header from './Header';
import OIDLoginCallback from '../users/OIDLoginCallback';
import { OperationsContext } from './LayoutContext';
import Alert from '../common/Alert';
import MapProject from '../map-projects/MapProject'
import MapProjects from '../map-projects/MapProjects'
import { useTranslation } from 'react-i18next';

const AuthenticationRequiredRoute = ({component: Component, ...rest}) => {
  const { toggles } = React.useContext(OperationsContext);
  const env = getEnv()
  return (
    <Route
      {...rest}
      render={
        props =>
        isLoggedIn() ?
          (
            isInWaitlist() ?
              <WaitListing /> :
            <Component {...props} />
          ) :
          isRedirectingToLoginViaReferrer(props.location) ?
          <CheckAuth /> :
          ((toggles?.MAPPER_WAITLIST_TOGGLE === true || ['staging', 'production', 'development'].includes(env)) ? <WaitListing /> : <Error401 />)
      }
    />
  )
}

const App = props => {
  const { t } = useTranslation();
  const [startupError, setStartupError] = React.useState(null)
  const [throttlingError, setThrottlingError] = React.useState(null)
  const { alert, setAlert, setToggles } = React.useContext(OperationsContext);
  const setupHotJar = () => {
    /*eslint no-undef: 0*/
    const HID = window.HOTJAR_ID || process.env.HOTJAR_ID
    if(HID)
      hotjar.initialize(HID, 6);
  }

  const fetchToggles = async () => {
    return new Promise(resolve => {
      APIService.toggles().get().then(response => {
        if(response === 'Network Error')
          setStartupError({ type: 'network' })
        else if(response?.status !== 429) {
          setToggles(response.data)
          resolve();
        }
      });
    });
  }

  const addLogoutListenerForAllTabs = () => window.addEventListener(
    "storage",
    event => {
      if(event.key === 'token' && !event.newValue) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        if(!localStorage?.server)
          window.location = '/';
      }
    });

  const forceLoginUser = () => {
    const { search, hash, pathname } = props.location
    const queryParams = new URLSearchParams(search)
    const referrer = queryParams.get('referrer')
    if(isLoggedIn()) {
      window.location.hash = '#'  + pathname
    } else if(referrer && (isV3URL(referrer) || isV2URL(referrer)) && !isLoggedIn()) {
      const parts = hash.split('?')
      let params = new URLSearchParams(parts[1])
      if(params.get('auth') === 'true') {
        window.location.href = getLoginURL(window.location.origin + '/#' + pathname)
      }
    }
  }

  React.useEffect(() => {
    const unsubscribe = APIService.onThrottle(details => {
      setThrottlingError(details)
    })

    forceLoginUser()
    fetchToggles()
    addLogoutListenerForAllTabs()
    recordGAPageView()
    setupHotJar()

    return () => unsubscribe()
  }, [])

  const clearThrottlingError = React.useCallback(() => {
    setThrottlingError(null)
    setAlert({
      severity: 'success',
      message: t('errors.throttled.ended'),
      duration: 4000,
    })
  }, [setAlert, t])

  return (
    <div>
      <DocumentTitle/>
      <Header>
        <ErrorBoundary>
          <main className='content'>
            {startupError?.type === 'network' ? (
              <NetworkError />
            ) : (
              <React.Fragment>
                <Switch>
                  <Route exact path="/signin" component={SigninRedirect} />
                  <Route exact path="/oidc/login" component={OIDLoginCallback} />
                  <AuthenticationRequiredRoute exact path='/' component={MapProjects} />
                  <AuthenticationRequiredRoute exact path='/map-projects' component={MapProjects} />
                  <AuthenticationRequiredRoute exact path='/map-projects/new' component={MapProject} />
                  <AuthenticationRequiredRoute exact path='/:ownerType/:owner/map-projects/:projectId' component={MapProject} />
                  <Route exact path='/403' component={Error403} />
                  <Route component={Error404} />
                </Switch>
                {throttlingError && (
                  <ThrottlingError
                    retryAfter={throttlingError.retryAfter}
                    limitType={throttlingError.limitType}
                    onExpire={clearThrottlingError}
                  />
                )}
              </React.Fragment>
            )}
            <Alert message={alert?.message} onClose={() => setAlert(false)} severity={alert?.severity} duration={alert?.duration} />
          </main>
        </ErrorBoundary>
        <Footer {...props} />
      </Header>
    </div>
  );
}

export default withRouter(App);
