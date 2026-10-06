import type { ElementRef } from './types.js';
export type BrowserErrorCode = 'ELEMENT_NOT_FOUND' | 'ELEMENT_AMBIGUOUS' | 'ELEMENT_STALE' | 'ELEMENT_NOT_VISIBLE' | 'ELEMENT_DISABLED' | 'ELEMENT_NOT_INTERACTABLE' | 'FRAME_DETACHED' | 'NAVIGATION_TIMEOUT' | 'ACTION_TIMEOUT' | 'DRIVER_DISCONNECTED' | 'TARGET_CLOSED' | 'UNSUPPORTED_OPERATION';
export class BrowserError extends Error {
  constructor(public readonly code: BrowserErrorCode, message: string, public readonly recoverable: boolean, public readonly target?: ElementRef, public override readonly cause?: unknown) { super(message); this.name = 'BrowserError'; }
}
