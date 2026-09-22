/*eslint no-process-env: 0*/
import ReactGA from 'react-ga4';
import { startCase } from 'lodash';
import { OCL_CLIENT } from '../common/constants';

const SIGNUP_FLOW_PENDING_KEY = 'signup_flow_pending';

const gaId = () => window.GA_ACCOUNT_ID || process.env.GA_ACCOUNT_ID;
const enabled = () => Boolean(gaId() && gaId() !== 'UA-000000-01');

let initialized = false;
const initialize = () => {
  /*eslint no-undef: 0*/
  if(initialized || !enabled())
    return;

  // react-ga4 only applies options on the first initialize call.
  ReactGA.initialize(gaId(), { gtagOptions: { send_page_view: false } });
  initialized = true;
};

const GAService = {
  recordPageView() {
    initialize();
    if(!enabled())
      return;

    ReactGA.send({ hitType: 'pageview', page: window.location.pathname + window.location.hash.split('?')[0] });
  },

  recordUpsertEvent(category, edit, resource) {
    const actionPrefix = edit ? 'update' : 'create';
    resource = resource || category.replaceAll(' ', '_').toLowerCase();
    const action = `${actionPrefix}_${resource}`;
    const label = `${startCase(actionPrefix)} ${startCase(resource)}`;
    this.recordEvent(action, { event_category: category, event_label: label });
  },

  recordSignupStart() {
    sessionStorage.setItem(SIGNUP_FLOW_PENDING_KEY, '1');
    this.recordEvent('signup_start', { event_category: 'auth', event_label: 'signup_start' });
  },

  clearSignupFlow() {
    sessionStorage.removeItem(SIGNUP_FLOW_PENDING_KEY);
  },

  recordSignupComplete() {
    const pending = sessionStorage.getItem(SIGNUP_FLOW_PENDING_KEY) === '1';
    this.clearSignupFlow();
    if(pending)
      this.recordEvent('signup_complete', { event_category: 'auth', event_label: 'signup_complete' });
  },

  recordEvent(name, params) {
    initialize();
    if(!enabled())
      return;

    ReactGA.event(name, { client: OCL_CLIENT, ...params });
  },
};

export default GAService;
