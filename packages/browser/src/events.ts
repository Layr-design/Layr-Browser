import type { ActionResult, BrowserAction, BrowserObservation, ElementRef, PageDiff } from './types.js';
import type { BrowserErrorCode } from './errors.js';
export type BrowserEvent =
  | { type: 'session.connected' | 'session.disconnected'; sessionId: string; timestamp: number }
  | { type: 'navigation.started' | 'navigation.completed'; url: string; timestamp: number }
  | { type: 'observation.created'; observation: BrowserObservation; timestamp: number }
  | { type: 'element.added' | 'element.removed' | 'element.changed'; ref: ElementRef; timestamp: number }
  | { type: 'action.started'; action: BrowserAction; timestamp: number }
  | { type: 'action.completed'; result: ActionResult; timestamp: number }
  | { type: 'action.failed'; action: BrowserAction; errorCode?: BrowserErrorCode; timestamp: number };
export class EventBus {
  private listeners = new Set<(event: BrowserEvent) => void>();
  on(listener: (event: BrowserEvent) => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  emit(event: BrowserEvent): void { for (const listener of this.listeners) { try { listener(event); } catch { /* Observer failures must not affect browser actions. */ } } }
  clear(): void { this.listeners.clear(); }
}
export function emitChanges(bus: EventBus, diff: PageDiff, timestamp: number): void {
  for (const ref of diff.added) bus.emit({ type: 'element.added', ref, timestamp });
  for (const ref of diff.removed) bus.emit({ type: 'element.removed', ref, timestamp });
  for (const change of diff.changed) bus.emit({ type: 'element.changed', ref: change.ref, timestamp });
}
