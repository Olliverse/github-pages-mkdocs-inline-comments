import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createController } from "./controller";
import { LocalStorageTokenProvider } from "./auth/token-store";
import { parseIssueBody } from "./annotation/parse";
import type { WidgetConfig } from "./config";

beforeAll(() => {
  Range.prototype.getBoundingClientRect = (): DOMRect => new DOMRect(0, 0, 0, 0);
});

const cfg: WidgetConfig = {
  ghc: 1,
  src: "docs/index.md",
  page: "/",
  repo: "o/r",
  apiBaseUrl: "https://api.github.com",
  label: "docs-review",
  tokenUrl: null,
  client: "",
  contentSelector: "article",
};

function jsonResponse(data: unknown, init?: { status?: number }): Response {
  return new Response(JSON.stringify(data), {
    status: init?.status ?? 200,
    headers: { "content-type": "application/json" },
  });
}

function stubApi(opts?: { createStatus?: number }): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    if (method === "GET" && url === "https://api.github.com/user") {
      return Promise.resolve(jsonResponse({ login: "octocat" }));
    }
    if (method === "GET" && url.startsWith("https://api.github.com/repos/o/r/issues?")) {
      return Promise.resolve(jsonResponse([]));
    }
    if (method === "POST" && url === "https://api.github.com/repos/o/r/issues") {
      if (opts?.createStatus !== undefined) {
        return Promise.resolve(jsonResponse({ message: "Validation Failed" }, { status: opts.createStatus }));
      }
      const payload = JSON.parse(init?.body as string) as { body: string };
      return Promise.resolve(
        jsonResponse(
          { number: 7, html_url: "https://github.com/o/r/issues/7", body: payload.body, user: { login: "octocat" } },
          { status: 201 },
        ),
      );
    }
    return Promise.resolve(jsonResponse({ message: `unexpected ${method} ${url}` }, { status: 500 }));
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

let stop: (() => void) | null = null;

async function startSignedIn(fetchMock: ReturnType<typeof vi.fn>): Promise<void> {
  document.body.innerHTML = "<article><p>The quick brown fox jumps over the lazy dog.</p></article>";
  new LocalStorageTokenProvider(cfg.apiBaseUrl).set("tok-123");
  stop = createController(cfg).start();
  await vi.waitFor(() => {
    expect(fetchMock.mock.calls.some((c) => (c[0] as string).includes("/issues?"))).toBe(true);
  });
}

function selectText(needle: string): void {
  const root = document.querySelector("article") as Element;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n !== null; n = walker.nextNode()) {
    const text = n as Text;
    const start = text.data.indexOf(needle);
    if (start === -1) continue;
    const range = document.createRange();
    range.setStart(text, start);
    range.setEnd(text, start + needle.length);
    const selection = document.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    document.dispatchEvent(new Event("selectionchange"));
    return;
  }
  throw new Error(`text not found: ${needle}`);
}

function composeAndSend(needle: string, comment: string): void {
  selectText(needle);
  (document.querySelector("button.ghc-fab") as HTMLButtonElement).click();
  const textarea = document.querySelector(".ghc-popover--composer textarea") as HTMLTextAreaElement;
  textarea.value = comment;
  textarea.dispatchEvent(new Event("input"));
  (document.querySelector(".ghc-popover--composer .ghc-button--primary") as HTMLButtonElement).click();
}

afterEach(() => {
  stop?.();
  stop = null;
  vi.unstubAllGlobals();
  localStorage.clear();
  document.body.innerHTML = "";
});

describe("controller create flow", () => {
  it("opens the annotation detail view after a successful create", async () => {
    const fetchMock = stubApi();
    await startSignedIn(fetchMock);
    composeAndSend("quick brown fox", "needs a citation");
    await vi.waitFor(() => {
      expect(document.querySelector(".ghc-popover--detail")).toBeTruthy();
    });
    expect(document.querySelectorAll(".ghc-popover")).toHaveLength(1);
    const detail = document.querySelector(".ghc-popover--detail") as HTMLElement;
    expect(detail.querySelector(".ghc-popover__quote")?.textContent).toBe("quick brown fox");
    expect(detail.querySelector(".ghc-popover__comment")?.textContent).toBe("needs a citation");
    expect(detail.querySelector(".ghc-popover__issue")?.textContent).toBe("#7");
    const labels = [...detail.querySelectorAll(".ghc-popover__actions button")].map((b) => b.textContent);
    expect(labels).toEqual(["Edit", "Resolve", "Delete"]);
    expect(document.body.textContent).not.toContain("Annotation created");
    const mark = document.querySelector('mark.ghc-highlight[data-ghc-issue="7"]');
    expect(mark).toBeTruthy();
    expect(mark?.classList.contains("ghc-highlight--active")).toBe(true);
  });

  it("ships the title scope as the scope field of the created payload", async () => {
    const fetchMock = stubApi();
    await startSignedIn(fetchMock);
    composeAndSend("quick brown fox", "needs a citation");
    await vi.waitFor(() => {
      expect(document.querySelector(".ghc-popover--detail")).toBeTruthy();
    });
    const create = fetchMock.mock.calls.find((c) => (c[1] as RequestInit | undefined)?.method === "POST");
    const payload = JSON.parse((create?.[1] as RequestInit).body as string) as { title: string; body: string };
    expect(payload.title).toContain("review(index):");
    expect(parseIssueBody(payload.body)?.data.scope).toBe("index");
  });

  it("clears the draft and the active highlight when composing again", async () => {
    const fetchMock = stubApi();
    await startSignedIn(fetchMock);
    composeAndSend("quick brown fox", "first comment");
    await vi.waitFor(() => {
      expect(document.querySelector(".ghc-popover--detail")).toBeTruthy();
    });
    selectText("lazy dog");
    (document.querySelector("button.ghc-fab") as HTMLButtonElement).click();
    const textarea = document.querySelector(".ghc-popover--composer textarea") as HTMLTextAreaElement;
    expect(textarea.value).toBe("");
    expect(document.querySelector("mark.ghc-highlight--active")).toBeNull();
  });

  it("keys the composer draft by selection", async () => {
    const fetchMock = stubApi();
    await startSignedIn(fetchMock);
    selectText("quick brown fox");
    (document.querySelector("button.ghc-fab") as HTMLButtonElement).click();
    let textarea = document.querySelector(".ghc-popover--composer textarea") as HTMLTextAreaElement;
    textarea.value = "draft for fox";
    textarea.dispatchEvent(new Event("input"));
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(document.querySelector(".ghc-popover--composer")).toBeNull();

    selectText("lazy dog");
    (document.querySelector("button.ghc-fab") as HTMLButtonElement).click();
    textarea = document.querySelector(".ghc-popover--composer textarea") as HTMLTextAreaElement;
    expect(textarea.value).toBe("");
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));

    selectText("quick brown fox");
    (document.querySelector("button.ghc-fab") as HTMLButtonElement).click();
    textarea = document.querySelector(".ghc-popover--composer textarea") as HTMLTextAreaElement;
    expect(textarea.value).toBe("draft for fox");
  });

  it("keeps the composer open with the error when the create fails", async () => {
    const fetchMock = stubApi({ createStatus: 422 });
    await startSignedIn(fetchMock);
    composeAndSend("quick brown fox", "doomed");
    await vi.waitFor(() => {
      const error = document.querySelector(".ghc-popover--composer .ghc-error") as HTMLElement;
      expect(error.hidden).toBe(false);
    });
    expect(document.querySelector(".ghc-popover--composer .ghc-error")?.textContent).toBe("Validation Failed");
    expect(document.querySelector(".ghc-popover--detail")).toBeNull();
    const send = document.querySelector(".ghc-popover--composer .ghc-button--primary") as HTMLButtonElement;
    expect(send.disabled).toBe(false);
    expect((document.querySelector(".ghc-popover--composer textarea") as HTMLTextAreaElement).value).toBe("doomed");
  });
});
