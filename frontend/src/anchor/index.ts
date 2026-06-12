import type { TextQuoteSelector } from "../annotation/record";

const CONTEXT_LEN = 32;
const MAX_MATCHES = 100;
const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE"]);

interface Entry {
  node: Text;
  start: number;
}

interface TextIndex {
  text: string;
  entries: Entry[];
  positions: Map<Text, number>;
}

function isSkipped(node: Text, root: Element): boolean {
  for (let el: Element | null = node.parentElement; el && el !== root; el = el.parentElement) {
    if (SKIP_TAGS.has(el.tagName)) return true;
  }
  return false;
}

function buildIndex(root: Element): TextIndex {
  const doc = root.ownerDocument;
  const entries: Entry[] = [];
  const positions = new Map<Text, number>();
  let text = "";
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n !== null; n = walker.nextNode()) {
    const t = n as Text;
    if (t.data.length === 0 || isSkipped(t, root)) continue;
    positions.set(t, text.length);
    entries.push({ node: t, start: text.length });
    text += t.data;
  }
  return { text, entries, positions };
}

function pointToOffset(idx: TextIndex, container: Node, offset: number): number | null {
  if (container.nodeType === Node.TEXT_NODE) {
    const base = idx.positions.get(container as Text);
    return base === undefined ? null : base + offset;
  }
  const doc = container.ownerDocument;
  if (!doc) return null;
  const probe = doc.createRange();
  try {
    probe.setStart(container, offset);
  } catch {
    return null;
  }
  for (const { node, start } of idx.entries) {
    const r = doc.createRange();
    r.selectNodeContents(node);
    if (probe.compareBoundaryPoints(Range.START_TO_START, r) <= 0) return start;
  }
  return idx.text.length;
}

export function describeRange(root: Element, range: Range): TextQuoteSelector | null {
  const idx = buildIndex(root);
  const start = pointToOffset(idx, range.startContainer, range.startOffset);
  const end = pointToOffset(idx, range.endContainer, range.endOffset);
  if (start === null || end === null || end <= start) return null;
  const exact = idx.text.slice(start, end);
  if (exact.trim().length === 0) return null;
  return {
    type: "TextQuoteSelector",
    exact,
    prefix: idx.text.slice(Math.max(0, start - CONTEXT_LEN), start),
    suffix: idx.text.slice(end, end + CONTEXT_LEN),
  };
}

function commonSuffixLen(a: string, b: string): number {
  let n = 0;
  while (n < a.length && n < b.length && a[a.length - 1 - n] === b[b.length - 1 - n]) n++;
  return n;
}

function commonPrefixLen(a: string, b: string): number {
  let n = 0;
  while (n < a.length && n < b.length && a[n] === b[n]) n++;
  return n;
}

function contextScore(text: string, at: number, sel: TextQuoteSelector): number {
  let score = 0;
  if (sel.prefix) {
    score += commonSuffixLen(text.slice(Math.max(0, at - sel.prefix.length), at), sel.prefix);
  }
  if (sel.suffix) {
    const after = at + sel.exact.length;
    score += commonPrefixLen(text.slice(after, after + sel.suffix.length), sel.suffix);
  }
  return score;
}

function locate(idx: TextIndex, offset: number, isEnd: boolean): { node: Text; offset: number } | null {
  let lo = 0;
  let hi = idx.entries.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const e = idx.entries[mid] as Entry;
    const nodeEnd = e.start + e.node.data.length;
    if (offset < e.start) {
      hi = mid - 1;
    } else if (isEnd ? offset > nodeEnd : offset >= nodeEnd) {
      lo = mid + 1;
    } else {
      return { node: e.node, offset: offset - e.start };
    }
  }
  return null;
}

function offsetsToRange(idx: TextIndex, start: number, end: number): Range | null {
  const first = idx.entries[0];
  if (!first) return null;
  const doc = first.node.ownerDocument;
  if (!doc) return null;
  const startLoc = locate(idx, start, false);
  const endLoc = locate(idx, end, true);
  if (!startLoc || !endLoc) return null;
  const range = doc.createRange();
  range.setStart(startLoc.node, startLoc.offset);
  range.setEnd(endLoc.node, endLoc.offset);
  return range;
}

export function anchorSelector(root: Element, sel: TextQuoteSelector): Range | null {
  if (!sel.exact) return null;
  const idx = buildIndex(root);
  const matches: number[] = [];
  for (let i = idx.text.indexOf(sel.exact); i !== -1; i = idx.text.indexOf(sel.exact, i + 1)) {
    matches.push(i);
    if (matches.length >= MAX_MATCHES) break;
  }
  if (matches.length === 0) return null;
  let best = matches[0] as number;
  if (matches.length > 1) {
    let bestScore = -1;
    for (const m of matches) {
      const score = contextScore(idx.text, m, sel);
      if (score > bestScore) {
        bestScore = score;
        best = m;
      }
    }
  }
  return offsetsToRange(idx, best, best + sel.exact.length);
}
