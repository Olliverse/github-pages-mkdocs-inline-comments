import type { WidgetConfig } from "./config";
import { LocalStorageTokenProvider, StaticTokenProvider } from "./auth/token-store";
import type { TokenProvider } from "./auth/token-store";
import { GitHubClient } from "./github/client";
import type { GitHubUser } from "./github/client";
import { parseIssueBody } from "./annotation/parse";
import type { Annotation } from "./annotation/record";
import { anchorSelector } from "./anchor/index";
import { errorText } from "./ui/dom";
import { highlightRange } from "./ui/highlights";
import { createPanel } from "./ui/panel";
import type { Panel, PanelItem } from "./ui/panel";
import { closePopover, showDetail } from "./ui/popover";

export interface Controller {
  start(): () => void;
}

export function createController(cfg: WidgetConfig): Controller {
  const tokens: TokenProvider = new LocalStorageTokenProvider(cfg.apiBaseUrl);
  const client = new GitHubClient(cfg.apiBaseUrl, tokens);
  let user: GitHubUser | null = null;
  let annotations: Annotation[] = [];
  const anchored = new Map<number, Range>();
  const cleanups = new Map<number, () => void>();
  let panel: Panel | null = null;
  let contentRoot: Element = document.body;
  let stopped = false;

  function resolveContentRoot(): Element {
    if (cfg.contentSelector) {
      const explicit = document.querySelector(cfg.contentSelector);
      if (explicit) return explicit;
    }
    return document.querySelector("article") ?? document.querySelector("main") ?? document.body;
  }

  function ensurePanel(): Panel {
    if (!panel) {
      panel = createPanel({
        onSelect: onPanelSelect,
        onSignOut: signOut,
      });
    }
    return panel;
  }

  function clearHighlights(): void {
    for (const cleanup of cleanups.values()) cleanup();
    cleanups.clear();
    anchored.clear();
  }

  function renderAnnotations(): void {
    clearHighlights();
    for (const annotation of annotations) {
      const range = anchorSelector(contentRoot, annotation.data.selector);
      if (!range) continue;
      anchored.set(annotation.issueNumber, range);
      cleanups.set(annotation.issueNumber, highlightRange(range, annotation.issueNumber, onHighlightClick));
    }
    panel?.setItems(annotations.map((a) => ({ annotation: a, anchored: anchored.has(a.issueNumber) })));
    panel?.setUser(user ? user.login : null);
  }

  function onHighlightClick(issueNumber: number, anchor: HTMLElement): void {
    const annotation = annotations.find((a) => a.issueNumber === issueNumber);
    if (annotation) openDetail(annotation, anchor.getBoundingClientRect());
  }

  function onPanelSelect(item: PanelItem, entry: HTMLElement): void {
    const issueNumber = item.annotation.issueNumber;
    const mark = contentRoot.querySelector(`mark.ghc-highlight[data-ghc-issue="${issueNumber}"]`);
    if (mark instanceof HTMLElement) {
      mark.scrollIntoView({ block: "center" });
      openDetail(item.annotation, mark.getBoundingClientRect());
    } else {
      openDetail(item.annotation, entry.getBoundingClientRect());
    }
  }

  function openDetail(annotation: Annotation, rect: DOMRect): void {
    showDetail(annotation, rect);
  }

  async function signIn(token: string): Promise<void> {
    const probe = new GitHubClient(cfg.apiBaseUrl, new StaticTokenProvider(token));
    const probedUser = await probe.getUser();
    tokens.set(token);
    user = probedUser;
    ensurePanel().setUser(user.login);
    await loadAnnotations();
  }

  function signOut(): void {
    tokens.clear();
    user = null;
    annotations = [];
    clearHighlights();
    closePopover();
    panel?.destroy();
    panel = null;
  }

  async function loadAnnotations(): Promise<void> {
    if (stopped) return;
    const view = ensurePanel();
    view.setLoading(true);
    try {
      const issues = await client.listOpenIssues(cfg.repo, cfg.label);
      if (stopped) return;
      const next: Annotation[] = [];
      for (const issue of issues) {
        if (issue.body === null) continue;
        const parsed = parseIssueBody(issue.body);
        if (!parsed || parsed.data.page !== cfg.page) continue;
        next.push({
          issueNumber: issue.number,
          htmlUrl: issue.html_url,
          author: issue.user?.login ?? "",
          comment: parsed.comment,
          data: parsed.data,
          rawBlock: parsed.rawBlock,
        });
      }
      annotations = next;
      renderAnnotations();
    } catch (e) {
      if (!stopped) view.setError(errorText(e));
    }
  }

  async function resume(): Promise<void> {
    try {
      user = await client.getUser();
    } catch (e) {
      if (!stopped) ensurePanel().setError(errorText(e));
      return;
    }
    if (stopped) return;
    ensurePanel().setUser(user.login);
    await loadAnnotations();
  }

  function start(): () => void {
    contentRoot = resolveContentRoot();
    if (tokens.get()) {
      ensurePanel().setLoading(true);
      void resume();
    }
    return () => {
      stopped = true;
      clearHighlights();
      closePopover();
      panel?.destroy();
      panel = null;
    };
  }

  void signIn;

  return { start };
}
