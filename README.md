# Layr-Browser

LAYR's browser control and semantic observation foundation. The workspace contains a driver-agnostic core, an isolated Chrome DevTools Protocol driver, and a local Chrome extension for testing browser behavior.

## Packages

- [`@layr/browser`](packages/browser/README.md) — semantic observations, stable element refs, actions, diffs, and serialization.
- [`@layr/browser-driver-chrome`](packages/browser-driver-chrome/README.md) — CDP driver and `chrome.debugger` transport.
- [Browser test extension](packages/browser-test-extension/README.md) — 13 live fixture scenarios.

## Develop

Requires Node.js and TypeScript. From the workspace root:

```sh
npm install
npm test
npm run typecheck
npm run lint
```

Run `npm run fixtures` to serve the test pages at `http://127.0.0.1:4173`. Build and load the unpacked extension as described in its README.

The [architecture decision](docs/browser-architecture.md) explains the package boundaries. The [test matrix](docs/browser-test-matrix.md) records the live and deterministic coverage.
