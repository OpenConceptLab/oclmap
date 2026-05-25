// Test integration setup — registers happy-dom globals (window, document,
// HTMLElement, navigator, etc.) before any test files load. Loaded via the
// `node --import ./test-integration-setup.js` flag in the `test:integration`
// npm script.
//
// Pure-function unit tests under src/**/__tests__/ do NOT load this file —
// they continue running against bare Node with no DOM, exactly as before.
// Only React component tests under src/**/__integration__/ get the DOM.

import { GlobalRegistrator } from '@happy-dom/global-registrator'

GlobalRegistrator.register({
  // Set a real URL so anything reading window.location doesn't blow up.
  url: 'http://localhost/',
  // React 18 needs IS_REACT_ACT_ENVIRONMENT set to silence the "act()" warning.
  // We do that via a global at this scope.
})

// React 18 production builds warn about non-act updates without this flag.
globalThis.IS_REACT_ACT_ENVIRONMENT = true
