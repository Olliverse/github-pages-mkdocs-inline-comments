import type { WidgetConfig } from "./config";
import { LocalStorageTokenProvider, StaticTokenProvider } from "./auth/token-store";
import type { TokenProvider } from "./auth/token-store";
import { GitHubClient } from "./github/client";
import type { GitHubUser } from "./github/client";
import { parseIssueBody } from "./annotation/parse";
import type { Annotation, AnnotationData, TextQuoteSelector } from "./annotation/record";
import { buildAnnotationBlock, buildIssueBody, buildIssueTitle, titleScope } from "./annotation/serialize";
import { anchorSelector, describeRange } from "./anchor/index";
import { errorText } from "./ui/dom";
import { createFab } from "./ui/fab";
import type { Fab } from "./ui/fab";
import { highlightRange } from "./ui/highlights";
import { createPanel } from "./ui/panel";
import type { Panel, PanelItem } from "./ui/panel";
import { closePopover, showComposer, showDetail, showTokenGate } from "./ui/popover";
import { createTokenForm } from "./ui/token-form";

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
  let fab: Fab | null = null;
  let contentRoot: Element = document.body;
  let stopped = false;
  const drafts = new Map<string, string>();

  function pageHref(): string {
    return window.location.href.split("#")[0] ?? window.location.href;
  }

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

  function setActiveHighlight(issueNumber: number | null): void {
    for (const mark of contentRoot.querySelectorAll("mark.ghc-highlight--active")) {
      mark.classList.remove("ghc-highlight--active");
    }
    if (issueNumber === null) return;
    for (const mark of contentRoot.querySelectorAll(`mark.ghc-highlight[data-ghc-issue="${issueNumber}"]`)) {
      mark.classList.add("ghc-highlight--active");
    }
  }

  function openDetail(annotation: Annotation, rect: DOMRect): void {
    showDetail(annotation, rect, {
      onEdit: (newComment) => updateComment(annotation, newComment),
      onResolve: () => closeAnnotation(annotation, "completed"),
      onRetract: () => closeAnnotation(annotation, "not_planned"),
      onClosed: () => setActiveHighlight(null),
    });
    setActiveHighlight(annotation.issueNumber);
  }

  function refreshPanelItems(): void {
    panel?.setItems(annotations.map((a) => ({ annotation: a, anchored: anchored.has(a.issueNumber) })));
  }

  async function updateComment(annotation: Annotation, newComment: string): Promise<void> {
    const fresh = await client.getIssue(cfg.repo, annotation.issueNumber);
    const freshParsed = fresh.body === null ? null : parseIssueBody(fresh.body);
    if (!freshParsed) {
      throw new Error("The issue no longer carries readable annotation data; edit it on GitHub instead.");
    }
    const body = buildIssueBody(newComment, freshParsed.data, {
      pageHref: pageHref(),
      rawBlock: freshParsed.rawBlock,
    });
    const updated = await client.updateIssueBody(cfg.repo, annotation.issueNumber, body);
    const parsed = parseIssueBody(updated.body ?? body) ?? parseIssueBody(body);
    if (parsed) {
      annotation.comment = parsed.comment;
      annotation.data = parsed.data;
      annotation.rawBlock = parsed.rawBlock;
    } else {
      annotation.comment = newComment.trim();
    }
    refreshPanelItems();
  }

  async function closeAnnotation(annotation: Annotation, reason: "completed" | "not_planned"): Promise<void> {
    await client.closeIssue(cfg.repo, annotation.issueNumber, reason);
    annotations = annotations.filter((a) => a.issueNumber !== annotation.issueNumber);
    cleanups.get(annotation.issueNumber)?.();
    cleanups.delete(annotation.issueNumber);
    anchored.delete(annotation.issueNumber);
    refreshPanelItems();
  }

  function onAnnotate(range: Range): void {
    const selector = describeRange(contentRoot, range);
    if (!selector) return;
    const rect = range.getBoundingClientRect();
    if (!user) {
      showTokenGate(
        rect,
        createTokenForm({
          tokenUrl: cfg.tokenUrl,
          onSubmit: async (token) => {
            await signIn(token);
            openComposer(selector, rect);
          },
        }),
      );
      return;
    }
    openComposer(selector, rect);
  }

  function draftKey(selector: TextQuoteSelector): string {
    return [selector.prefix ?? "", selector.exact, selector.suffix ?? ""].join("\u0000");
  }

  function openComposer(selector: TextQuoteSelector, rect: DOMRect): void {
    const key = draftKey(selector);
    showComposer(selector.exact, rect, {
      getDraft: () => drafts.get(key) ?? "",
      setDraft: (value) => {
        drafts.set(key, value);
      },
      onSubmit: async (comment) => {
        const annotation = await createAnnotation(selector, comment);
        drafts.delete(key);
        const mark = contentRoot.querySelector(`mark.ghc-highlight[data-ghc-issue="${annotation.issueNumber}"]`);
        openDetail(annotation, mark instanceof HTMLElement ? mark.getBoundingClientRect() : rect);
      },
    });
  }

  async function createAnnotation(selector: TextQuoteSelector, comment: string): Promise<Annotation> {
    const base: AnnotationData = {
      ghc: 1,
      src: cfg.src,
      page: cfg.page,
      selector,
    };
    const data: AnnotationData = {
      ...base,
      ...(cfg.client ? { client: cfg.client } : {}),
      scope: titleScope(base),
    };
    const body = buildIssueBody(comment, data, { pageHref: pageHref() });
    const issue = await client.createIssue(cfg.repo, buildIssueTitle(data), body, [cfg.label]);
    const parsed = parseIssueBody(issue.body ?? body) ?? parseIssueBody(body);
    const annotation: Annotation = {
      issueNumber: issue.number,
      htmlUrl: issue.html_url,
      author: user?.login ?? "",
      comment: parsed?.comment ?? comment.trim(),
      data: parsed?.data ?? data,
      rawBlock: parsed?.rawBlock ?? buildAnnotationBlock(data),
    };
    annotations = [...annotations, annotation];
    renderAnnotations();
    return annotation;
  }

  async function signIn(token: string): Promise<void> {
    const probe = new GitHubClient(cfg.apiBaseUrl, new StaticTokenProvider(token));
    const probedUser = await probe.getUser();
    tokens.set(token);
    user = probedUser;
    const view = ensurePanel();
    view.setHasToken(true);
    view.setUser(user.login);
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
    fab = createFab(contentRoot, onAnnotate);
    if (tokens.get()) {
      const view = ensurePanel();
      view.setHasToken(true);
      view.setLoading(true);
      void resume();
    }
    return () => {
      stopped = true;
      clearHighlights();
      closePopover();
      fab?.destroy();
      fab = null;
      panel?.destroy();
      panel = null;
    };
  }

  return { start };
}
