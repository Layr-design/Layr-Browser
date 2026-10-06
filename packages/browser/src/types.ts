export type ElementRef = `e_${number}`;
export type ObservationMode = 'agent' | 'design' | 'experience';
export type ProvenanceMethod = 'native' | 'computed' | 'sampled' | 'inferred' | 'visual';
export interface Provenance { method: ProvenanceMethod; confidence?: number }
export interface Point { x: number; y: number }
export interface Rect extends Point { width: number; height: number }
export interface ScrollState { x: number; y: number; maxX: number; maxY: number; progressX?: number; progressY?: number }
export interface ViewportState { width: number; height: number; deviceScaleFactor?: number }
export interface ElementStates { visible: boolean; enabled: boolean; focused: boolean; focusable: boolean; editable?: boolean; checked?: boolean; selected?: boolean; expanded?: boolean; pressed?: boolean; required?: boolean; readonly?: boolean; busy?: boolean }
export interface InteractionCapabilities { click: boolean; hover: boolean; focus: boolean; type: boolean; select: boolean; drag: boolean; scroll: boolean }
export interface ElementLayout { bounds?: Rect; visibleRatio?: number; position?: 'static' | 'relative' | 'absolute' | 'fixed' | 'sticky'; display?: string; scrollable?: boolean }
export interface ElementFingerprint { tag: string; role?: string; name?: string; text?: string; label?: string; placeholder?: string; inputType?: string; id?: string; testId?: string; href?: string; parentRole?: string; bounds?: Rect }
export interface SemanticElement { ref: ElementRef; frameId?: string; tag: string; role?: string; name?: string; text?: string; value?: string; description?: string; label?: string; placeholder?: string; testId?: string; href?: string; sensitive?: boolean; states: ElementStates; capabilities: InteractionCapabilities; layout?: ElementLayout; parent?: ElementRef; children: ElementRef[]; importance?: number; fingerprint: ElementFingerprint }
export interface BrowserObservation { id: string; revision: number; timestamp: number; url: string; title?: string; viewport: ViewportState; scroll: ScrollState; root: ElementRef; elements: SemanticElement[]; focusedElement?: ElementRef; dialogs?: ElementRef[]; mode: ObservationMode; diff?: PageDiff }
export interface ElementChange { ref: ElementRef; fields: string[] }
export interface PageDiff { urlChanged: boolean; added: ElementRef[]; removed: ElementRef[]; changed: ElementChange[] }
export interface SemanticLocator { role?: string; name?: string; text?: string; label?: string; placeholder?: string; testId?: string; href?: string; within?: ElementRef }
export type ElementTarget = ElementRef | SemanticLocator;
export interface ObserveOptions { mode?: ObservationMode; since?: number; signal?: AbortSignal }
export interface TypeInput { text: string; clear?: boolean; signal?: AbortSignal }
export interface KeyboardInput { key: string; modifiers?: ('Alt' | 'Control' | 'Meta' | 'Shift')[]; signal?: AbortSignal }
export interface ScrollInput { target?: ElementTarget | 'document'; deltaX?: number; deltaY?: number; signal?: AbortSignal }
export interface WaitOptions { timeoutMs?: number; intervalMs?: number; signal?: AbortSignal }
export type WaitCondition = SemanticLocator | { url: string | RegExp } | { text: string };
export interface WaitResult { observation: BrowserObservation; element?: SemanticElement; durationMs: number }
export type BrowserAction = 'click' | 'hover' | 'type' | 'press' | 'scroll' | 'navigate';
export interface ActionResult { success: true; action: BrowserAction; target?: ElementRef; startedAt: number; durationMs: number; beforeRevision: number; afterRevision: number; changes: PageDiff; retryCount: number }
export interface BrowserSession { readonly id: string; readonly createdAt: number; revision: number; status: 'connecting' | 'connected' | 'disconnected' | 'failed' }
export interface BrowserImage { data: Uint8Array; mimeType: string; width?: number; height?: number }
export interface FrameModel { id: string; parent?: string; url: string; owner?: ElementRef }
export interface VirtualizedRegion { ref: ElementRef; visibleRange?: [number, number]; estimatedTotal?: number; direction: 'vertical' | 'horizontal' }
