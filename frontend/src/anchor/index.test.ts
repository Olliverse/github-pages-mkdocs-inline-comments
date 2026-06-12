import { beforeEach, describe, expect, it } from "vitest";
import { anchorSelector, describeRange } from "./index";
import type { TextQuoteSelector } from "../annotation/record";

function setBody(html: string): HTMLElement {
  document.body.innerHTML = html;
  return document.body;
}

function sel(exact: string, prefix?: string, suffix?: string): TextQuoteSelector {
  const s: TextQuoteSelector = { type: "TextQuoteSelector", exact };
  if (prefix !== undefined) s.prefix = prefix;
  if (suffix !== undefined) s.suffix = suffix;
  return s;
}

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("anchorSelector", () => {
  it("anchors an exact unique match", () => {
    const root = setBody("<p>The quick brown fox jumps over the lazy dog.</p>");
    const range = anchorSelector(root, sel("brown fox"));
    expect(range?.toString()).toBe("brown fox");
  });

  it("anchors across inline element boundaries", () => {
    const root = setBody("<p>The quick <strong>brown</strong> fox jumps.</p>");
    const range = anchorSelector(root, sel("quick brown fox"));
    expect(range?.toString()).toBe("quick brown fox");
  });

  it("returns null when the text is gone", () => {
    const root = setBody("<p>Entirely different content.</p>");
    expect(anchorSelector(root, sel("brown fox"))).toBeNull();
  });

  it("disambiguates repeated phrases by prefix and suffix", () => {
    const root = setBody("<p id='a'>state is silent by design here.</p><p id='b'>state is silent by accident there.</p>");
    const range = anchorSelector(root, sel("state is silent", undefined, " by accident"));
    expect(range).not.toBeNull();
    const container = range?.startContainer.parentElement;
    expect(container?.id).toBe("b");
  });

  it("prefers prefix similarity for repeated phrases", () => {
    const root = setBody("<p id='a'>first mention of the phrase.</p><p id='b'>second mention of the phrase.</p>");
    const range = anchorSelector(root, sel("the phrase", "second mention of "));
    expect(range?.startContainer.parentElement?.id).toBe("b");
  });

  it("ignores text inside script and style elements", () => {
    const root = setBody("<p>visible text</p><script type='application/json'>{\"k\": \"hidden needle\"}</script>");
    expect(anchorSelector(root, sel("hidden needle"))).toBeNull();
    expect(anchorSelector(root, sel("visible text"))).not.toBeNull();
  });
});

describe("describeRange", () => {
  it("captures exact with surrounding context", () => {
    const root = setBody("<p>The quick brown fox jumps over the lazy dog near the river bank today.</p>");
    const textNode = root.querySelector("p")?.firstChild as Text;
    const range = document.createRange();
    range.setStart(textNode, 10);
    range.setEnd(textNode, 19);
    const selector = describeRange(root, range);
    expect(selector?.exact).toBe("brown fox");
    expect(selector?.prefix).toBe("The quick ");
    expect(selector?.suffix).toBe(" jumps over the lazy dog near th");
  });

  it("handles element-boundary endpoints", () => {
    const root = setBody("<p><strong>bold start</strong> and more text</p>");
    const p = root.querySelector("p") as HTMLElement;
    const range = document.createRange();
    range.setStart(p, 0);
    range.setEnd(p, 1);
    const selector = describeRange(root, range);
    expect(selector?.exact).toBe("bold start");
  });

  it("roundtrips with anchorSelector", () => {
    const root = setBody("<p>Alpha beta gamma. Alpha beta gamma. Alpha beta delta.</p>");
    const textNode = root.querySelector("p")?.firstChild as Text;
    const range = document.createRange();
    range.setStart(textNode, 18);
    range.setEnd(textNode, 28);
    expect(range.toString()).toBe("Alpha beta");
    const selector = describeRange(root, range);
    expect(selector).not.toBeNull();
    const re = anchorSelector(root, selector as TextQuoteSelector);
    expect(re?.toString()).toBe("Alpha beta");
    expect(re?.startOffset).toBe(18);
  });

  it("returns null for whitespace-only selections", () => {
    const root = setBody("<p>word   word</p>");
    const textNode = root.querySelector("p")?.firstChild as Text;
    const range = document.createRange();
    range.setStart(textNode, 4);
    range.setEnd(textNode, 7);
    expect(describeRange(root, range)).toBeNull();
  });
});
