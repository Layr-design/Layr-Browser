import type { BrowserImage, KeyboardInput, Point, Rect, ScrollState, ViewportState } from './types.js';
export type DriverNodeRef = string;
export interface RawNode { node: DriverNodeRef; parent?: DriverNodeRef; frameId?: string; tag: string; role?: string; name?: string; text?: string; value?: string; description?: string; label?: string; placeholder?: string; inputType?: string; id?: string; testId?: string; href?: string; bounds?: Rect; visible?: boolean; enabled?: boolean; focused?: boolean; focusable?: boolean; readonly?: boolean; checked?: boolean; expanded?: boolean; scrollable?: boolean; position?: 'static' | 'relative' | 'absolute' | 'fixed' | 'sticky' }
export interface RawPage { url: string; title?: string; viewport: ViewportState; scroll: ScrollState; nodes: RawNode[] }
export interface DriverScrollInput { node?: DriverNodeRef; deltaX?: number; deltaY?: number }
export interface BrowserDriverCapabilities { dom: boolean; accessibility: boolean; screenshots: boolean; animationInspection: boolean; pointer: boolean; network: boolean }
export type DriverEvent = { type: 'navigation' | 'mutation' | 'layout'; timestamp: number };
export interface BrowserDriver {
  readonly capabilities: BrowserDriverCapabilities;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  snapshot(): Promise<RawPage>;
  getBoxModel(node: DriverNodeRef): Promise<Rect | null>;
  scrollIntoView?(node: DriverNodeRef): Promise<void>;
  click(point: Point): Promise<void>;
  movePointer(point: Point): Promise<void>;
  focus(node: DriverNodeRef): Promise<void>;
  type(text: string, options?: { clear?: boolean }): Promise<void>;
  press(input: KeyboardInput): Promise<void>;
  scroll(input: DriverScrollInput): Promise<void>;
  navigate(url: string): Promise<void>;
  screenshot?(): Promise<BrowserImage>;
  subscribe?(listener: (event: DriverEvent) => void): () => void;
}
