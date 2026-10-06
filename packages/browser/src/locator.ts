import { BrowserError } from './errors.js';
import type { ElementRef, ElementTarget, SemanticElement, SemanticLocator } from './types.js';
const isRef = (value: ElementTarget): value is ElementRef => typeof value === 'string';
export function resolveTarget(target: ElementTarget, elements: SemanticElement[]): SemanticElement {
  if (isRef(target)) {
    const found = elements.find(e => e.ref === target);
    if (!found) throw new BrowserError('ELEMENT_STALE', `Element ${target} is no longer in the current observation`, true, target);
    return found;
  }
  const locator = target as SemanticLocator;
  const fields: (keyof SemanticLocator)[] = ['role', 'name', 'label', 'placeholder', 'text', 'testId', 'href'];
  let candidates = elements.filter(e => fields.every(key => !locator[key] || String(key === 'label' ? (e.label ?? e.name ?? '') : (e[key as keyof SemanticElement] ?? '')).toLowerCase() === String(locator[key]).toLowerCase()));
  if (locator.within) {
    const byRef = new Map(elements.map(e => [e.ref, e]));
    candidates = candidates.filter(e => { let parent = e.parent; while (parent) { if (parent === locator.within) return true; parent = byRef.get(parent)?.parent; } return false; });
  }
  candidates.sort((a, b) => Number(b.states.visible) - Number(a.states.visible) || a.ref.localeCompare(b.ref, undefined, { numeric: true }));
  if (!candidates.length) throw new BrowserError('ELEMENT_NOT_FOUND', `No element matched ${JSON.stringify(locator)}`, true);
  if (candidates.length > 1 && candidates[0]?.states.visible === candidates[1]?.states.visible) throw new BrowserError('ELEMENT_AMBIGUOUS', `Multiple elements matched ${JSON.stringify(locator)}`, true);
  return candidates[0]!;
}
