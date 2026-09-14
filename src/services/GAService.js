/*eslint no-process-env: 0*/
import ReactGA from 'react-ga4';
import { startCase } from 'lodash';
import { OCL_CLIENT } from '../common/constants';

const SIGNUP_FLOW_PENDING_KEY = 'signup_flow_pending';

const gaId = () => window.GA_ACCOUNT_ID || process.env.GA_ACCOUNT_ID;

// The marketing site only exists in prod, at these two domains, regardless
// of which env this app itself is running in. v3./app. mirror this app's
// own env (e.g. map.qa. -> app.v3.qa., map.qa. -> app.qa.).
const linkedDomains = () => {
  const host = window.location.host;

  return [
    'openconceptlab.org',
    'preview.openconceptlab.org',
    host.replace('map.', 'app.v3.'),
    host.replace('map.', 'app.'),
  ];
};

const initialize = options => {
  /*eslint no-undef: 0*/
  ReactGA.initialize(gaId(), options);
};

const GAService = {
  recordPageView() {
    initialize({ gtagOptions: { linker: { domains: linkedDomains() } } });
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
    ReactGA.event(name, { client: OCL_CLIENT, ...params });
  },
};

export default GAService;
