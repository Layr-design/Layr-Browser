# Browser architecture decision

The supplied workspace was empty on 2026-10-05, so this change establishes a small npm workspace with strict TypeScript and dependency-free core modules. A separate Chrome package holds CDP and the extension debugger adapter.

`BrowserDriver` exists to isolate data collection and input dispatch from semantic interpretation. CDP backend IDs are useful inside the Chrome driver but can disappear on rerender, so agents receive session-local LAYR element refs. The registry first checks driver identity, then uses a weighted semantic fingerprint to recover compatible replacements; ambiguous matches get a new ref.

Raw browser data, normalized observations, and agent text are separate representations. This permits future design and experience modes to preserve richer evidence while keeping agent output compact. Time, scroll state, revisions, and provenance types make animation and scroll sampling possible without embedding agent reasoning in the package.

LAYR is building control, semantics, and experience capture for interface understanding. It deliberately exposes a small action API rather than reproducing Playwright's test runner or broad automation surface. The action pipeline uses visibility, enabled state, usable bounds, a bounded retry, and event-assisted quiet periods as an initial reliability base.

Reference decisions: browser-use's DOM/AX/snapshot join and agent serialization; browser-harness's small CDP primitive layer; browsercode's persistent CDP session boundary; Playwright's semantic locators and actionability checks; CDP DOM, Accessibility, Runtime, Page, and Input domains; DevTools Frontend's protocol/model separation; rrweb's timestamped full and incremental event timeline. No reference implementation was copied.

## References inspected

- [browser-use DOM service](https://github.com/browser-use/browser-use/blob/main/browser_use/dom/service.py) and [snapshot join](https://github.com/browser-use/browser-use/blob/main/browser_use/dom/enhanced_snapshot.py): joining DOM, accessibility, and layout evidence before agent serialization.
- [browser-harness](https://github.com/browser-use/browser-harness): small CDP primitives and reusable interaction helpers.
- [browsercode](https://github.com/browser-use/browsercode): a persistent browser session around direct CDP access, with agent execution outside the browser primitives.
- [Playwright locators](https://playwright.dev/docs/locators) and [actionability](https://playwright.dev/docs/actionability): user-facing target resolution and pre-action checks.
- [CDP DOM](https://chromedevtools.github.io/devtools-protocol/tot/DOM/), [Accessibility](https://chromedevtools.github.io/devtools-protocol/tot/Accessibility/), [Runtime](https://chromedevtools.github.io/devtools-protocol/tot/Runtime/), [Page](https://chromedevtools.github.io/devtools-protocol/tot/Page/), [Input](https://chromedevtools.github.io/devtools-protocol/tot/Input/), and [DOMSnapshot](https://chromedevtools.github.io/devtools-protocol/tot/DOMSnapshot/): protocol boundaries and later layout capture.
- [DevTools Frontend SDK](https://github.com/ChromeDevTools/devtools-frontend/tree/main/front_end/core/sdk): separate models for DOM, accessibility, CSS, animation, and targets.
- [rrweb events](https://github.com/rrweb-io/rrweb/blob/main/docs/events.md): timestamped full and incremental event streams for future recording architecture.
