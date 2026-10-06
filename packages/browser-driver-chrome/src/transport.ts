export interface CdpTransport {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  send<T = unknown>(method: string, params?: Record<string, unknown>): Promise<T>;
  subscribe?(listener: (method: string, params: unknown) => void): () => void;
}
export interface ChromeDebuggerApi {
  attach(target: { tabId: number }, version: string): Promise<void>;
  detach(target: { tabId: number }): Promise<void>;
  sendCommand(target: { tabId: number }, method: string, params?: Record<string, unknown>): Promise<unknown>;
  onEvent: { addListener(listener: (source: { tabId?: number }, method: string, params: unknown) => void): void; removeListener(listener: (source: { tabId?: number }, method: string, params: unknown) => void): void };
}
export class ChromeDebuggerTransport implements CdpTransport {
  private readonly target: { tabId: number };
  private readonly listeners = new Set<(method: string, params: unknown) => void>();
  private connected = false;
  private readonly onEvent = (source: { tabId?: number }, method: string, params: unknown): void => {
    if (source.tabId === this.target.tabId) for (const listener of this.listeners) listener(method, params);
  };
  constructor(private readonly debuggerApi: ChromeDebuggerApi, tabId: number) { this.target = { tabId }; }
  async connect(): Promise<void> { if (this.connected) return; await this.debuggerApi.attach(this.target, '1.3'); this.debuggerApi.onEvent.addListener(this.onEvent); this.connected = true; }
  async disconnect(): Promise<void> { if (!this.connected) return; this.debuggerApi.onEvent.removeListener(this.onEvent); await this.debuggerApi.detach(this.target); this.connected = false; }
  async send<T = unknown>(method: string, params?: Record<string, unknown>): Promise<T> { return await this.debuggerApi.sendCommand(this.target, method, params) as T; }
  subscribe(listener: (method: string, params: unknown) => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }
}
