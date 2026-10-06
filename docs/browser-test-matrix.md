# Browser test matrix

The unpacked extension in `packages/browser-test-extension/dist` contains a 13-case live suite. The user ran the current build in Chrome and supplied a screenshot showing **13/13 scenarios passing** on 2026-10-05. Local build, lint, typecheck, and all 24 deterministic tests also passed. The live suite checks the behavior listed below; it does not validate motion inference or cross-frame actions.

| Scenario | Live extension assertion | Automated coverage here |
| --- | --- | --- |
| Basic form | type, clear, keyboard, click, hover, disabled action, password redaction | fake core actions and redaction; mocked CDP keyboard and AX |
| DOM replacement | preserve ref and click replacement | registry and stale recovery tests |
| Modal | open, locate, type, submit | mocked CDP hidden-dialog handling |
| Nested scroll | scroll named container | core target mapping and mocked CDP wheel point |
| Sticky | document scroll and screenshot | mocked CDP screenshot |
| CSS parallax | fixed background and scroll | fixture and runner build check |
| JS parallax | transform changes after scroll | fixture and runner build check |
| CSS animation | native animation exists and screenshot works | fixture and runner build check |
| Web Animation | Web Animation exists and screenshot works | fixture and runner build check |
| Shadow DOM | observe and click shadow button | mocked CDP traversal |
| Iframe | observe frame owner | mocked CDP frame metadata |
| Virtual list | visible range changes after nested scroll | semantic diff test |
| Navigation | navigate to another fixture and wait for URL | fake navigation and wait test |

Run `npm test` for deterministic coverage. The [test harness README](../packages/browser-test-extension/README.md) explains how to repeat the live suite. The runner displays each failure and retains no page data after its fixture tab closes.
