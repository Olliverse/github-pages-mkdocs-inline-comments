import { describe, expect, it } from "vitest";
import { readConfig } from "./config";

function withTag(json: string): Document {
  const doc = document.implementation.createHTMLDocument("");
  const el = doc.createElement("script");
  el.type = "application/json";
  el.id = "ghc-config";
  el.textContent = json;
  doc.body.appendChild(el);
  return doc;
}

const valid = {
  ghc: 1,
  src: "docs/use-cases.md",
  page: "use-cases/",
  repo: "owner/repo",
  apiBaseUrl: "https://api.github.com",
  label: "docs-review",
  tokenUrl: "https://github.com/settings/personal-access-tokens/new",
  client: "mkdocs-inline-comments/0.1.0",
  contentSelector: null,
};

describe("readConfig", () => {
  it("parses a valid config tag", () => {
    const cfg = readConfig(withTag(JSON.stringify(valid)));
    expect(cfg).toEqual({ ...valid });
  });

  it("returns null without the tag", () => {
    const doc = document.implementation.createHTMLDocument("");
    expect(readConfig(doc)).toBeNull();
  });

  it("returns null for corrupt json", () => {
    expect(readConfig(withTag("{nope"))).toBeNull();
  });

  it("returns null for unknown format version", () => {
    expect(readConfig(withTag(JSON.stringify({ ...valid, ghc: 2 })))).toBeNull();
  });

  it("returns null when required fields are missing", () => {
    const { repo: _repo, ...rest } = valid;
    expect(readConfig(withTag(JSON.stringify(rest)))).toBeNull();
  });

  it("strips trailing slashes from apiBaseUrl", () => {
    const cfg = readConfig(withTag(JSON.stringify({ ...valid, apiBaseUrl: "https://ghe.example.com/api/v3/" })));
    expect(cfg?.apiBaseUrl).toBe("https://ghe.example.com/api/v3");
  });
});
