import type { RawNode, RawPage } from './driver.js';

// Values typed into sensitive controls remain in memory only for this session.
// Redacting every raw text field also catches a driver that sent input to the
// wrong focused control before the next observation.
export class RedactionPolicy {
  private readonly secrets = new Set<string>();
  addSecret(value: string): void { if (value) this.secrets.add(value); }
  clear(): void { this.secrets.clear(); }
  apply(page: RawPage): RawPage {
    if (!this.secrets.size) return page;
    const redact = (value: string): string => {
      let result = value;
      for (const secret of this.secrets) {
        if (result === secret) return '[REDACTED]';
        if (secret.length >= 4) result = result.replaceAll(secret, '[REDACTED]');
      }
      return result;
    };
    const fields: (keyof RawNode)[] = ['name', 'text', 'value', 'description', 'label', 'placeholder', 'href', 'id', 'testId'];
    return {
      ...page,
      url: redact(page.url),
      ...(page.title ? { title: redact(page.title) } : {}),
      nodes: page.nodes.map(node => {
        const copy = { ...node };
        for (const field of fields) {
          const value = copy[field];
          if (typeof value === 'string') Object.assign(copy, { [field]: redact(value) });
        }
        return copy;
      })
    };
  }
}
