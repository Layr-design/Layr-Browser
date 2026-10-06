import test from 'node:test';
import assert from 'node:assert/strict';
import { CdpBrowserDriver } from '../dist/src/index.js';
import { createBrowser } from '../../browser/dist/src/index.js';
test('CDP driver maps DOM and accessibility and dispatches a click', async () => {
  const calls = [];
  const transport = { async connect() { calls.push('connect'); }, async disconnect() { calls.push('disconnect'); }, async send(method, params) {
    calls.push(method);
    if (method === 'DOM.getDocument') return { root: { nodeName: '#document', nodeType: 9, children: [{ nodeName: 'BUTTON', nodeType: 1, backendNodeId: 7, children: [] }] } };
    if (method === 'Accessibility.getFullAXTree') return { nodes: [{ backendDOMNodeId: 7, role: { value: 'button' }, name: { value: 'Continue' } }] };
    if (method === 'Runtime.evaluate') return { result: { value: { url: 'https://example.test/', title: 'Fixture', width: 800, height: 600, deviceScaleFactor: 1, x: 0, y: 0, maxX: 0, maxY: 0 } } };
    if (method === 'DOM.getBoxModel') { assert.equal(params.backendNodeId, 7); return { model: { border: [10, 20, 110, 20, 110, 60, 10, 60] } }; }
    return {};
  } };
  const browser = await createBrowser({ driver: new CdpBrowserDriver(transport) });
  const observation = await browser.observe();
  assert.equal(observation.elements.find(e => e.role === 'button').name, 'Continue');
  await browser.click({ role: 'button', name: 'Continue' });
  assert.equal(calls.filter(c => c === 'Input.dispatchMouseEvent').length, 3);
  await browser.dispose();
  assert.ok(calls.includes('disconnect'));
});
test('Chrome debugger transport attaches, filters tab events, and detaches', async () => {
  const { ChromeDebuggerTransport } = await import('../dist/src/index.js');
  const calls = []; const listeners = new Set();
  const api = {
    async attach(target, version) { calls.push(`attach:${target.tabId}:${version}`); },
    async detach(target) { calls.push(`detach:${target.tabId}`); },
    async sendCommand(target, method) { calls.push(`send:${target.tabId}:${method}`); return { ok: true }; },
    onEvent: { addListener(listener) { listeners.add(listener); }, removeListener(listener) { listeners.delete(listener); } }
  };
  const transport = new ChromeDebuggerTransport(api, 42); const events = [];
  await transport.connect(); const unsubscribe = transport.subscribe(method => events.push(method));
  for (const listener of listeners) { listener({ tabId: 41 }, 'DOM.childNodeInserted', {}); listener({ tabId: 42 }, 'DOM.childNodeInserted', {}); }
  assert.deepEqual(events, ['DOM.childNodeInserted']);
  await transport.send('DOM.getDocument'); unsubscribe(); await transport.disconnect();
  assert.deepEqual(calls, ['attach:42:1.3', 'send:42:DOM.getDocument', 'detach:42']);
  assert.equal(listeners.size, 0);
});
test('CDP snapshot pierces shadow root, preserves iframe, and never reads password value', async () => {
  const transport = { async connect() {}, async disconnect() {}, async send(method) {
    if (method === 'DOM.getDocument') return { root: { nodeName: '#document', nodeType: 9, children: [
      { nodeName: 'MAIN', nodeType: 1, backendNodeId: 1, children: [
        { nodeName: 'DIV', nodeType: 1, backendNodeId: 2, shadowRoots: [{ nodeName: '#shadow-root', nodeType: 11, children: [{ nodeName: 'BUTTON', nodeType: 1, backendNodeId: 3, children: [{ nodeName: '#text', nodeType: 3, nodeValue: 'Shadow action' }] }] }] },
        { nodeName: 'INPUT', nodeType: 1, backendNodeId: 4, attributes: ['type', 'password', 'value', 'raw-secret'] },
        { nodeName: 'IFRAME', nodeType: 1, backendNodeId: 5, children: [{ nodeName: '#document', nodeType: 9, backendNodeId: 6, frameId: 'frame-1', children: [{ nodeName: 'BUTTON', nodeType: 1, backendNodeId: 7, children: [{ nodeName: '#text', nodeType: 3, nodeValue: 'Inside' }] }] }] }
      ] }
    ] } };
    if (method === 'Accessibility.getFullAXTree') return { nodes: [
      { backendDOMNodeId: 1, role: { value: 'main' } },
      { backendDOMNodeId: 3, role: { value: 'button' }, name: { value: 'Shadow action' } },
      { backendDOMNodeId: 4, role: { value: 'textbox' }, name: { value: 'Password' }, value: { value: 'raw-secret' } },
      { backendDOMNodeId: 5, role: { value: 'iframe' }, name: { value: 'Embedded form' } },
      { backendDOMNodeId: 7, role: { value: 'button' }, name: { value: 'Inside' } }
    ] };
    if (method === 'Runtime.evaluate') return { result: { value: { url: 'https://example.test/', title: 'Fixture', width: 800, height: 600, deviceScaleFactor: 1, x: 0, y: 0, maxX: 0, maxY: 0 } } };
    if (method === 'DOM.getBoxModel') return { model: { border: [0, 0, 100, 0, 100, 40, 0, 40] } };
    return {};
  } };
  const browser = await createBrowser({ driver: new CdpBrowserDriver(transport) });
  const page = await browser.observe();
  assert.ok(page.elements.some(e => e.name === 'Shadow action'));
  assert.ok(page.elements.some(e => e.tag === 'iframe'));
  assert.equal(page.elements.find(e => e.name === 'Inside').frameId, 'frame-1');
  assert.equal(JSON.stringify(page).includes('raw-secret'), false);
  await browser.dispose();
});
test('CDP nested scroll uses target box and screenshot returns PNG bytes', async () => {
  const calls = []; const transport = { async connect() {}, async disconnect() {}, async send(method, params) {
    calls.push([method, params]);
    if (method === 'DOM.getBoxModel') return { model: { border: [10, 20, 110, 20, 110, 60, 10, 60] } };
    if (method === 'Page.captureScreenshot') return { data: 'AQID' };
    return {};
  } };
  const driver = new CdpBrowserDriver(transport);
  await driver.scroll({ node: '7', deltaY: 120 });
  const wheel = calls.find(([method]) => method === 'Input.dispatchMouseEvent')[1];
  assert.deepEqual({ x: wheel.x, y: wheel.y, deltaY: wheel.deltaY }, { x: 60, y: 40, deltaY: 120 });
  const image = await driver.screenshot();
  assert.equal(image.mimeType, 'image/png'); assert.deepEqual([...image.data], [1, 2, 3]);
});
test('closed dialog descendants are hidden while visible ignored text remains', async () => {
  const transport = { async connect() {}, async disconnect() {}, async send(method) {
    if (method === 'DOM.getDocument') return { root: { nodeName: '#document', nodeType: 9, children: [
      { nodeName: 'OUTPUT', nodeType: 1, backendNodeId: 10, children: [{ nodeName: '#text', nodeType: 3, nodeValue: 'Saved' }] },
      { nodeName: 'DIALOG', nodeType: 1, backendNodeId: 11, children: [{ nodeName: 'BUTTON', nodeType: 1, backendNodeId: 12, children: [{ nodeName: '#text', nodeType: 3, nodeValue: 'Hidden action' }] }] }
    ] } };
    if (method === 'Accessibility.getFullAXTree') return { nodes: [{ backendDOMNodeId: 10, ignored: true }, { backendDOMNodeId: 11, ignored: true }, { backendDOMNodeId: 12, ignored: true }] };
    if (method === 'Runtime.evaluate') return { result: { value: { url: 'https://example.test/', title: 'Fixture', width: 800, height: 600, deviceScaleFactor: 1, x: 0, y: 0, maxX: 0, maxY: 0 } } };
    return {};
  } };
  const browser = await createBrowser({ driver: new CdpBrowserDriver(transport) });
  const page = await browser.observe();
  assert.ok(page.elements.some(e => e.text === 'Saved'));
  assert.equal(page.elements.some(e => e.text === 'Hidden action'), false);
  await browser.dispose();
});
test('CDP keyboard dispatch includes platform key codes', async () => {
  const calls = []; const transport = { async connect() {}, async disconnect() {}, async send(method, params) { calls.push([method, params]); return {}; } };
  const driver = new CdpBrowserDriver(transport);
  await driver.press({ key: 'a', modifiers: ['Meta'] });
  await driver.press({ key: 'Backspace' });
  const keys = calls.filter(([method]) => method === 'Input.dispatchKeyEvent').map(([, params]) => params);
  assert.deepEqual(keys.map(key => key.windowsVirtualKeyCode), [65, 65, 8, 8]);
  assert.equal(keys[0].modifiers, 4);
});
test('open dialog uses aria-label when accessibility name is omitted', async () => {
  const transport = { async connect() {}, async disconnect() {}, async send(method) {
    if (method === 'DOM.getDocument') return { root: { nodeName: '#document', nodeType: 9, children: [{ nodeName: 'DIALOG', nodeType: 1, backendNodeId: 20, attributes: ['open', '', 'aria-label', 'Create project'] }] } };
    if (method === 'Accessibility.getFullAXTree') return { nodes: [{ backendDOMNodeId: 20, role: { value: 'dialog' }, ignored: true }] };
    if (method === 'Runtime.evaluate') return { result: { value: { url: 'https://example.test/', title: 'Fixture', width: 800, height: 600, deviceScaleFactor: 1, x: 0, y: 0, maxX: 0, maxY: 0 } } };
    return {};
  } };
  const browser = await createBrowser({ driver: new CdpBrowserDriver(transport) });
  const result = await browser.waitFor({ role: 'dialog', name: 'Create project' }, { timeoutMs: 100 });
  assert.equal(result.element.name, 'Create project');
  await browser.dispose();
});
test('CDP focus verifies the exact target before typing', async () => {
  const calls = []; const transport = { async connect() {}, async disconnect() {}, async send(method, params) {
    calls.push(method);
    if (method === 'DOM.resolveNode') { assert.equal(params.backendNodeId, 7); return { object: { objectId: 'remote-7' } }; }
    if (method === 'Runtime.callFunctionOn') return { result: { value: true } };
    return {};
  } };
  const driver = new CdpBrowserDriver(transport);
  await driver.focus('7');
  assert.deepEqual(calls, ['DOM.focus', 'DOM.resolveNode', 'Runtime.callFunctionOn', 'Runtime.releaseObject']);
});
test('CDP focus rejects a target that did not become active', async () => {
  const transport = { async connect() {}, async disconnect() {}, async send(method) {
    if (method === 'DOM.resolveNode') return { object: { objectId: 'remote-7' } };
    if (method === 'Runtime.callFunctionOn') return { result: { value: false } };
    return {};
  } };
  const driver = new CdpBrowserDriver(transport);
  await assert.rejects(driver.focus('7'), /did not receive focus/);
});
