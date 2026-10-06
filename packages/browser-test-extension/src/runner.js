import { createBrowser, BrowserError, serializeObservation } from './vendor/browser/index.js';
import { CdpBrowserDriver, ChromeDebuggerTransport } from './vendor/chrome/index.js';
const baseInput = document.getElementById('base');
const runButton = document.getElementById('run');
const results = document.getElementById('results');
const summary = document.getElementById('summary');
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const evaluate = async (transport, expression) => {
  const response = await transport.send('Runtime.evaluate', { expression, returnByValue: true });
  if (response.exceptionDetails) throw new Error('Fixture evaluation failed');
  return response.result?.value;
};
const waitTab = async tabId => {
  const tab = await chrome.tabs.get(tabId);
  if (tab.status === 'complete') return;
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { chrome.tabs.onUpdated.removeListener(listener); reject(new Error('Tab load timed out')); }, 10000);
    const listener = (updatedId, info) => { if (updatedId === tabId && info.status === 'complete') { clearTimeout(timeout); chrome.tabs.onUpdated.removeListener(listener); resolve(); } };
    chrome.tabs.onUpdated.addListener(listener);
  });
};
const withFixture = async (name, work) => {
  const url = `${baseInput.value.replace(/\/$/, '')}/${name}.html`;
  const tab = await chrome.tabs.create({ url, active: false });
  let browser;
  try {
    await waitTab(tab.id);
    const transport = new ChromeDebuggerTransport(chrome.debugger, tab.id);
    browser = await createBrowser({ driver: new CdpBrowserDriver(transport) });
    const first = await browser.observe();
    assert(first.url.includes(`${name}.html`), `Unexpected URL: ${first.url}`);
    return await work({ browser, transport, first, tab });
  } finally {
    await browser?.dispose();
    await chrome.tabs.remove(tab.id).catch(() => {});
  }
};
const cases = [
  ['basic form, input, keyboard, redaction', 'basic-form', async ({ browser, transport }) => {
    await browser.type({ label: 'Email' }, { text: 'hello@layr.design', clear: true });
    await browser.press({ key: 'Tab' });
    await browser.type({ name: 'Password' }, { text: 'private-value', clear: true });
    const fieldValues = await evaluate(transport, "({email:document.getElementById('email').value,password:document.getElementById('password').value})");
    assert(fieldValues.email === 'hello@layr.design' && fieldValues.password === 'private-value', 'Typing reached the wrong input');
    const observed = await browser.observe();
    assert(observed.elements.find(e => e.name === 'Password')?.value === '[REDACTED]', 'Password value not redacted');
    assert(!serializeObservation(observed).includes('private-value'), 'Serialized password leaked');
    await browser.click({ role: 'button', name: 'Continue' });
    await browser.waitFor({ text: 'Submitted' });
    await browser.hover({ role: 'button', name: 'Hover target' });
    await browser.waitFor({ text: 'Hovered' });
    let disabled = false;
    try { await browser.click({ role: 'button', name: 'Disabled action' }); } catch (error) { disabled = error instanceof BrowserError && error.code === 'ELEMENT_DISABLED'; }
    assert(disabled, 'Disabled action did not return typed error');
    return 'Typed, pressed, clicked, hovered, and redacted';
  }],
  ['stable ref after rerender', 'react-rerender', async ({ browser, transport, first }) => {
    const save = first.elements.find(e => e.role === 'button' && e.name === 'Save');
    assert(save, 'Save button missing');
    await browser.click({ role: 'button', name: 'Replace' });
    const next = await browser.observe({ since: first.revision });
    assert(next.elements.find(e => e.role === 'button' && e.name === 'Save')?.ref === save.ref, 'Save ref changed');
    await browser.click(save.ref);
    assert((await evaluate(transport, "document.getElementById('result').textContent")) === 'Saved', 'Save click did not update the page');
    await browser.waitFor({ text: 'Saved' });
    return `Preserved ${save.ref} across DOM replacement`;
  }],
  ['modal', 'modal', async ({ browser, transport }) => {
    await browser.click({ role: 'button', name: 'Open dialog' });
    assert(await evaluate(transport, 'document.querySelector("dialog").open'), 'Open click did not open the native dialog');
    await browser.waitFor({ role: 'dialog', name: 'Create project' });
    await browser.type({ label: 'Project name' }, { text: 'Alpha' });
    assert((await evaluate(transport, "document.getElementById('project').value")) === 'Alpha', 'Project typing reached the wrong input');
    await browser.click({ role: 'button', name: 'Create' });
    await browser.waitFor({ text: 'Created Alpha' });
    return 'Opened, filled, submitted, and closed dialog';
  }],
  ['nested scroll', 'nested-scroll', async ({ browser, transport }) => {
    await browser.scroll({ target: { name: 'Results' }, deltaY: 180 });
    await delay(150);
    const y = await evaluate(transport, "document.getElementById('feed').scrollTop");
    assert(y > 0, 'Nested container did not scroll');
    return `Nested scrollTop ${y}`;
  }],
  ['sticky', 'sticky', async ({ browser, transport }) => {
    const position = await evaluate(transport, "getComputedStyle(document.querySelector('.sticky')).position");
    assert(position === 'sticky', 'Sticky CSS missing');
    await browser.scroll({ target: 'document', deltaY: 600 });
    await delay(150);
    const y = await evaluate(transport, 'scrollY');
    assert(y > 0, 'Document did not scroll');
    const image = await browser.screenshot();
    assert(image.mimeType === 'image/png' && image.data.length > 0, 'Screenshot missing');
    return `Scrolled ${y}px and captured PNG`;
  }],
  ['CSS parallax fixture', 'parallax-css', async ({ browser, transport }) => {
    const attachment = await evaluate(transport, "getComputedStyle(document.querySelector('.scene')).backgroundAttachment");
    assert(attachment === 'fixed', 'Fixed background missing');
    await browser.scroll({ deltaY: 450 });
    await delay(150);
    assert((await browser.observe()).scroll.y > 0, 'Page did not scroll');
    return 'Fixed background and scroll observed';
  }],
  ['JS parallax fixture', 'parallax-js', async ({ browser, transport }) => {
    await browser.scroll({ deltaY: 450 });
    await delay(150);
    const transform = await evaluate(transport, "getComputedStyle(document.getElementById('actor')).transform");
    assert(transform && transform !== 'none', 'Script transform missing');
    return `Transform ${transform}`;
  }],
  ['CSS animation fixture', 'css-animation', async ({ browser, transport }) => {
    assert((await evaluate(transport, 'document.getAnimations().length')) > 0, 'CSS animation missing');
    assert((await browser.screenshot()).data.length > 0, 'Screenshot missing');
    return 'Native animation active; screenshot captured';
  }],
  ['Web Animation fixture', 'web-animation', async ({ browser, transport }) => {
    assert((await evaluate(transport, 'document.getAnimations().length')) > 0, 'Web Animation missing');
    assert((await browser.screenshot()).data.length > 0, 'Screenshot missing');
    return 'Web Animation active; screenshot captured';
  }],
  ['shadow DOM', 'shadow-dom', async ({ browser }) => {
    await browser.click({ role: 'button', name: 'Shadow action' });
    await browser.waitFor({ text: 'Shadow clicked' });
    return 'Shadow button observed and clicked';
  }],
  ['iframe observation', 'iframe', async ({ browser }) => {
    const page = await browser.observe();
    assert(page.elements.some(e => e.tag === 'iframe'), 'Iframe owner missing');
    return 'Iframe owner observed; cross-frame action remains future work';
  }],
  ['virtual list', 'virtual-list', async ({ browser, transport }) => {
    const before = await browser.observe();
    await browser.scroll({ target: { name: 'Virtual results' }, deltaY: 320 });
    await delay(150);
    const first = await evaluate(transport, "document.querySelector('#spacer .row')?.textContent");
    assert(first && first !== 'Item 0', 'Visible range did not change');
    const after = await browser.observe();
    assert(after.revision > before.revision, 'Observation did not advance');
    return `Rendered ${first}`;
  }],
  ['navigation', 'basic-form', async ({ browser, transport }) => {
    const destination = `${baseInput.value.replace(/\/$/, '')}/modal.html`;
    const result = await browser.navigate(destination);
    assert(result.success, 'Navigation action failed');
    const page = await browser.waitFor({ url: destination });
    assert(page.observation.url === destination, 'Navigation URL mismatch');
    return 'Navigated to modal fixture';
  }]
];
async function run() {
  runButton.disabled = true; results.replaceChildren(); summary.textContent = 'Running…';
  let passed = 0;
  for (const [title, fixture, work] of cases) {
    const row = results.insertRow(); row.insertCell().textContent = title;
    const status = row.insertCell(); status.textContent = 'Running'; status.className = 'running';
    const details = row.insertCell();
    try { details.textContent = await withFixture(fixture, work); status.textContent = 'Pass'; status.className = 'pass'; passed++; }
    catch (error) { status.textContent = 'Fail'; status.className = 'fail'; details.textContent = error instanceof Error ? error.message : String(error); }
    summary.textContent = `${passed}/${cases.length} passed`;
  }
  runButton.disabled = false;
}
runButton.addEventListener('click', run);
