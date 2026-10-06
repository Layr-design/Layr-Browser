import type { BrowserObservation, ElementChange, PageDiff, SemanticElement } from './types.js';
export function diffObservations(before: BrowserObservation, after: BrowserObservation): PageDiff {
  const old = new Map(before.elements.map(e => [e.ref, e]));
  const next = new Map(after.elements.map(e => [e.ref, e]));
  const added = after.elements.filter(e => !old.has(e.ref)).map(e => e.ref);
  const removed = before.elements.filter(e => !next.has(e.ref)).map(e => e.ref);
  const changed: ElementChange[] = [];
  const fields: (keyof SemanticElement)[] = ['role', 'name', 'text', 'value', 'states', 'layout', 'children'];
  for (const element of after.elements) {
    const prior = old.get(element.ref);
    if (!prior) continue;
    const differing = fields.filter(field => JSON.stringify(prior[field]) !== JSON.stringify(element[field]));
    if (differing.length) changed.push({ ref: element.ref, fields: differing });
  }
  return { urlChanged: before.url !== after.url, added, removed, changed };
}
