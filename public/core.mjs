export const MAX_BYTES = 100_000_000;
export const A4 = [595.28, 841.89];
export const LETTER = [612, 792];

export function parseRange(text, count) {
  if (!text.trim()) throw new Error('Enter page numbers, for example 1–3, 5.');
  const selected = new Set();
  for (const part of text.replaceAll('–', '-').split(',')) {
    const match = part.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (!match) throw new Error('Use page numbers and ranges, for example 1–3, 5.');
    const first = Number(match[1]), last = Number(match[2] || match[1]);
    if (first < 1 || last > count || first > last) throw new Error(`Choose pages between 1 and ${count}, with each range in ascending order.`);
    for (let n = first; n <= last; n++) selected.add(n - 1);
  }
  return [...selected].sort((a, b) => a - b);
}
export function pageDimensions(size, orientation, reference) {
  const dimensions = size === 'letter' ? LETTER : size === 'match' && reference ? [reference.width, reference.height] : A4;
  const [short, long] = [...dimensions].sort((a, b) => a - b);
  return orientation === 'landscape' ? [long, short] : [short, long];
}
export function movePages(pages, ids, target, after = false) {
  const chosen = new Set(ids);
  if (chosen.has(target)) throw new Error('Choose a destination outside the selected pages.');
  const moving = pages.filter(page => chosen.has(page.id));
  const remaining = pages.filter(page => !chosen.has(page.id));
  let at = target === 'end' ? remaining.length : remaining.findIndex(page => page.id === target);
  if (at < 0) throw new Error('That destination page is no longer available.');
  if (target !== 'end' && after) at++;
  return [...remaining.slice(0, at), ...moving, ...remaining.slice(at)];
}
export function insertAt(pages, incoming, position, active) {
  const index = pages.findIndex(page => page.id === active);
  const at = position === 'end' || index < 0 ? pages.length : index + (position === 'after' ? 1 : 0);
  return [...pages.slice(0, at), ...incoming, ...pages.slice(at)];
}
export function safeFilename(text) {
  const name = text.trim().replace(/[<>:"/\\|?*\x00-\x1f]/g, '-').replace(/[. ]+$/g, '').replace(/\.pdf$/i, '').replace(/[. ]+$/g, '');
  if (!name || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name)) throw new Error('Choose a descriptive filename, for example document-edited.pdf.');
  if (name.length > 180) throw new Error('Use a filename shorter than 180 characters.');
  return name + '.pdf';
}
export class History {
  constructor() { this.reset(); }
  reset() { this.pages = []; this.selected = new Set(); this.active = null; this.anchor = null; this.past = []; this.future = []; this.saved = '[]'; }
  get signature() { return JSON.stringify(this.pages); }
  get dirty() { return this.signature !== this.saved; }
  snapshot() { return { pages: this.pages, selected: [...this.selected], active: this.active, anchor: this.anchor }; }
  apply(snapshot) { this.pages = snapshot.pages; this.selected = new Set(snapshot.selected); this.active = snapshot.active; this.anchor = snapshot.anchor; this.normalize(); }
  normalize() {
    const ids = new Set(this.pages.map(page => page.id));
    this.selected = new Set([...this.selected].filter(id => ids.has(id)));
    if (!ids.has(this.active)) this.active = this.pages[0]?.id ?? null;
    if (!ids.has(this.anchor)) this.anchor = this.active;
  }
  commit(pages, selected = [...this.selected], active = this.active) {
    if (JSON.stringify(pages) === this.signature) return false;
    this.past.push(this.snapshot()); this.future = [];
    this.pages = pages; this.selected = new Set(selected); this.active = active; this.anchor = active; this.normalize(); return true;
  }
  undo() { if (!this.past.length) return false; this.future.push(this.snapshot()); this.apply(this.past.pop()); return true; }
  redo() { if (!this.future.length) return false; this.past.push(this.snapshot()); this.apply(this.future.pop()); return true; }
  markSaved() { this.saved = this.signature; }
  select(id, { toggle = false, range = false } = {}) {
    if (!this.pages.some(page => page.id === id)) return;
    if (range) {
      const first = this.pages.findIndex(page => page.id === (this.anchor ?? this.active)), last = this.pages.findIndex(page => page.id === id);
      const slice = this.pages.slice(Math.min(Math.max(0, first), last), Math.max(first, last) + 1).map(page => page.id);
      this.selected = new Set(toggle ? [...this.selected, ...slice] : slice);
    } else if (toggle) { this.selected.has(id) ? this.selected.delete(id) : this.selected.add(id); this.anchor = id; }
    else { this.selected = new Set([id]); this.anchor = id; }
    this.active = id;
  }
  retainedSources() {
    return new Set([this.snapshot(), ...this.past, ...this.future].flatMap(snapshot => snapshot.pages.map(page => page.sourceId).filter(Boolean)));
  }
}
