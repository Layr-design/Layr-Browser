export class ActionQueue {
  private tail: Promise<unknown> = Promise.resolve();
  enqueue<T>(work: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    const run = this.tail.then(() => { if (signal?.aborted) throw signal.reason; return work(); });
    this.tail = run.catch(() => undefined);
    return run;
  }
}
