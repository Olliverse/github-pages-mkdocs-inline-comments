import { afterEach, describe, expect, it, vi } from "vitest";
import { GitHubApiError, GitHubClient } from "./client";
import type { TokenProvider } from "../auth/token-store";

const tokens: TokenProvider = { get: () => "tok-123", set() {}, clear() {} };
const noTokens: TokenProvider = { get: () => null, set() {}, clear() {} };

function jsonResponse(data: unknown, init?: { status?: number; headers?: Record<string, string> }): Response {
  return new Response(JSON.stringify(data), {
    status: init?.status ?? 200,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
}

function client(t: TokenProvider = tokens): GitHubClient {
  return new GitHubClient("https://api.github.com", t);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("GitHubClient headers", () => {
  it("sends bearer auth, accept and api-version headers", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ login: "octocat" }));
    vi.stubGlobal("fetch", fetchMock);
    const user = await client().getUser();
    expect(user).toEqual({ login: "octocat" });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.github.com/user");
    const headers = init.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("Bearer tok-123");
    expect(headers["Accept"]).toBe("application/vnd.github+json");
    expect(headers["X-GitHub-Api-Version"]).toBe("2022-11-28");
    expect(init.redirect).toBe("error");
  });

  it("omits the authorization header without a token", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ login: "octocat" }));
    vi.stubGlobal("fetch", fetchMock);
    await client(noTokens).getUser();
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)["Authorization"]).toBeUndefined();
  });
});

describe("GitHubClient error mapping", () => {
  it("maps 401 to GitHubApiError with the api message", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ message: "Bad credentials" }, { status: 401 })));
    const err = await client().getUser().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(GitHubApiError);
    expect((err as GitHubApiError).status).toBe(401);
    expect((err as GitHubApiError).apiMessage).toBe("Bad credentials");
    expect((err as GitHubApiError).rateLimited).toBe(false);
  });

  it("flags 403 with exhausted rate limit", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({ message: "API rate limit exceeded" }, { status: 403, headers: { "x-ratelimit-remaining": "0" } }),
      ),
    );
    const err = (await client().getUser().catch((e: unknown) => e)) as GitHubApiError;
    expect(err.rateLimited).toBe(true);
  });

  it("keeps 403 without exhausted rate limit unflagged", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({ message: "Resource not accessible" }, { status: 403, headers: { "x-ratelimit-remaining": "42" } }),
      ),
    );
    const err = (await client().getUser().catch((e: unknown) => e)) as GitHubApiError;
    expect(err.rateLimited).toBe(false);
  });

  it("maps 422 validation errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ message: "Validation Failed" }, { status: 422 })));
    const err = (await client().createIssue("o/r", "t", "b", ["l"]).catch((e: unknown) => e)) as GitHubApiError;
    expect(err.status).toBe(422);
    expect(err.apiMessage).toBe("Validation Failed");
  });

  it("falls back to a status message for non-json error bodies", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("oops", { status: 500 })));
    const err = (await client().getUser().catch((e: unknown) => e)) as GitHubApiError;
    expect(err.apiMessage).toContain("500");
  });
});

function issue(number: number, extra?: Record<string, unknown>): Record<string, unknown> {
  return {
    number,
    html_url: `https://github.com/o/r/issues/${number}`,
    body: `body ${number}`,
    user: { login: "octocat" },
    ...extra,
  };
}

describe("GitHubClient.listOpenIssues", () => {
  it("requests by label and state and filters pull requests", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([issue(1), issue(2, { pull_request: {} })]));
    vi.stubGlobal("fetch", fetchMock);
    const issues = await client().listOpenIssues("o/r", "docs review");
    expect(issues.map((i) => i.number)).toEqual([1]);
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toBe("https://api.github.com/repos/o/r/issues?state=open&labels=docs%20review&per_page=100");
  });

  it("follows Link rel=next pagination", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse([issue(1)], {
          headers: { link: '<https://api.github.com/repos/o/r/issues?page=2>; rel="next", <https://api.github.com/repos/o/r/issues?page=3>; rel="last"' },
        }),
      )
      .mockResolvedValueOnce(jsonResponse([issue(2)]));
    vi.stubGlobal("fetch", fetchMock);
    const issues = await client().listOpenIssues("o/r", "docs-review");
    expect(issues.map((i) => i.number)).toEqual([1, 2]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect((fetchMock.mock.calls[1] as [string])[0]).toBe("https://api.github.com/repos/o/r/issues?page=2");
  });

  it("refuses to follow next links to a different origin", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse([issue(1)], { headers: { link: '<https://evil.example.com/x>; rel="next"' } }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const issues = await client().listOpenIssues("o/r", "docs-review");
    expect(issues).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("caps pagination at ten pages and warns about truncation", async () => {
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(
        jsonResponse([issue(1)], { headers: { link: '<https://api.github.com/repos/o/r/issues?page=2>; rel="next"' } }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await client().listOpenIssues("o/r", "docs-review");
    expect(fetchMock).toHaveBeenCalledTimes(10);
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });
});

describe("GitHubClient writes", () => {
  it("creates issues with title, body and label", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(issue(7), { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    const created = await client().createIssue("o/r", "review(x): \"y\"", "the body", ["docs-review"]);
    expect(created.number).toBe(7);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.github.com/repos/o/r/issues");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ title: 'review(x): "y"', body: "the body", labels: ["docs-review"] });
  });

  it("patches the issue body on update", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(issue(7)));
    vi.stubGlobal("fetch", fetchMock);
    await client().updateIssueBody("o/r", 7, "new body");
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.github.com/repos/o/r/issues/7");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body as string)).toEqual({ body: "new body" });
  });

  it("closes with an explicit state reason", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(issue(7)));
    vi.stubGlobal("fetch", fetchMock);
    await client().closeIssue("o/r", 7, "not_planned");
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body as string)).toEqual({ state: "closed", state_reason: "not_planned" });
  });
});
