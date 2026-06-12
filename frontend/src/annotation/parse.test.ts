import { describe, expect, it, vi } from "vitest";
import { parseIssueBody } from "./parse";

function block(json: string): string {
  return `<details>\n<summary>annotation data (machine-readable — do not edit)</summary>\n\n\`\`\`json\n${json}\n\`\`\`\n\n</details>`;
}

const data = {
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
};

const zone1 =
  "> 📍 [use-cases](https://example.com/use-cases/#:~:text=the%20widget) — annotated text:\n>\n> > the widget stays fully silent by design";

describe("parseIssueBody", () => {
  it("parses the three-zone record", () => {
    const body = `${zone1}\n\nThis reads like a feature, but it is accepted debt.\n\n${block(JSON.stringify(data, null, 2))}\n`;
    const parsed = parseIssueBody(body);
    expect(parsed).not.toBeNull();
    expect(parsed?.comment).toBe("This reads like a feature, but it is accepted debt.");
    expect(parsed?.data).toEqual(data);
    expect(parsed?.rawBlock).toBe(block(JSON.stringify(data, null, 2)));
  });

  it("allows an empty comment", () => {
    const body = `${zone1}\n\n${block(JSON.stringify(data))}\n`;
    const parsed = parseIssueBody(body);
    expect(parsed?.comment).toBe("");
  });

  it("returns null without an annotation block", () => {
    expect(parseIssueBody("just some prose")).toBeNull();
  });

  it("returns null for a corrupt json block", () => {
    const body = `${zone1}\n\n${block("{nope")}\n`;
    expect(parseIssueBody(body)).toBeNull();
  });

  it("returns null when required fields are missing", () => {
    const body = `${zone1}\n\n${block(JSON.stringify({ ghc: 1, src: "docs/x.md" }))}\n`;
    expect(parseIssueBody(body)).toBeNull();
  });

  it("skips records with a newer format version and warns", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const body = `${zone1}\n\n${block(JSON.stringify({ ...data, ghc: 2 }))}\n`;
    expect(parseIssueBody(body)).toBeNull();
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });

  it("takes the last details block with a ghc key despite reviewer-added blocks", () => {
    const decoy = `<details>\n<summary>my notes</summary>\n\n\`\`\`json\n{"ghc": 1, "src": "decoy.md", "page": "decoy/", "selector": {"type": "TextQuoteSelector", "exact": "decoy"}}\n\`\`\`\n\n</details>`;
    const fence = "```json\n{\"unrelated\": true}\n```";
    const body = `${zone1}\n\nSee my notes:\n\n${decoy}\n\nAnd a fence:\n\n${fence}\n\n${block(JSON.stringify(data))}\n`;
    const parsed = parseIssueBody(body);
    expect(parsed?.data.src).toBe("docs/use-cases.md");
    expect(parsed?.comment).toContain("See my notes:");
    expect(parsed?.comment).toContain("decoy");
  });

  it("ignores trailing details without a ghc json block", () => {
    const trailing = `<details>\n<summary>extra</summary>\n\nplain text\n\n</details>`;
    const body = `${zone1}\n\n${block(JSON.stringify(data))}\n\n${trailing}\n`;
    const parsed = parseIssueBody(body);
    expect(parsed?.data).toEqual(data);
    expect(parsed?.comment).toContain("extra");
  });

  it("accepts a payload with a scope field", () => {
    const body = `${zone1}\n\n${block(JSON.stringify({ ...data, scope: "use-cases" }))}\n`;
    const parsed = parseIssueBody(body);
    expect(parsed?.data.scope).toBe("use-cases");
  });

  it("accepts a payload without a scope field", () => {
    const body = `${zone1}\n\n${block(JSON.stringify(data))}\n`;
    expect(parseIssueBody(body)?.data.scope).toBeUndefined();
  });

  it("rejects a payload with a non-string scope", () => {
    const body = `${zone1}\n\n${block(JSON.stringify({ ...data, scope: 7 }))}\n`;
    expect(parseIssueBody(body)).toBeNull();
  });

  it("preserves unknown json fields on the parsed data", () => {
    const extended = { ...data, reviewRound: 2 };
    const body = `${zone1}\n\n${block(JSON.stringify(extended))}\n`;
    const parsed = parseIssueBody(body);
    expect((parsed?.data as unknown as Record<string, unknown>)["reviewRound"]).toBe(2);
    expect(parsed?.rawBlock).toContain('"reviewRound":2');
  });
});
