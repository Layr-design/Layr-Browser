import test from 'node:test';
import assert from 'node:assert/strict';
import { createBrowser, BrowserError, diffObservations, serializeObservation } from '../dist/src/index.js';
import { FakeBrowserDriver } from '../dist/src/fake.js';
import { ElementRegistry } from '../dist/src/elements.js';
import { resolveTarget } from '../dist/src/locator.js';
const box = { x: 10, y: 20, width: 100, height: 40 };
function page() { return { url: 'https://example.test/', title: 'Fixture', viewport: { width: 800, height: 600 }, scroll: { x: 0, y: 0, maxX: 0, maxY: 1000 }, nodes: [
  { node: 'root', tag: 'document' },
  { node: 'nav', parent: 'root', tag: 'nav' },
  { node: 'wrap', parent: 'nav', tag: 'div' },
  { node: 'link', parent: 'wrap', tag: 'a', name: 'Docs', href: '/docs', bounds: box },
  { node: 'main', parent: 'root', tag: 'main' },
  { node: 'heading', parent: 'main', tag: 'h1', text: 'Welcome' },
  { node: 'email', parent: 'main', tag: 'input', name: 'Email', placeholder: 'name@example.com', value: '', bounds: box },
  { node: 'password', parent: 'main', tag: 'input', name: 'Password', inputType: 'password', value: 'topsecret', text: 'topsecret', bounds: box },
  { node: 'button', parent: 'main', tag: 'button', name: 'Continue', bounds: box },
  { node: 'script', parent: 'root', tag: 'script', text: 'secret script' }
] }; }
test('registry assigns refs and reconciles a replaced control', () => {
  const registry = new ElementRegistry(); const first = registry.reconcile(page().nodes.filter(n => n.tag !== 'script'));
  const button = first.elements.find(e => e.name === 'Continue');
  assert.ok(button); assert.equal(registry.resolve(button.ref), button);
  const nodes = page().nodes.filter(n => n.tag !== 'script'); nodes.find(n => n.node === 'button').node = 'button-new';
  const second = registry.reconcile(nodes);
  assert.equal(second.elements.find(e => e.name === 'Continue').ref, button.ref);
  registry.reconcile(nodes.filter(n => n.node !== 'button-new'));
  assert.equal(registry.resolve(button.ref), undefined);
});
test('observation preserves hierarchy, filters wrappers, capabilities, and redacts password', async () => {
  const driver = new FakeBrowserDriver(page()); const browser = await createBrowser({ driver });
  const observation = await browser.observe();
  assert.equal(observation.elements.some(e => e.tag === 'div' || e.tag === 'script'), false);
  const link = observation.elements.find(e => e.name === 'Docs');
  assert.equal(observation.elements.find(e => e.role === 'navigation').children.includes(link.ref), true);
  assert.equal(observation.elements.find(e => e.name === 'Continue').capabilities.click, true);
  assert.ok(observation.elements.find(e => e.name === 'Continue').importance > observation.elements.find(e => e.tag === 'document').importance);
  assert.equal(observation.elements.find(e => e.name === 'Email').capabilities.type, true);
  assert.equal(observation.elements.find(e => e.name === 'Password').value, '[REDACTED]');
  assert.equal(JSON.stringify(observation).includes('topsecret'), false);
  await browser.dispose(); assert.equal(driver.connected, false);
});
test('locator semantics, ambiguity, and not-found errors', async () => {
  const driver = new FakeBrowserDriver(page()); const browser = await createBrowser({ driver }); const observation = await browser.observe();
  assert.equal(resolveTarget({ role: 'button', name: 'Continue' }, observation.elements).name, 'Continue');
  assert.equal(resolveTarget({ label: 'Email' }, observation.elements).name, 'Email');
  assert.equal(resolveTarget({ placeholder: 'name@example.com' }, observation.elements).name, 'Email');
  assert.throws(() => resolveTarget({ name: 'Missing' }, observation.elements), e => e instanceof BrowserError && e.code === 'ELEMENT_NOT_FOUND');
  assert.throws(() => resolveTarget({ role: 'textbox' }, observation.elements), e => e instanceof BrowserError && e.code === 'ELEMENT_AMBIGUOUS');
  await browser.dispose();
});
test('actions serialize, click valid point, revisions and diffs', async () => {
  const driver = new FakeBrowserDriver(page()); const browser = await createBrowser({ driver, stability: { quietWindowMs: 0 } });
  driver.onClick = () => { driver.page.nodes.push({ node: 'dialog', parent: 'root', tag: 'dialog', name: 'Welcome dialog' }); };
  const [typed, clicked] = await Promise.all([browser.type({ label: 'Email' }, { text: 'hello@layr.design' }), browser.click({ role: 'button', name: 'Continue' })]);
  assert.ok(typed.afterRevision < clicked.beforeRevision);
  assert.ok(driver.calls.includes('click:60,40'));
  assert.equal(clicked.changes.added.length, 1);
  assert.equal((await browser.waitFor({ role: 'dialog', name: 'Welcome dialog' })).element.name, 'Welcome dialog');
  const first = await browser.observe();
  driver.page.nodes.find(n => n.node === 'button').enabled = false;
  const second = await browser.observe({ since: first.revision });
  assert.ok(second.diff.changed.some(change => change.fields.includes('states')));
  await assert.rejects(browser.click({ name: 'Continue' }), e => e instanceof BrowserError && e.code === 'ELEMENT_DISABLED');
  await browser.dispose();
});
test('diff tracks removal and serializer limits without driver IDs or password', async () => {
  const driver = new FakeBrowserDriver(page()); const browser = await createBrowser({ driver }); const first = await browser.observe();
  driver.page.nodes = driver.page.nodes.filter(n => n.node !== 'link'); const second = await browser.observe();
  assert.equal(diffObservations(first, second).removed.length, 1);
  const serialized = serializeObservation(first);
  assert.ok(serialized.includes('[e_'));
  assert.equal(serialized.includes('topsecret') || serialized.includes('node:') || serialized.includes('email'), false);
  assert.ok(serializeObservation(first, { maxElements: 3 }).split('\n').length <= 6);
  assert.ok(serializeObservation(first, { maxCharacters: 80 }).length <= 80);
  await browser.dispose();
});
test('stale driver node recovers once after replacement', async () => {
  const driver = new FakeBrowserDriver(page()); const browser = await createBrowser({ driver, stability: { quietWindowMs: 0 } });
  const old = driver.getBoxModel.bind(driver); let failed = false;
  driver.getBoxModel = async node => { if (!failed) { failed = true; driver.page.nodes.find(n => n.node === 'button').node = 'replacement'; throw new BrowserError('ELEMENT_STALE', 'replaced', true); } return old(node); };
  const result = await browser.click({ role: 'button', name: 'Continue' });
  assert.equal(result.retryCount, 1);
  assert.ok(driver.calls.includes('box:replacement'));
  await browser.dispose();
});
test('events omit typed secrets and report action failures', async () => {
  const events = []; const driver = new FakeBrowserDriver(page());
  const browser = await createBrowser({ driver, onEvent: event => events.push(event), stability: { quietWindowMs: 0 } });
  await browser.type({ name: 'Password' }, { text: 'another-secret', clear: true });
  assert.equal(JSON.stringify(events).includes('another-secret'), false);
  driver.page.nodes.find(n => n.node === 'button').enabled = false;
  await assert.rejects(browser.click({ name: 'Continue' }));
  assert.ok(events.some(event => event.type === 'action.failed' && event.errorCode === 'ELEMENT_DISABLED'));
  await assert.rejects(browser.screenshot(), error => error.code === 'UNSUPPORTED_OPERATION');
  await browser.dispose();
});
test('queued aborted action never dispatches input', async () => {
  const driver = new FakeBrowserDriver(page()); const browser = await createBrowser({ driver, stability: { quietWindowMs: 0 } });
  let release; driver.onClick = () => new Promise(resolve => { release = resolve; });
  const first = browser.click({ name: 'Continue' });
  const controller = new AbortController();
  const second = browser.click({ name: 'Continue' }, { signal: controller.signal });
  while (!release) await new Promise(resolve => setTimeout(resolve, 0));
  controller.abort(new Error('cancelled')); release();
  await first; await assert.rejects(second, /cancelled/);
  assert.equal(driver.calls.filter(call => call.startsWith('click:')).length, 1);
  await browser.dispose();
});
test('nested scroll resolves a semantic target to a driver node', async () => {
  const fixture = page(); fixture.nodes.push({ node: 'pane', parent: 'main', tag: 'section', name: 'Results', scrollable: true, bounds: box });
  const driver = new FakeBrowserDriver(fixture); const browser = await createBrowser({ driver, stability: { quietWindowMs: 0 } });
  await browser.scroll({ target: { name: 'Results' }, deltaY: 200 });
  assert.ok(driver.calls.includes('scroll:pane'));
  await browser.dispose();
});
test('hover, keyboard, navigation, and screenshot delegation use one session', async () => {
  const driver = new FakeBrowserDriver(page());
  driver.capabilities.screenshots = true;
  driver.screenshot = async () => ({ mimeType: 'image/png', data: new Uint8Array([1, 2, 3]) });
  const browser = await createBrowser({ driver, stability: { quietWindowMs: 0 } });
  await browser.hover({ role: 'button', name: 'Continue' });
  await browser.press({ key: 'Enter' });
  const destination = 'https://example.test/next';
  const navigation = await browser.navigate(destination);
  assert.ok(navigation.changes.urlChanged);
  assert.equal((await browser.waitFor({ url: destination })).observation.url, destination);
  assert.deepEqual([...((await browser.screenshot()).data)], [1, 2, 3]);
  assert.ok(driver.calls.includes('hover:60,40'));
  assert.ok(driver.calls.includes('press:Enter'));
  await browser.dispose();
});
test('virtualized rows appear and disappear in semantic diffs', async () => {
  const fixture = page(); fixture.nodes.push({ node: 'list', parent: 'main', tag: 'section', role: 'list', name: 'Results' });
  fixture.nodes.push({ node: 'row-0', parent: 'list', tag: 'div', role: 'listitem', text: 'Item 0' });
  const driver = new FakeBrowserDriver(fixture); const browser = await createBrowser({ driver });
  const first = await browser.observe();
  driver.page.nodes = driver.page.nodes.filter(node => node.node !== 'row-0');
  driver.page.nodes.push({ node: 'row-8', parent: 'list', tag: 'div', role: 'listitem', text: 'Item 8' });
  const second = await browser.observe(); const diff = diffObservations(first, second);
  assert.equal(diff.removed.length, 1); assert.equal(diff.added.length, 1);
  await browser.dispose();
});
test('password typed into a misfocused control is redacted from every observation field', async () => {
  const driver = new FakeBrowserDriver(page());
  driver.type = async text => { driver.page.nodes.find(node => node.node === 'email').value = text; };
  const browser = await createBrowser({ driver, stability: { quietWindowMs: 0 } });
  await browser.type({ name: 'Password' }, { text: 'private-value' });
  const observation = await browser.observe();
  assert.equal(JSON.stringify(observation).includes('private-value'), false);
  assert.equal(serializeObservation(observation).includes('private-value'), false);
  assert.equal(observation.elements.find(element => element.name === 'Email').value, '[REDACTED]');
  await browser.dispose();
});
test('password field is sensitive when the driver lacks an input type', async () => {
  const fixture = page(); const password = fixture.nodes.find(node => node.node === 'password'); delete password.inputType;
  const driver = new FakeBrowserDriver(fixture); const browser = await createBrowser({ driver });
  const observation = await browser.observe();
  assert.equal(observation.elements.find(element => element.name === 'Password').value, '[REDACTED]');
  assert.equal(JSON.stringify(observation).includes('topsecret'), false);
  await browser.dispose();
});
test('text wait matches accessible names as well as DOM text', async () => {
  const fixture = page(); fixture.nodes.find(node => node.node === 'button').name = 'Saved';
  const browser = await createBrowser({ driver: new FakeBrowserDriver(fixture) });
  const result = await browser.waitFor({ text: 'Saved' });
  assert.equal(result.element.name, 'Saved');
  await browser.dispose();
});
