import type { BrowserDriver, RawPage } from './driver.js';
import { BrowserError } from './errors.js';
import { ElementRegistry, isRelevant } from './elements.js';
import { resolveTarget } from './locator.js';
import { diffObservations } from './diff.js';
import { ActionQueue } from './queue.js';
import { EventBus, emitChanges } from './events.js';
import { captureScreenshot } from './visual.js';
import { RedactionPolicy } from './redaction.js';
import type { BrowserEvent } from './events.js';
import type { ActionResult, BrowserAction, BrowserImage, BrowserObservation, BrowserSession, ElementRef, ElementTarget, KeyboardInput, ObserveOptions, PageDiff, Point, ScrollInput, SemanticElement, TypeInput, WaitCondition, WaitOptions, WaitResult } from './types.js';
export interface BrowserOptions { driver: BrowserDriver; now?: () => number; stability?: { quietWindowMs?: number; timeoutMs?: number }; onEvent?: (event: BrowserEvent) => void }
export interface Browser {
  readonly session: BrowserSession;
  on(listener: (event: BrowserEvent) => void): () => void;
  observe(options?: ObserveOptions): Promise<BrowserObservation>;
  screenshot(): Promise<BrowserImage>;
  click(target: ElementTarget, options?: { signal?: AbortSignal }): Promise<ActionResult>;
  hover(target: ElementTarget, options?: { signal?: AbortSignal }): Promise<ActionResult>;
  type(target: ElementTarget, input: TypeInput): Promise<ActionResult>;
  press(input: KeyboardInput): Promise<ActionResult>;
  scroll(input: ScrollInput): Promise<ActionResult>;
  navigate(url: string, options?: { signal?: AbortSignal }): Promise<ActionResult>;
  waitFor(condition: WaitCondition, options?: WaitOptions): Promise<WaitResult>;
  dispose(): Promise<void>;
}
let sessionCounter = 0;
export async function createBrowser(options: BrowserOptions): Promise<Browser> {
  const browser = new BrowserImpl(options);
  await browser.connect();
  return browser;
}
class BrowserImpl implements Browser {
  readonly session: BrowserSession;
  private readonly registry = new ElementRegistry();
  private readonly queue = new ActionQueue();
  private readonly bus = new EventBus();
  private readonly redaction = new RedactionPolicy();
  private last?: BrowserObservation;
  private history = new Map<number, BrowserObservation>();
  private disposed = false;
  private lastEventAt = 0;
  private unsubscribe: (() => void) | undefined;
  private readonly now: () => number;
  constructor(private readonly options: BrowserOptions) {
    this.now = options.now ?? Date.now;
    this.session = { id: `s_${++sessionCounter}`, createdAt: this.now(), revision: 0, status: 'connecting' };
    if (options.onEvent) this.bus.on(options.onEvent);
  }
  on(listener: (event: BrowserEvent) => void): () => void { return this.bus.on(listener); }
  async connect(): Promise<void> {
    try { await this.options.driver.connect(); this.session.status = 'connected'; this.bus.emit({ type: 'session.connected', sessionId: this.session.id, timestamp: this.now() }); this.unsubscribe = this.options.driver.subscribe?.(event => { this.lastEventAt = event.timestamp; }); }
    catch (cause) { this.session.status = 'failed'; throw new BrowserError('DRIVER_DISCONNECTED', 'Could not connect browser driver', true, undefined, cause); }
  }
  private assertConnected(): void { if (this.disposed || this.session.status !== 'connected') throw new BrowserError('DRIVER_DISCONNECTED', 'Browser session is disconnected', false); }
  async observe(options: ObserveOptions = {}): Promise<BrowserObservation> {
    this.assertConnected();
    if (options.signal?.aborted) throw options.signal.reason;
    const raw = this.redaction.apply(await this.options.driver.snapshot());
    const observation = this.normalize(raw, options.mode ?? 'agent');
    if (options.since !== undefined) { const previous = this.history.get(options.since); if (previous) observation.diff = diffObservations(previous, observation); }
    this.last = observation;
    this.bus.emit({ type: 'observation.created', observation, timestamp: observation.timestamp });
    this.history.set(observation.revision, observation);
    if (this.history.size > 20) this.history.delete(this.history.keys().next().value!);
    return observation;
  }
  private normalize(raw: RawPage, mode: BrowserObservation['mode']): BrowserObservation {
    const relevant = raw.nodes.filter(isRelevant).map(node => {
      let parent = node.parent;
      while (parent && !raw.nodes.find(candidate => candidate.node === parent && isRelevant(candidate))) parent = raw.nodes.find(candidate => candidate.node === parent)?.parent;
      return { ...node, ...(parent ? { parent } : {}) };
    });
    const { elements, root } = this.registry.reconcile(relevant);
    const revision = ++this.session.revision;
    const observation: BrowserObservation = { id: `o_${this.session.id}_${revision}`, revision, timestamp: this.now(), url: raw.url, viewport: raw.viewport, scroll: raw.scroll, root, elements, mode, ...(raw.title ? { title: raw.title } : {}) };
    const focused = elements.find(e => e.states.focused);
    if (focused) observation.focusedElement = focused.ref;
    const dialogs = elements.filter(e => e.role === 'dialog').map(e => e.ref);
    if (dialogs.length) observation.dialogs = dialogs;
    return observation;
  }
  async screenshot(): Promise<BrowserImage> { this.assertConnected(); return captureScreenshot(this.options.driver); }
  private async current(): Promise<BrowserObservation> { return this.last ?? this.observe(); }
  private async resolve(target: ElementTarget): Promise<SemanticElement> { return resolveTarget(target, (await this.current()).elements); }
  private check(element: SemanticElement, action: BrowserAction): void {
    if (!element.states.visible) throw new BrowserError('ELEMENT_NOT_VISIBLE', `${element.ref} is not visible`, true, element.ref);
    if (!element.states.enabled) throw new BrowserError('ELEMENT_DISABLED', `${element.ref} is disabled`, true, element.ref);
    if (action === 'type' && !element.capabilities.type) throw new BrowserError('ELEMENT_NOT_INTERACTABLE', `${element.ref} is not editable`, false, element.ref);
    if (action === 'click' && !element.capabilities.click) throw new BrowserError('ELEMENT_NOT_INTERACTABLE', `${element.ref} is not clickable`, false, element.ref);
  }
  private async point(ref: ElementRef): Promise<Point> {
    const node = this.registry.driverNode(ref);
    if (!node) throw new BrowserError('ELEMENT_STALE', `${ref} has no current driver node`, true, ref);
    await this.options.driver.scrollIntoView?.(node);
    const box = await this.options.driver.getBoxModel(node);
    if (!box) { const raw = await this.options.driver.snapshot(); if (!raw.nodes.some(candidate => candidate.node === node)) throw new BrowserError('ELEMENT_STALE', `${ref} driver node was replaced`, true, ref); }
    if (!box || box.width <= 0 || box.height <= 0) throw new BrowserError('ELEMENT_NOT_INTERACTABLE', `${ref} has no usable bounds`, true, ref);
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  }
  private async stable(signal?: AbortSignal): Promise<void> {
    const quiet = this.options.stability?.quietWindowMs ?? 30;
    const timeout = this.options.stability?.timeoutMs ?? 1000;
    if (quiet <= 0) return;
    const started = Date.now();
    if (!this.options.driver.subscribe) {
      let previous = '';
      while (Date.now() - started < timeout) {
        if (signal?.aborted) throw signal.reason;
        const page = await this.options.driver.snapshot();
        const signature = JSON.stringify([page.url, page.scroll, page.nodes]);
        if (signature === previous) return;
        previous = signature;
        await new Promise(resolve => setTimeout(resolve, quiet));
      }
      return;
    }
    while (Date.now() - started < timeout && Date.now() - this.lastEventAt < quiet) {
      if (signal?.aborted) throw signal.reason;
      await new Promise(resolve => setTimeout(resolve, Math.min(quiet, 20)));
    }
  }
  private act(action: BrowserAction, target: ElementTarget | undefined, execute: (element?: SemanticElement) => Promise<void>, signal?: AbortSignal): Promise<ActionResult> {
    return this.queue.enqueue(async () => {
      this.assertConnected();
      const startedAt = this.now();
      const startedWall = Date.now();
      this.bus.emit({ type: 'action.started', action, timestamp: startedAt });
      const before = await this.observe();
      let element = target === undefined ? undefined : await this.resolve(target);
      if (element) this.check(element, action);
      let retryCount = 0;
      try { await execute(element); }
      catch (error) {
        if (!element || !(error instanceof BrowserError) || error.code !== 'ELEMENT_STALE') throw error;
        retryCount = 1;
        await this.observe();
        element = await this.resolve(element.ref);
        this.check(element, action);
        await execute(element);
      }
      await this.stable(signal);
      const after = await this.observe();
      const changes: PageDiff = diffObservations(before, after);
      emitChanges(this.bus, changes, this.now());
      const result: ActionResult = { success: true, action, ...(element ? { target: element.ref } : {}), startedAt, durationMs: Date.now() - startedWall, beforeRevision: before.revision, afterRevision: after.revision, changes, retryCount };
      this.bus.emit({ type: 'action.completed', result, timestamp: this.now() });
      return result;
    }, signal).catch((error: unknown) => {
      this.bus.emit({ type: 'action.failed', action, ...(error instanceof BrowserError ? { errorCode: error.code } : {}), timestamp: this.now() });
      throw error;
    });
  }
  click(target: ElementTarget, options: { signal?: AbortSignal } = {}): Promise<ActionResult> { return this.act('click', target, async element => { await this.options.driver.click(await this.point(element!.ref)); }, options.signal); }
  hover(target: ElementTarget, options: { signal?: AbortSignal } = {}): Promise<ActionResult> { return this.act('hover', target, async element => { await this.options.driver.movePointer(await this.point(element!.ref)); }, options.signal); }
  type(target: ElementTarget, input: TypeInput): Promise<ActionResult> { return this.act('type', target, async element => { const node = this.registry.driverNode(element!.ref); if (!node) throw new BrowserError('ELEMENT_STALE', 'Target lost driver node', true, element!.ref); if (element!.sensitive) this.redaction.addSecret(input.text); await this.options.driver.focus(node); await this.options.driver.type(input.text, input.clear === undefined ? undefined : { clear: input.clear }); }, input.signal); }
  press(input: KeyboardInput): Promise<ActionResult> { return this.act('press', undefined, () => this.options.driver.press(input), input.signal); }
  scroll(input: ScrollInput): Promise<ActionResult> {
    const target = input.target && input.target !== 'document' ? input.target : undefined;
    return this.act('scroll', target, async element => {
      const node = element ? this.registry.driverNode(element.ref) : undefined;
      if (element && !node) throw new BrowserError('ELEMENT_STALE', 'Scroll target lost driver node', true, element.ref);
      await this.options.driver.scroll({ ...(node ? { node } : {}), ...(input.deltaX === undefined ? {} : { deltaX: input.deltaX }), ...(input.deltaY === undefined ? {} : { deltaY: input.deltaY }) });
    }, input.signal);
  }
  navigate(url: string, options: { signal?: AbortSignal } = {}): Promise<ActionResult> { return this.act('navigate', undefined, async () => { this.bus.emit({ type: 'navigation.started', url, timestamp: this.now() }); await this.options.driver.navigate(url); this.bus.emit({ type: 'navigation.completed', url, timestamp: this.now() }); }, options.signal); }
  async waitFor(condition: WaitCondition, options: WaitOptions = {}): Promise<WaitResult> {
    const started = Date.now(); const timeout = options.timeoutMs ?? 5000;
    while (Date.now() - started <= timeout) {
      if (options.signal?.aborted) throw options.signal.reason;
      const observation = await this.observe();
      if ('url' in condition && (typeof condition.url === 'string' ? observation.url === condition.url : condition.url.test(observation.url))) return { observation, durationMs: Date.now() - started };
      if ('text' in condition && Object.keys(condition).length === 1) { const element = observation.elements.find(e => e.text?.includes(condition.text!) || e.name?.includes(condition.text!) || e.description?.includes(condition.text!)); if (element) return { observation, element, durationMs: Date.now() - started }; }
      else if (!('url' in condition)) { try { const element = resolveTarget(condition, observation.elements); return { observation, element, durationMs: Date.now() - started }; } catch (error) { if (!(error instanceof BrowserError) || error.code !== 'ELEMENT_NOT_FOUND') throw error; } }
      await new Promise(resolve => setTimeout(resolve, options.intervalMs ?? 50));
    }
    throw new BrowserError('ACTION_TIMEOUT', 'Wait condition timed out', true);
  }
  async dispose(): Promise<void> { if (this.disposed) return; this.disposed = true; this.unsubscribe?.(); await this.options.driver.disconnect(); this.session.status = 'disconnected'; this.bus.emit({ type: 'session.disconnected', sessionId: this.session.id, timestamp: this.now() }); this.bus.clear(); this.redaction.clear(); }
}
