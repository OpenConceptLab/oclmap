# React component integration tests

Tests in this directory mount real React components in a `happy-dom`
environment via `@testing-library/react`. They run separately from the
pure-function unit tests in `__tests__/`.

## Run

```bash
npm run test:integration    # only the integration tests
npm test                    # only the pure-function unit tests (unchanged)
npm run test:all            # both
```

## When to write what

| Test type | Location | Use when |
|---|---|---|
| Pure unit test | `src/**/__tests__/*.test.js` | Testing pure functions, normalizers, view builders, score math. Fast (~100 ms for the whole suite). Use `node:assert/strict`. |
| Integration test | `src/**/__integration__/*.test.js` | Testing React component lifecycle — useEffect timing, setState batching, ref-vs-state interactions, RTL `render` + user events. Slower (~1 s per test). Use `@testing-library/react`. |

If a behavior can be unit-tested by extracting a pure function, prefer that —
integration tests are an order of magnitude slower and have more moving parts.

## Conventions (written for easy Vitest migration later)

We use `node:test` with happy-dom + RTL today. If we ever migrate to Vitest,
the body of each test should translate via a small codemod (imports +
assertions). To keep that path open:

- **Use `test()`, not `it()`**. Both runners accept both, but `test` is
  node:test-idiomatic and Vitest-compatible.
- **Use `@testing-library/react`'s built-in queries** (`getByText`,
  `queryBy*`, `findBy*`). They are runner-agnostic.
- **Use `assert.ok(el)` for DOM presence** instead of jest-dom's
  `.toBeInTheDocument()`. Trades readability for one fewer dep + simpler
  migration. (If we add `@testing-library/jest-dom` later it would work in
  Vitest too.)
- **Avoid `t.mock.fn()`** (node:test-specific). For stubbing external
  modules, prefer a thin wrapper module that can be swapped at test time.

## Why happy-dom instead of jsdom

`happy-dom` is ~5× faster on startup and covers everything React 18 needs
for the patterns oclmap uses. If a future test needs an API happy-dom
doesn't implement (e.g. SVG-specific things, MediaQueryList nuances), we
can swap to `jsdom` per-test or globally — the RTL API is identical on both.

## Why React.createElement instead of JSX in test files

These test files run via `node --test` without a JSX transform step.
Writing `React.createElement('div', null, 'hello')` instead of `<div>hello</div>`
keeps the runner config tiny and the dependency footprint at two new packages
(`@testing-library/react`, `@happy-dom/global-registrator`). If JSX becomes
painful, we can add `tsx` or migrate to Vitest — both handle JSX natively.

## Setup

`test-integration-setup.js` at the repo root registers happy-dom globals
(`window`, `document`, `HTMLElement`, `navigator`) and sets
`IS_REACT_ACT_ENVIRONMENT = true`. It's loaded once per test process via
`node --import`.
