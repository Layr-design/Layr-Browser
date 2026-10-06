import type { BrowserDriver, BrowserDriverCapabilities, DriverEvent, DriverScrollInput, RawPage } from './driver.js';
import type { BrowserImage, KeyboardInput, Point, Rect } from './types.js';
export class FakeBrowserDriver implements BrowserDriver {
  readonly capabilities: BrowserDriverCapabilities = { dom: true, accessibility: true, screenshots: false, animationInspection: false, pointer: true, network: false };
  connected = false;
  readonly calls: string[] = [];
  private listeners = new Set<(event: DriverEvent) => void>();
  private focused?: string;
  onClick?: (point: Point) => void | Promise<void>;
  constructor(public page: RawPage) {}
  async connect(): Promise<void> { this.connected = true; this.calls.push('connect'); }
  async disconnect(): Promise<void> { this.connected = false; this.calls.push('disconnect'); }
  async snapshot(): Promise<RawPage> { this.calls.push('snapshot'); return structuredClone(this.page); }
  async getBoxModel(node: string): Promise<Rect | null> { this.calls.push(`box:${node}`); return this.page.nodes.find(n => n.node === node)?.bounds ?? null; }
  async click(point: Point): Promise<void> { this.calls.push(`click:${point.x},${point.y}`); await this.onClick?.(point); }
  async movePointer(point: Point): Promise<void> { this.calls.push(`hover:${point.x},${point.y}`); }
  async focus(node: string): Promise<void> { this.calls.push(`focus:${node}`); this.focused = node; }
  async type(text: string, options?: { clear?: boolean }): Promise<void> { this.calls.push('type'); const node = this.page.nodes.find(n => n.node === this.focused); if (node) node.value = `${options?.clear ? '' : node.value ?? ''}${text}`; this.emit('mutation'); }
  async press(input: KeyboardInput): Promise<void> { this.calls.push(`press:${input.key}`); }
  async scroll(input: DriverScrollInput): Promise<void> { this.calls.push(input.node ? `scroll:${input.node}` : 'scroll'); this.page.scroll.y = Math.max(0, Math.min(this.page.scroll.maxY, this.page.scroll.y + (input.deltaY ?? 0))); this.emit('layout'); }
  async navigate(url: string): Promise<void> { this.calls.push('navigate'); this.page.url = url; this.emit('navigation'); }
  async screenshot(): Promise<BrowserImage> { throw new Error('Fake driver has no screenshots'); }
  subscribe(listener: (event: DriverEvent) => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  emit(type: DriverEvent['type']): void { for (const listener of this.listeners) listener({ type, timestamp: Date.now() }); }
}
