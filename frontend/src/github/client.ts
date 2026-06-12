import type { TokenProvider } from "../auth/token-store";

export interface GitHubUser {
  login: string;
}

export interface GitHubIssue {
  number: number;
  html_url: string;
  body: string | null;
  user: { login: string } | null;
}

export class GitHubApiError extends Error {
  readonly status: number;
  readonly apiMessage: string;
  readonly rateLimited: boolean;

  constructor(status: number, apiMessage: string, rateLimited: boolean) {
    super(apiMessage);
    this.name = "GitHubApiError";
    this.status = status;
    this.apiMessage = apiMessage;
    this.rateLimited = rateLimited;
  }
}

const MAX_PAGES = 10;

function loginOf(v: unknown): string | null {
  if (typeof v !== "object" || v === null) return null;
  const login = (v as Record<string, unknown>)["login"];
  return typeof login === "string" ? login : null;
}

function toIssue(item: unknown): GitHubIssue | null {
  if (typeof item !== "object" || item === null) return null;
  const o = item as Record<string, unknown>;
  if ("pull_request" in o) return null;
  if (typeof o["number"] !== "number" || typeof o["html_url"] !== "string") return null;
  const login = loginOf(o["user"]);
  return {
    number: o["number"],
    html_url: o["html_url"],
    body: typeof o["body"] === "string" ? o["body"] : null,
    user: login === null ? null : { login },
  };
}

export class GitHubClient {
  private readonly baseUrl: string;
  private readonly origin: string;

  constructor(
    baseUrl: string,
    private readonly tokens: TokenProvider,
  ) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.origin = new URL(this.baseUrl).origin;
  }

  private async request(
    method: string,
    url: string,
    body?: unknown,
  ): Promise<{ json: unknown; headers: Headers }> {
    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    };
    const token = this.tokens.get();
    if (token) headers["Authorization"] = `Bearer ${token}`;
    if (body !== undefined) headers["Content-Type"] = "application/json";
    const res = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: "error",
    });
    if (!res.ok) {
      let apiMessage = `GitHub API responded with HTTP ${res.status}`;
      try {
        const data: unknown = await res.json();
        if (typeof data === "object" && data !== null) {
          const m = (data as Record<string, unknown>)["message"];
          if (typeof m === "string" && m) apiMessage = m;
        }
      } catch {
        void 0;
      }
      const rateLimited =
        res.status === 429 ||
        (res.status === 403 && res.headers.get("x-ratelimit-remaining") === "0");
      throw new GitHubApiError(res.status, apiMessage, rateLimited);
    }
    if (res.status === 204) return { json: null, headers: res.headers };
    return { json: await res.json(), headers: res.headers };
  }

  async getUser(): Promise<GitHubUser> {
    const { json } = await this.request("GET", `${this.baseUrl}/user`);
    const login = loginOf(json);
    if (login === null) throw new Error("Unexpected response for /user");
    return { login };
  }

  async listOpenIssues(repo: string, label: string): Promise<GitHubIssue[]> {
    const issues: GitHubIssue[] = [];
    let url: string | null = `${this.baseUrl}/repos/${repo}/issues?state=open&labels=${encodeURIComponent(label)}&per_page=100`;
    for (let page = 0; url !== null && page < MAX_PAGES; page++) {
      const { json, headers } = await this.request("GET", url);
      if (!Array.isArray(json)) break;
      for (const item of json) {
        const issue = toIssue(item);
        if (issue) issues.push(issue);
      }
      url = this.nextLink(headers.get("link"));
    }
    if (url !== null) console.warn(`ghc: stopped listing issues after ${MAX_PAGES} pages; annotations may be missing`);
    return issues;
  }

  private nextLink(header: string | null): string | null {
    if (!header) return null;
    for (const part of header.split(",")) {
      const m = /<([^>]+)>\s*;\s*rel="next"/.exec(part);
      if (m && m[1] !== undefined) {
        try {
          if (new URL(m[1]).origin === this.origin) return m[1];
        } catch {
          return null;
        }
        return null;
      }
    }
    return null;
  }

  async createIssue(repo: string, title: string, body: string, labels: string[]): Promise<GitHubIssue> {
    const { json } = await this.request("POST", `${this.baseUrl}/repos/${repo}/issues`, {
      title,
      body,
      labels,
    });
    const issue = toIssue(json);
    if (!issue) throw new Error("Unexpected response for issue creation");
    return issue;
  }

  async updateIssueBody(repo: string, issueNumber: number, body: string): Promise<GitHubIssue> {
    const { json } = await this.request("PATCH", `${this.baseUrl}/repos/${repo}/issues/${issueNumber}`, {
      body,
    });
    const issue = toIssue(json);
    if (!issue) throw new Error("Unexpected response for issue update");
    return issue;
  }

  async closeIssue(repo: string, issueNumber: number, reason: "completed" | "not_planned"): Promise<void> {
    await this.request("PATCH", `${this.baseUrl}/repos/${repo}/issues/${issueNumber}`, {
      state: "closed",
      state_reason: reason,
    });
  }
}
