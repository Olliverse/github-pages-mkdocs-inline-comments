import type { AnnotationData, TextQuoteSelector } from "./record";

export interface ParsedRecord {
  comment: string;
  data: AnnotationData;
  rawBlock: string;
}

function parseSelector(v: unknown): TextQuoteSelector | null {
  if (typeof v !== "object" || v === null) return null;
  const o = v as Record<string, unknown>;
  if (o["type"] !== "TextQuoteSelector") return null;
  if (typeof o["exact"] !== "string" || o["exact"].length === 0) return null;
  if (o["prefix"] !== undefined && typeof o["prefix"] !== "string") return null;
  if (o["suffix"] !== undefined && typeof o["suffix"] !== "string") return null;
  return o as unknown as TextQuoteSelector;
}

function toAnnotationData(v: unknown): AnnotationData | "newer" | null {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  const version = o["ghc"];
  if (typeof version === "number" && version > 1) return "newer";
  if (version !== 1) return null;
  if (typeof o["src"] !== "string" || typeof o["page"] !== "string") return null;
  if (parseSelector(o["selector"]) === null) return null;
  if (o["client"] !== undefined && typeof o["client"] !== "string") return null;
  if (o["scope"] !== undefined && typeof o["scope"] !== "string") return null;
  return o as unknown as AnnotationData;
}

interface BlockCandidate {
  start: number;
  end: number;
  raw: string;
  json: unknown;
}

function findAnnotationBlock(body: string): BlockCandidate | null {
  const detailsRe = /<details(?:\s[^>]*)?>[\s\S]*?<\/details>/gi;
  const fenceRe = /```json\s*\n([\s\S]*?)\n\s*```/i;
  let last: BlockCandidate | null = null;
  for (const m of body.matchAll(detailsRe)) {
    const raw = m[0];
    const fence = fenceRe.exec(raw);
    if (!fence || fence[1] === undefined) continue;
    let json: unknown;
    try {
      json = JSON.parse(fence[1]);
    } catch {
      continue;
    }
    if (typeof json !== "object" || json === null || Array.isArray(json)) continue;
    if (!Object.prototype.hasOwnProperty.call(json, "ghc")) continue;
    last = { start: m.index, end: m.index + raw.length, raw, json };
  }
  return last;
}

function stripLeadingBlockquote(s: string): string {
  const lines = s.split("\n");
  let i = 0;
  while (i < lines.length && (lines[i] as string).trim() === "") i++;
  if (i < lines.length && (lines[i] as string).trimStart().startsWith(">")) {
    while (i < lines.length && (lines[i] as string).trimStart().startsWith(">")) i++;
  }
  return lines.slice(i).join("\n");
}

export function parseIssueBody(body: string): ParsedRecord | null {
  const block = findAnnotationBlock(body);
  if (!block) return null;
  const data = toAnnotationData(block.json);
  if (data === "newer") {
    console.warn("ghc: skipping annotation written by a newer client (unknown format version)");
    return null;
  }
  if (data === null) return null;
  const withoutBlock = body.slice(0, block.start) + body.slice(block.end);
  const comment = stripLeadingBlockquote(withoutBlock).trim();
  return { comment, data, rawBlock: block.raw };
}
