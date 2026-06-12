import type { AnnotationData, TextQuoteSelector } from "./record";

const EXCERPT_MAX = 50;
const FRAGMENT_WHOLE_MAX = 100;

function flatten(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function titleScope(data: AnnotationData): string {
  let path = data.src;
  if (path.toLowerCase().endsWith(".md")) path = path.slice(0, -3);
  const segments = path.split("/").filter((s) => s.length > 0);
  const pageFirst = data.page.split("/").find((s) => s.length > 0);
  while (segments.length > 1 && segments[0] !== pageFirst) segments.shift();
  return segments.join("/");
}

export function excerpt(exact: string): string {
  const flat = flatten(exact);
  if (flat.length <= EXCERPT_MAX) return flat;
  const head = flat.slice(0, EXCERPT_MAX);
  const boundary = flat.charAt(EXCERPT_MAX) === " " ? EXCERPT_MAX : head.lastIndexOf(" ");
  return `${(boundary > 0 ? head.slice(0, boundary) : head).trimEnd()}…`;
}

export function buildIssueTitle(data: AnnotationData): string {
  return `review(${titleScope(data)}): "${excerpt(data.selector.exact)}"`;
}

function encodeFragmentPart(s: string): string {
  return encodeURIComponent(s)
    .replace(/-/g, "%2D")
    .replace(/\(/g, "%28")
    .replace(/\)/g, "%29");
}

export function buildTextFragmentUrl(pageHref: string, selector: TextQuoteSelector): string {
  const base = pageHref.split("#")[0] ?? pageHref;
  const flat = flatten(selector.exact);
  let fragment: string;
  if (flat.length <= FRAGMENT_WHOLE_MAX) {
    fragment = encodeFragmentPart(flat);
  } else {
    const words = flat.split(" ");
    fragment = `${encodeFragmentPart(words.slice(0, 4).join(" "))},${encodeFragmentPart(words.slice(-4).join(" "))}`;
  }
  return `${base}#:~:text=${fragment}`;
}

export function buildAnnotationBlock(data: AnnotationData): string {
  const json = JSON.stringify(data, null, 2);
  return `<details>\n<summary>annotation data (machine-readable — do not edit)</summary>\n\n\`\`\`json\n${json}\n\`\`\`\n\n</details>`;
}

export interface BuildBodyOptions {
  pageHref: string;
  rawBlock?: string;
}

export function buildIssueBody(comment: string, data: AnnotationData, opts: BuildBodyOptions): string {
  const url = buildTextFragmentUrl(opts.pageHref, data.selector);
  const quoted = data.selector.exact
    .split("\n")
    .map((line) => `> > ${line}`)
    .join("\n");
  const zone1 = `> 📍 [${titleScope(data)}](${url}) — annotated text:\n>\n${quoted}`;
  const zone3 = opts.rawBlock ?? buildAnnotationBlock(data);
  const prose = comment.trim();
  return prose ? `${zone1}\n\n${prose}\n\n${zone3}\n` : `${zone1}\n\n${zone3}\n`;
}
