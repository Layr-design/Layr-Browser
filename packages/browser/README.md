# @layr/browser

LAYR's foundation for browser control, semantic observation, and future experience capture.

```text
AI agent → @layr/browser → BrowserDriver → Chrome or another browser
```

The core has no Chrome, Playwright, or Puppeteer dependency. A driver supplies raw DOM/accessibility data and primitive input. The core filters and normalizes that data, owns stable `e_N` references, resolves semantic locators, serializes actions, and returns versioned observations and diffs.

```ts
import { createBrowser, serializeObservation } from '@layr/browser';

const browser = await createBrowser({ driver });
const page = await browser.observe();
console.log(serializeObservation(page));
await browser.type({ label: 'Email' }, { text: 'hello@layr.design' });
await browser.click({ role: 'button', name: 'Continue' });
const next = await browser.observe({ since: page.revision });
console.log(next.diff);
await browser.dispose();
```

## Current scope

Implemented: session lifecycle, driver contract and capabilities, fake driver, semantic tree, element reconciliation, semantic locators, serial action pipeline, basic actionability, bounded stale-node retry, event-assisted stabilization with polling fallback, wait conditions, diffs, event notifications, compact serialization, screenshot delegation, and password redaction. `agent`, `design`, and `experience` observation modes currently use the same semantic collector. The Chrome driver is a separate package.

Planned: richer layout/style and component analysis; robust frame and Shadow DOM traversal; nested scroll handling; design and motion observation; visual sampling; experience capture and timeline; recording/replay. Motion and experience types express these extension points but do not capture behavior yet. Canvas/WebGL requires visual sampling because DOM semantics cannot describe its scene.

## Principles

- Driver agnostic and semantic first.
- Public `e_N` references survive compatible DOM replacement when fingerprint matching is unambiguous. References are session-local.
- Observations have revisions and timestamps; actions return semantic changes.
- Derived motion will carry provenance and confidence.
- Password values are redacted before entering semantic observations. No content telemetry or console logging is emitted.

Run `npm test`, `npm run typecheck`, and `node packages/browser/bench/observe.mjs` from the workspace root. The benchmark prints measured local values without setting performance targets.
