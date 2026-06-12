import { describe, expect, it } from "vitest";
import { link } from "./dom";

describe("link", () => {
  it("creates an anchor for https urls", () => {
    const node = link("https://github.com/o/r/issues/1", "#1", "ghc-x");
    expect(node.tagName).toBe("A");
    expect((node as HTMLAnchorElement).href).toBe("https://github.com/o/r/issues/1");
    expect((node as HTMLAnchorElement).rel).toBe("noopener noreferrer");
    expect(node.textContent).toBe("#1");
    expect(node.className).toBe("ghc-x");
  });

  it("downgrades javascript: urls to a plain span", () => {
    const node = link("javascript:alert(1)", "#1", "ghc-x");
    expect(node.tagName).toBe("SPAN");
    expect(node.textContent).toBe("#1");
    expect(node.className).toBe("ghc-x");
  });

  it("downgrades other non-http schemes to a plain span", () => {
    expect(link("data:text/html,hi", "x").tagName).toBe("SPAN");
    expect(link("vbscript:msgbox", "x").tagName).toBe("SPAN");
  });
});
