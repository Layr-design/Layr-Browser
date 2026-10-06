# LAYR Browser Test Harness

A local Manifest V3 Chrome extension that runs `@layr/browser` through `CdpBrowserDriver` and `ChromeDebuggerTransport`. It opens fixture tabs, attaches through `chrome.debugger`, performs public API actions, records pass/fail results, then detaches and closes each tab.

## Run in Chrome

From the workspace root:

```sh
npm run build
npm run fixtures
```

In Chrome, open `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and select `packages/browser-test-extension/dist`. After rebuilding an already loaded unpacked extension, click its **Reload** button on `chrome://extensions` and refresh the runner tab. Click **LAYR Browser Test Harness** in the toolbar, then click **Run scenarios**. The fixture server must remain running at `http://127.0.0.1:4173`; its address can be changed in the runner page.

The unpacked extension requests `debugger` and `tabs` permissions and host access only to localhost fixture pages. Use a throwaway browser profile for testing. Remove the extension when finished.

## Scenarios

The runner executes 13 cases across basic form input, keyboard, hover, disabled action, password redaction, DOM replacement/ref recovery, modal, nested scroll, sticky layout, CSS and JS parallax fixtures, CSS and Web Animations, Shadow DOM, iframe observation, virtual list, navigation, and screenshot capture. The runner checks fixture animation behavior and screenshots; it does **not** claim LAYR motion inference exists. Iframe observation is checked, while cross-frame interaction remains future work.

`npm test` also validates the generated unpacked extension and tests the CDP transport and core with deterministic fakes. A passing unit suite does not substitute for a live extension run.

The current build passed all 13 live scenarios in the user's Chrome run on 2026-10-05. These are fixture checks; motion inference and cross-frame actions remain outside their scope.
