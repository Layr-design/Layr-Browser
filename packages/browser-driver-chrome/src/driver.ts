import type { BrowserDriver, BrowserDriverCapabilities, DriverEvent, DriverScrollInput, RawNode, RawPage } from '../../browser/src/driver.js';
import type { BrowserImage, KeyboardInput, Point, Rect } from '../../browser/src/types.js';
import type { CdpTransport } from './transport.js';
type CdpNode = { nodeName: string; nodeType: number; nodeValue?: string; backendNodeId?: number; attributes?: string[]; children?: CdpNode[]; shadowRoots?: CdpNode[]; frameId?: string };
type AxNode = { backendDOMNodeId?: number; role?: { value?: string }; name?: { value?: string }; value?: { value?: string }; description?: { value?: string }; ignored?: boolean; properties?: { name: string; value: { value?: unknown } }[] };
function attributes(node: CdpNode): Record<string, string> { const result: Record<string, string> = {}; const list = node.attributes ?? []; for (let i = 0; i < list.length; i += 2) { const key = list[i]; if (key) result[key] = list[i + 1] ?? ''; } return result; }
function property(node: AxNode | undefined, key: string): unknown { return node?.properties?.find(p => p.name === key)?.value.value; }
export class CdpBrowserDriver implements BrowserDriver {
  readonly capabilities: BrowserDriverCapabilities = { dom: true, accessibility: true, screenshots: true, animationInspection: false, pointer: true, network: false };
  constructor(private readonly transport: CdpTransport) {}
  async connect(): Promise<void> { await this.transport.connect(); await Promise.all([this.transport.send('DOM.enable'), this.transport.send('Page.enable'), this.transport.send('Runtime.enable'), this.transport.send('Accessibility.enable')]); }
  async disconnect(): Promise<void> { await this.transport.disconnect(); }
  subscribe(listener: (event: DriverEvent) => void): () => void { return this.transport.subscribe?.((method) => { const type = method.startsWith('Page.') ? 'navigation' : method.startsWith('DOM.') ? 'mutation' : undefined; if (type) listener({ type, timestamp: Date.now() }); }) ?? (() => {}); }
  async snapshot(): Promise<RawPage> {
    const [dom, ax, metrics] = await Promise.all([
      this.transport.send<{ root: CdpNode }>('DOM.getDocument', { depth: -1, pierce: true }),
      this.transport.send<{ nodes: AxNode[] }>('Accessibility.getFullAXTree'),
      this.evaluate<{ url: string; title: string; width: number; height: number; deviceScaleFactor: number; x: number; y: number; maxX: number; maxY: number }>('({url:location.href,title:document.title,width:innerWidth,height:innerHeight,deviceScaleFactor:devicePixelRatio,x:scrollX,y:scrollY,maxX:Math.max(0,document.documentElement.scrollWidth-innerWidth),maxY:Math.max(0,document.documentElement.scrollHeight-innerHeight)})')
    ]);
    const axByNode = new Map(ax.nodes.filter(n => n.backendDOMNodeId).map(n => [n.backendDOMNodeId!, n]));
    const nodes: RawNode[] = [];
    const visit = (node: CdpNode, parent?: string, frameId?: string, inheritedHidden = false): void => {
      if (node.nodeType === 11) { for (const child of node.children ?? []) visit(child, parent, frameId, inheritedHidden); return; }
      if (node.nodeType !== 9 && node.nodeType !== 1) return;
      const ref = String(node.backendNodeId ?? `document-${nodes.length}`);
      const tag = node.nodeType === 9 ? 'document' : node.nodeName.toLowerCase();
      const attrs = attributes(node); const accessibility = axByNode.get(node.backendNodeId ?? -1);
      const role = node.nodeType === 9 || accessibility?.ignored ? undefined : accessibility?.role?.value;
      const name = node.nodeType === 9 ? undefined : (accessibility?.ignored ? undefined : accessibility?.name?.value) ?? attrs['aria-label'] ?? attrs['title'];
      const inputType = attrs['type'];
      const text = (node.children ?? []).filter(child => child.nodeType === 3).map(child => child.nodeValue ?? '').join('').trim();
      const value = inputType === 'password' ? undefined : accessibility?.value?.value;
      const hidden = inheritedHidden || attrs['hidden'] !== undefined || attrs['aria-hidden'] === 'true' || (tag === 'dialog' && attrs['open'] === undefined) || /display\s*:\s*none|visibility\s*:\s*hidden/i.test(attrs['style'] ?? '');
      const visible = !hidden;
      const raw: RawNode = { node: ref, tag, ...(parent ? { parent } : {}), ...((node.frameId ?? frameId) ? { frameId: (node.frameId ?? frameId)! } : {}), ...(role ? { role } : {}), ...(name ? { name } : {}), ...(text && inputType !== 'password' ? { text } : {}), ...(accessibility?.description?.value ? { description: accessibility.description.value } : {}), ...(attrs['aria-label'] ? { label: attrs['aria-label'] } : {}), ...(attrs['placeholder'] ? { placeholder: attrs['placeholder'] } : {}), ...(inputType ? { inputType } : {}), ...(value !== undefined ? { value } : {}), ...(!visible ? { visible: false } : {}), ...(attrs['id'] ? { id: attrs['id'] } : {}), ...(attrs['data-testid'] ? { testId: attrs['data-testid'] } : {}), ...(attrs['href'] ? { href: attrs['href'] } : {}), ...(attrs['disabled'] !== undefined ? { enabled: false } : {}), ...(attrs['readonly'] !== undefined ? { readonly: true } : {}), ...(typeof property(accessibility, 'focused') === 'boolean' ? { focused: property(accessibility, 'focused') as boolean } : {}), ...(typeof property(accessibility, 'checked') === 'boolean' ? { checked: property(accessibility, 'checked') as boolean } : {}), ...(typeof property(accessibility, 'expanded') === 'boolean' ? { expanded: property(accessibility, 'expanded') as boolean } : {}) };
      nodes.push(raw);
      for (const child of [...(node.children ?? []), ...(node.shadowRoots ?? [])]) visit(child, ref, node.frameId ?? frameId, hidden);
    };
    visit(dom.root);
    return { url: metrics.url, title: metrics.title, viewport: { width: metrics.width, height: metrics.height, deviceScaleFactor: metrics.deviceScaleFactor }, scroll: { x: metrics.x, y: metrics.y, maxX: metrics.maxX, maxY: metrics.maxY }, nodes };
  }
  async scrollIntoView(node: string): Promise<void> { try { await this.transport.send('DOM.scrollIntoViewIfNeeded', { backendNodeId: Number(node) }); } catch { /* Box lookup classifies stale or non-interactable nodes. */ } }
  async getBoxModel(node: string): Promise<Rect | null> {
    const id = Number(node); if (!Number.isFinite(id)) return null;
    try { const result = await this.transport.send<{ model: { border: number[] } }>('DOM.getBoxModel', { backendNodeId: id }); const p = result.model.border; if (p.length < 8) return null; const xs = [p[0]!, p[2]!, p[4]!, p[6]!]; const ys = [p[1]!, p[3]!, p[5]!, p[7]!]; const x = Math.min(...xs), y = Math.min(...ys); return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y }; } catch { return null; }
  }
  async click(point: Point): Promise<void> { await this.transport.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: point.x, y: point.y }); await this.transport.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: point.x, y: point.y, button: 'left', clickCount: 1 }); await this.transport.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: point.x, y: point.y, button: 'left', clickCount: 1 }); }
  async movePointer(point: Point): Promise<void> { await this.transport.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: point.x, y: point.y }); }
  async focus(node: string): Promise<void> {
    const backendNodeId = Number(node);
    await this.transport.send('DOM.focus', { backendNodeId });
    const resolved = await this.transport.send<{ object: { objectId?: string } }>('DOM.resolveNode', { backendNodeId });
    const objectId = resolved.object.objectId;
    if (!objectId) throw new Error('Focused node could not be resolved');
    try {
      const check = await this.transport.send<{ result: { value?: boolean }; exceptionDetails?: unknown }>('Runtime.callFunctionOn', {
        objectId,
        functionDeclaration: 'function() { this.focus(); return this.getRootNode().activeElement === this; }',
        returnByValue: true,
        userGesture: true
      });
      if (check.exceptionDetails || check.result.value !== true) throw new Error('Target did not receive focus');
    } finally {
      await this.transport.send('Runtime.releaseObject', { objectId }).catch(() => {});
    }
  }
  async type(text: string, options?: { clear?: boolean }): Promise<void> { if (options?.clear) { const platform = await this.evaluate<string>('navigator.platform'); await this.press({ key: 'a', modifiers: [platform.includes('Mac') ? 'Meta' : 'Control'] }); await this.press({ key: 'Backspace' }); } await this.transport.send('Input.insertText', { text }); }
  async press(input: KeyboardInput): Promise<void> {
    const modifiers = (input.modifiers ?? []).reduce((value, modifier) => value | ({ Alt: 1, Control: 2, Meta: 4, Shift: 8 }[modifier]), 0);
    const key = input.key;
    const code = key.length === 1 && /[a-z]/i.test(key) ? `Key${key.toUpperCase()}` : key;
    const windowsVirtualKeyCode = key.length === 1 ? key.toUpperCase().charCodeAt(0) : ({ Backspace: 8, Tab: 9, Enter: 13, Escape: 27, ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40 } as Record<string, number>)[key];
    const params = { key, code, modifiers, ...(windowsVirtualKeyCode ? { windowsVirtualKeyCode } : {}) };
    await this.transport.send('Input.dispatchKeyEvent', { type: 'keyDown', ...params });
    await this.transport.send('Input.dispatchKeyEvent', { type: 'keyUp', ...params });
  }
  async scroll(input: DriverScrollInput): Promise<void> {
    const box = input.node ? await this.getBoxModel(input.node) : null;
    if (input.node && !box) throw new Error('Scroll target has no box model');
    const point = box ? { x: box.x + box.width / 2, y: box.y + box.height / 2 } : await this.evaluate<{ x: number; y: number }>('({x:innerWidth/2,y:innerHeight/2})');
    await this.transport.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: point.x, y: point.y, deltaX: input.deltaX ?? 0, deltaY: input.deltaY ?? 0 });
  }
  async navigate(url: string): Promise<void> {
    let finish: (() => void) | undefined;
    const loaded = this.transport.subscribe ? new Promise<void>(resolve => {
      const unsubscribe = this.transport.subscribe!((method) => { if (method === 'Page.loadEventFired') { clearTimeout(timer); unsubscribe(); resolve(); } });
      const timer = setTimeout(() => { unsubscribe(); resolve(); }, 5000);
      finish = () => { clearTimeout(timer); unsubscribe(); resolve(); };
    }) : undefined;
    try { await this.transport.send('Page.navigate', { url }); }
    catch (error) { finish?.(); throw error; }
    await loaded;
  }
  async screenshot(): Promise<BrowserImage> { const result = await this.transport.send<{ data: string }>('Page.captureScreenshot', { format: 'png' }); return { mimeType: 'image/png', data: Uint8Array.from(atob(result.data), c => c.charCodeAt(0)) }; }
  private async evaluate<T>(expression: string): Promise<T> { const result = await this.transport.send<{ result: { value?: T }; exceptionDetails?: unknown }>('Runtime.evaluate', { expression, returnByValue: true }); if (result.exceptionDetails || result.result.value === undefined) throw new Error('CDP Runtime.evaluate failed'); return result.result.value; }
}
