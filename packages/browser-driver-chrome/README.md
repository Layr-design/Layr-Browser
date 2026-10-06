# @layr/browser-driver-chrome

A separate CDP driver for `@layr/browser`. `CdpBrowserDriver` accepts a `CdpTransport`; `ChromeDebuggerTransport` adapts a Chrome extension's `chrome.debugger` API for a tab ID. An extension should pass `chrome.debugger` and the selected tab ID:

```ts
const transport = new ChromeDebuggerTransport(chrome.debugger, tabId);
const browser = await createBrowser({ driver: new CdpBrowserDriver(transport) });
```

The driver currently reads DOM and accessibility trees, viewport and scroll, resolves box models, dispatches pointer/keyboard input, navigates, and takes screenshots. It has a mocked protocol test, but has not been exercised against a live extension tab in this repository. Cross-origin frames, accurate CSS visibility, live form values, cross-frame actions, precise nested scroll behavior, and stronger navigation/load heuristics need further work before production use. No Chrome API enters the core package.
