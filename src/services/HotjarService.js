/*eslint no-process-env: 0*/
import reactHotjar from 'react-hotjar';
import { isGranted, onConsentChange } from './consent.js';

// A default import, so Node can load this CommonJS package in the unit tests too.
const { hotjar } = reactHotjar;

// Hotjar heatmaps on the Mapper (OpenConceptLab/ocl_online#533, chosen in #464).
// Plan and requirements: docs/ocl_online-533-hotjar-heatmaps-plan.md.
//
// Hotjar loads only after the person allows the "heatmaps" category
// (services/consent.js, components/app/PrivacyConsent.jsx). Before that it sets
// no script, no cookie and no request.
//
// How Hotjar produces heatmaps (help.hotjar.com, "How to Set Up Heatmaps",
// "How to Update a Heatmap Screenshot"): they come from *session capture*, the
// same capture as Recordings. That is a DOM snapshot plus clicks, taps, moves and
// scrolls, not video. The heatmap is drawn over a screenshot taken from a captured
// session. Elements marked data-hj-suppress are masked in the browser before
// anything is sent: the grid and right-hand panel in MapProject.jsx, the project
// list in MapProjects.jsx, the user menu. Inputs are masked by default.
//
// Dashboard setup (site HOTJAR_ID 3169197, set in production env-config.js; leave
// it unset everywhere else):
//   1. Site settings > Session capture: on. The daily session limit is shared by
//      Heatmaps and Recordings; above it Hotjar samples.
//   2. Site settings > Tracking URL changes: "Track changes manually", so Hotjar
//      uses the paths recordPageView sends instead of the real URL.
//   3. Heatmaps, one per page, by URL filter ("is exactly" / "matches regex", PCRE2):
//        https://map.openconceptlab.org/                    (home, project list)
//        https://map.openconceptlab.org/map-projects/new    (new project)
//        ^https://map\.openconceptlab\.org/(users|orgs)/:owner/map-projects/:projectId/?$
//   4. Recordings (optional): the same session capture under the same consent;
//      limit them to the three pages with URL targeting, see "How to trigger
//      Recordings and Heatmaps based on URLs" (article 36820033643281).

const SNIPPET_VERSION = 6;

/*eslint no-undef: 0*/
const hotjarId = () => (typeof window !== 'undefined' && window.HOTJAR_ID) || process.env.HOTJAR_ID;

// /users/jon/map-projects/42 -> /users/:owner/map-projects/:projectId. Each project
// would otherwise get its own heatmap, keyed by a URL carrying the username.
// Mirrors the route in App.jsx.
const PROJECT_PATH = /^\/([^/]+)\/[^/]+\/map-projects\/[^/]+\/?$/;
export const hotjarPath = pathname =>
  pathname.replace(PROJECT_PATH, (_, ownerType) => `/${ownerType}/:owner/map-projects/:projectId`);

// Hotjar's cookies (_hjSessionUser_<site>, _hjSession_<site>, ...) can sit on the
// host or on a parent domain, so expire each one on all of them, never on the TLD.
export const clearHotjarCookies = (doc = document) => {
  const names = doc.cookie.split(';').map(cookie => cookie.split('=')[0].trim()).filter(name => name.startsWith('_hj'));
  const labels = doc.location.hostname.split('.');
  const domains = labels.slice(0, -1).map((_, i) => labels.slice(i).join('.'));
  names.forEach(name => {
    doc.cookie = `${name}=; Max-Age=0; path=/`;
    domains.forEach(domain => { doc.cookie = `${name}=; Max-Age=0; path=/; domain=${domain}`; });
  });
};

let running = false;
let listening = false;

const start = () => {
  const id = hotjarId();
  if(running || !id)
    return;
  hotjar.initialize(id, SNIPPET_VERSION);
  running = true;
  hotjar.stateChange(hotjarPath(window.location.pathname));
};

const HotjarService = {
  // No HOTJAR_ID (dev, QA, staging): nothing to consent to, so PrivacyConsent hides
  isConfigured() {
    return Boolean(hotjarId());
  },

  // Once, at app start: starts Hotjar now if allowed, and whenever the choice
  // later allows it. Hotjar has no off switch once its script runs, so a
  // withdrawal clears its cookies and PrivacyConsent reloads the page.
  initialize() {
    if(isGranted('heatmaps'))
      start();
    if(listening)
      return;
    listening = true;
    onConsentChange(consent => {
      if(consent.heatmaps)
        start();
      else
        clearHotjarCookies();
    });
  },

  isRunning() {
    return running;
  },

  recordPageView(pathname) {
    if(running)
      hotjar.stateChange(hotjarPath(pathname));
  },
};

export default HotjarService;
