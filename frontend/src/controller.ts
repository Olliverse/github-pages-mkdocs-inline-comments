import type { WidgetConfig } from "./config";
import { LocalStorageTokenProvider, StaticTokenProvider } from "./auth/token-store";
import type { TokenProvider } from "./auth/token-store";
import { GitHubClient } from "./github/client";
import type { GitHubUser } from "./github/client";

export interface Controller {
  start(): () => void;
}

export function createController(cfg: WidgetConfig): Controller {
  const tokens: TokenProvider = new LocalStorageTokenProvider(cfg.apiBaseUrl);
  const client = new GitHubClient(cfg.apiBaseUrl, tokens);
  let user: GitHubUser | null = null;
  let stopped = false;

  async function signIn(token: string): Promise<void> {
    const probe = new GitHubClient(cfg.apiBaseUrl, new StaticTokenProvider(token));
    const probedUser = await probe.getUser();
    tokens.set(token);
    user = probedUser;
    await loadAnnotations();
  }

  function signOut(): void {
    tokens.clear();
    user = null;
  }

  async function loadAnnotations(): Promise<void> {
    if (stopped || !user) return;
    await client.listOpenIssues(cfg.repo, cfg.label);
  }

  async function resume(): Promise<void> {
    try {
      user = await client.getUser();
    } catch {
      user = null;
      return;
    }
    await loadAnnotations();
  }

  function start(): () => void {
    if (tokens.get()) void resume();
    return () => {
      stopped = true;
    };
  }

  void signIn;
  void signOut;

  return { start };
}
