import type { BrowserObservation, ElementRef, SemanticElement } from './types.js';
export interface SerializationBudget { maxElements?: number; maxCharacters?: number }
export function serializeObservation(observation: BrowserObservation, budget: SerializationBudget = {}): string {
  const byRef = new Map(observation.elements.map(e => [e.ref, e]));
  const lines = [`URL ${observation.url}`, `VIEWPORT ${observation.viewport.width}x${observation.viewport.height}`, `SCROLL ${observation.scroll.y} / ${observation.scroll.maxY}`];
  let count = 0;
  const maxElements = budget.maxElements ?? Infinity;
  const maxCharacters = budget.maxCharacters ?? Infinity;
  const visit = (ref: ElementRef, depth: number): void => {
    if (count >= maxElements) return;
    const element = byRef.get(ref);
    if (!element) return;
    const line = describe(element, depth);
    if (lines.join('\n').length + line.length + 1 > maxCharacters) return;
    lines.push(line); count++;
    for (const child of element.children) visit(child, depth + 1);
  };
  visit(observation.root, 0);
  const result = lines.join('\n');
  return result.length <= maxCharacters ? result : result.slice(0, maxCharacters);
}
function describe(element: SemanticElement, depth: number): string {
  const ref = element.capabilities.click || element.capabilities.type ? `[${element.ref}] ` : '';
  const role = element.role ?? element.tag;
  const name = element.name ?? element.text ?? '';
  const value = element.value === undefined ? '' : ` value=${element.sensitive ? '[REDACTED]' : JSON.stringify(element.value)}`;
  return `${'  '.repeat(depth)}${ref}${role}${name ? ` ${JSON.stringify(name)}` : ''}${value}`;
}
