import type { RawNode } from './driver.js';
import type { ElementFingerprint, ElementRef, SemanticElement } from './types.js';

const semanticTags = new Set(['document', 'main', 'nav', 'header', 'footer', 'section', 'form', 'button', 'input', 'textarea', 'select', 'a', 'iframe', 'dialog', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li']);
export const IMPORTANCE_WEIGHTS = { interactive: 8, focused: 6, named: 4, heading: 4, visible: 2, inViewport: 2, hidden: -20 } as const;
const excludedTags = new Set(['script', 'style', 'noscript', 'path', 'defs', 'meta', 'link']);
const roleByTag: Record<string, string> = { a: 'link', iframe: 'iframe', button: 'button', input: 'textbox', textarea: 'textbox', select: 'combobox', nav: 'navigation', main: 'main', dialog: 'dialog', form: 'form', h1: 'heading', h2: 'heading', h3: 'heading', h4: 'heading', h5: 'heading', h6: 'heading' };
export function roleOf(node: RawNode): string | undefined { return node.role ?? roleByTag[node.tag.toLowerCase()]; }
export function fingerprint(node: RawNode, parentRole?: string): ElementFingerprint {
  const result: ElementFingerprint = { tag: node.tag.toLowerCase() };
  const values = { role: roleOf(node), name: node.name, text: node.text, label: node.label, placeholder: node.placeholder, inputType: node.inputType, id: node.id, testId: node.testId, href: node.href, parentRole, bounds: node.bounds };
  for (const [key, value] of Object.entries(values)) if (value !== undefined) Object.assign(result, { [key]: value });
  return result;
}
export function similarity(a: ElementFingerprint, b: ElementFingerprint): number {
  if (a.tag !== b.tag || (a.role && b.role && a.role !== b.role)) return 0;
  let score = 2;
  for (const [key, weight] of [['role', 3], ['name', 6], ['label', 5], ['placeholder', 4], ['testId', 6], ['href', 4], ['id', 3], ['text', 2], ['parentRole', 2]] as const) {
    if (a[key] && b[key]) score += a[key] === b[key] ? weight : -weight;
  }
  if (a.bounds && b.bounds) { const distance = Math.hypot(a.bounds.x - b.bounds.x, a.bounds.y - b.bounds.y); if (distance < 100) score += 2; }
  return score;
}
export function isRelevant(node: RawNode): boolean {
  const tag = node.tag.toLowerCase();
  if (excludedTags.has(tag) || node.visible === false || ['presentation', 'none'].includes(node.role ?? '')) return false;
  return tag === 'document' || !!node.role || semanticTags.has(tag) || !!node.name || !!node.text?.trim();
}
export function importance(element: SemanticElement): number {
  let score = 0;
  if (element.capabilities.click || element.capabilities.type) score += IMPORTANCE_WEIGHTS.interactive;
  if (element.states.focused) score += IMPORTANCE_WEIGHTS.focused;
  if (element.name) score += IMPORTANCE_WEIGHTS.named;
  if (element.role === 'heading') score += IMPORTANCE_WEIGHTS.heading;
  if (element.states.visible) score += IMPORTANCE_WEIGHTS.visible;
  if (element.layout?.visibleRatio && element.layout.visibleRatio > 0) score += IMPORTANCE_WEIGHTS.inViewport;
  if (!element.states.visible) score += IMPORTANCE_WEIGHTS.hidden;
  return score;
}
export class ElementRegistry {
  private next = 1;
  private current = new Map<ElementRef, SemanticElement>();
  private nodes = new Map<ElementRef, string>();
  resolve(ref: ElementRef): SemanticElement | undefined { return this.current.get(ref); }
  driverNode(ref: ElementRef): string | undefined { return this.nodes.get(ref); }
  invalidate(ref: ElementRef): void { this.current.delete(ref); this.nodes.delete(ref); }
  reconcile(nodes: RawNode[]): { elements: SemanticElement[]; root: ElementRef } {
    const previous = [...this.current.values()];
    const oldNodes = new Map(this.nodes);
    const used = new Set<ElementRef>();
    const rawToRef = new Map<string, ElementRef>();
    const elements: SemanticElement[] = [];
    for (const raw of nodes) {
      const parentRaw = nodes.find(n => n.node === raw.parent);
      const sensitive = raw.inputType?.toLowerCase() === 'password' || (raw.tag.toLowerCase() === 'input' && /password|passcode/i.test([raw.name, raw.label, raw.placeholder, raw.id].filter(Boolean).join(' ')));
      const fp = fingerprint(sensitive ? { ...raw, text: '' } : raw, parentRaw && roleOf(parentRaw));
      const exact = [...oldNodes].find(([ref, node]) => node === raw.node && !used.has(ref) && this.current.get(ref)?.frameId === raw.frameId);
      const candidates = previous.filter(e => !used.has(e.ref) && e.frameId === raw.frameId).map(e => ({ e, score: similarity(e.fingerprint, fp) })).sort((a, b) => b.score - a.score || a.e.ref.localeCompare(b.e.ref));
      // React can replace a node while leaving the user-facing control intact.
      const ref = exact?.[0] ?? (candidates[0] && candidates[0].score >= 8 && candidates[0].score - (candidates[1]?.score ?? -Infinity) >= 2 ? candidates[0].e.ref : `e_${this.next++}` as ElementRef);
      used.add(ref); rawToRef.set(raw.node, ref);
      const tag = raw.tag.toLowerCase();
      const role = roleOf(raw);
      const visible = raw.visible !== false;
      const enabled = raw.enabled !== false;
      const editable = (tag === 'input' || tag === 'textarea' || raw.role === 'textbox') && raw.readonly !== true;
      const clickable = ['button', 'link', 'checkbox', 'radio', 'option', 'menuitem', 'tab'].includes(role ?? '') || tag === 'button';
      const element: SemanticElement = { ref, tag, states: { visible, enabled, focused: raw.focused === true, focusable: raw.focusable === true || clickable || editable, editable, ...(raw.checked === undefined ? {} : { checked: raw.checked }), ...(raw.expanded === undefined ? {} : { expanded: raw.expanded }), ...(raw.readonly === undefined ? {} : { readonly: raw.readonly }) }, capabilities: { click: clickable, hover: visible, focus: clickable || editable, type: editable, select: tag === 'select', drag: false, scroll: raw.scrollable === true }, children: [], fingerprint: fp, ...(role ? { role } : {}), ...(raw.name ? { name: raw.name } : {}), ...(raw.text && !sensitive ? { text: raw.text } : {}), ...(raw.description ? { description: raw.description } : {}), ...(raw.label ? { label: raw.label } : {}), ...(raw.placeholder ? { placeholder: raw.placeholder } : {}), ...(raw.testId ? { testId: raw.testId } : {}), ...(raw.href ? { href: raw.href } : {}), ...(raw.frameId ? { frameId: raw.frameId } : {}), ...(sensitive ? { sensitive, value: '[REDACTED]' } : raw.value === undefined ? {} : { value: raw.value }), ...(raw.bounds || raw.scrollable || raw.position ? { layout: { ...(raw.bounds ? { bounds: raw.bounds } : {}), ...(raw.scrollable === undefined ? {} : { scrollable: raw.scrollable }), ...(raw.position ? { position: raw.position } : {}) } } : {}) };
      element.importance = importance(element);
      elements.push(element);
    }
    for (const [index, raw] of nodes.entries()) {
      const child = elements[index];
      if (!child) continue;
      let parent = raw.parent;
      while (parent && !rawToRef.has(parent)) parent = nodes.find(n => n.node === parent)?.parent;
      if (parent) { const parentRef = rawToRef.get(parent); const parentElement = elements.find(e => e.ref === parentRef); if (parentRef && parentElement) { child.parent = parentRef; parentElement.children.push(child.ref); } }
    }
    this.current.clear(); this.nodes.clear();
    for (let index = 0; index < elements.length; index++) { const element = elements[index]; const raw = nodes[index]; if (element && raw) { this.current.set(element.ref, element); this.nodes.set(element.ref, raw.node); } }
    const root = elements.find(e => e.tag === 'document' && !e.parent)?.ref ?? elements.find(e => !e.parent)?.ref;
    if (!root) throw new Error('Driver returned no root document');
    return { elements, root };
  }
}
