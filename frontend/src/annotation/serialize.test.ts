import { describe, expect, it } from "vitest";
import { parseIssueBody } from "./parse";
import { buildIssueBody, buildIssueTitle, buildTextFragmentUrl, excerpt, titleScope } from "./serialize";
import type { AnnotationData } from "./record";

const pageHref = "https://olliverse.github.io/repo/use-cases/";

function data(overrides?: Partial<AnnotationData>): AnnotationData {
  return {
    ghc: 1,
    src: "docs/use-cases.md",
    page: "use-cases/",
    selector: {
      type: "TextQuoteSelector",
      exact: "the widget stays fully silent by design",
      prefix: "nothing is fetched on page load — ",
      suffix: " (QDR-002); opening the panel",
    },
    client: "mkdocs-inline-comments/0.1.0",
    ...overrides,
  };
}

describe("roundtrip", () => {
  it("parse(build(comment, data)) returns comment and data unchanged", () => {
    const d = data();
    const comment = "This reads like a feature, but it is accepted debt — link QDR-002 here.";
    const parsed = parseIssueBody(buildIssueBody(comment, d, { pageHref }));
    expect(parsed?.comment).toBe(comment);
    expect(parsed?.data).toEqual(d);
  });

  it("roundtrips an empty comment", () => {
    const parsed = parseIssueBody(buildIssueBody("", data(), { pageHref }));
    expect(parsed?.comment).toBe("");
    expect(parsed?.data).toEqual(data());
  });

  it("roundtrips a multiline comment containing code fences and details", () => {
    const comment = [
      "Two findings here:",
      "",
      "```json",
      '{"ghc": "this fence is reviewer prose, not a record"}',
      "```",
      "",
      "<details>",
      "<summary>side note</summary>",
      "",
      "```json",
      '{"ghc": 1, "src": "decoy.md", "page": "x/", "selector": {"type": "TextQuoteSelector", "exact": "d"}}',
      "```",
      "",
      "</details>",
      "",
      "End of comment.",
    ].join("\n");
    const parsed = parseIssueBody(buildIssueBody(comment, data(), { pageHref }));
    expect(parsed?.comment).toBe(comment);
    expect(parsed?.data).toEqual(data());
  });

  it("roundtrips a selector exact containing newlines", () => {
    const d = data({ selector: { type: "TextQuoteSelector", exact: "line one\nline two" } });
    const parsed = parseIssueBody(buildIssueBody("c", d, { pageHref }));
    expect(parsed?.data.selector.exact).toBe("line one\nline two");
  });

  it("roundtrips without the optional client field", () => {
    const d = data();
    delete (d as Partial<AnnotationData>).client;
    const parsed = parseIssueBody(buildIssueBody("c", d, { pageHref }));
    expect(parsed?.data).toEqual(d);
  });
});

describe("UC-4 rebuild via rawBlock", () => {
  it("keeps the annotation block byte-identical and unknown fields intact", () => {
    const extended = { ...data(), futureField: { nested: true } };
    const original = buildIssueBody("first comment", extended as unknown as AnnotationData, { pageHref });
    const parsed = parseIssueBody(original);
    expect(parsed).not.toBeNull();
    const first = parsed as NonNullable<typeof parsed>;
    const rebuilt = buildIssueBody("sharper comment", first.data, {
      pageHref,
      rawBlock: first.rawBlock,
    });
    const reparsed = parseIssueBody(rebuilt);
    expect(reparsed?.comment).toBe("sharper comment");
    expect(reparsed?.rawBlock).toBe(first.rawBlock);
    expect((reparsed?.data as unknown as Record<string, unknown>)["futureField"]).toEqual({ nested: true });
  });
});

describe("buildIssueTitle", () => {
  it("derives the scope from src and page", () => {
    expect(titleScope(data())).toBe("use-cases");
    expect(
      titleScope(data({ src: "docs/adr/0001-static-pat-auth.md", page: "adr/0001-static-pat-auth/" })),
    ).toBe("adr/0001-static-pat-auth");
    expect(titleScope(data({ src: "docs/index.md", page: "" }))).toBe("index");
    expect(titleScope(data({ src: "use-cases.md" }))).toBe("use-cases");
  });

  it("renders scope and quoted excerpt", () => {
    expect(buildIssueTitle(data())).toBe('review(use-cases): "the widget stays fully silent by design"');
  });

  it("truncates the excerpt at a word boundary with an ellipsis", () => {
    const exact = "fine-grained PAT in localStorage is acceptable for trusted sites";
    expect(excerpt(exact)).toBe("fine-grained PAT in localStorage is acceptable for…");
    expect(excerpt(exact).length).toBeLessThanOrEqual(52);
  });

  it("hard-truncates a single overlong word", () => {
    expect(excerpt("a".repeat(60))).toBe(`${"a".repeat(50)}…`);
  });

  it("flattens whitespace in the excerpt", () => {
    expect(excerpt("two\n  words")).toBe("two words");
  });
});

describe("buildTextFragmentUrl", () => {
  it("appends an encoded text fragment and drops an existing hash", () => {
    const url = buildTextFragmentUrl(`${pageHref}#old-anchor`, {
      type: "TextQuoteSelector",
      exact: "the widget stays",
    });
    expect(url).toBe(`${pageHref}#:~:text=the%20widget%20stays`);
  });

  it("percent-encodes fragment-significant characters", () => {
    const url = buildTextFragmentUrl(pageHref, { type: "TextQuoteSelector", exact: "re-use, (maybe)" });
    expect(url).toBe(`${pageHref}#:~:text=re%2Duse%2C%20%28maybe%29`);
  });

  it("uses a start,end fragment for long passages", () => {
    const exact = Array.from({ length: 30 }, (_, i) => `word${i}`).join(" ");
    const url = buildTextFragmentUrl(pageHref, { type: "TextQuoteSelector", exact });
    expect(url).toContain(",");
    expect(url).toContain("#:~:text=word0%20word1%20word2%20word3,");
    expect(url.endsWith("word26%20word27%20word28%20word29")).toBe(true);
  });
});
