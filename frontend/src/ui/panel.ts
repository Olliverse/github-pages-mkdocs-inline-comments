import type { Annotation } from "../annotation/record";
import { button, el, link } from "./dom";

export interface PanelItem {
  annotation: Annotation;
  anchored: boolean;
}

export interface PanelCallbacks {
  onSelect(item: PanelItem, anchor: HTMLElement): void;
  onSignOut(): void;
}

export interface Panel {
  setUser(login: string | null): void;
  setItems(items: PanelItem[]): void;
  setError(message: string | null): void;
  setLoading(loading: boolean): void;
  destroy(): void;
}

function shortQuote(exact: string): string {
  const flat = exact.replace(/\s+/g, " ").trim();
  return flat.length > 80 ? `${flat.slice(0, 79)}…` : flat;
}

export function createPanel(cb: PanelCallbacks): Panel {
  let open = false;
  let items: PanelItem[] = [];
  let error: string | null = null;
  let loading = false;
  let login: string | null = null;

  const toggle = button("", "ghc-panel-toggle", () => {
    open = !open;
    render();
  });
  toggle.setAttribute("data-ghc-ui", "");
  toggle.setAttribute("aria-label", "Toggle inline review comments");
  toggle.appendChild(el("span", "ghc-panel-toggle__icon", "💬"));
  const count = el("span", "ghc-panel-toggle__count", "0");
  toggle.appendChild(count);

  const panel = el("aside", "ghc-panel");
  panel.setAttribute("data-ghc-ui", "");
  panel.hidden = true;

  document.body.appendChild(toggle);
  document.body.appendChild(panel);

  function render(): void {
    count.textContent = String(items.length);
    panel.hidden = !open;
    if (!open) return;
    panel.replaceChildren();

    const header = el("header", "ghc-panel__header");
    header.appendChild(el("strong", "ghc-panel__title", "Review comments"));
    if (login) {
      const who = el("span", "ghc-panel__user", `@${login}`);
      header.appendChild(who);
      header.appendChild(button("Sign out", "ghc-button ghc-button--quiet", () => cb.onSignOut()));
    }
    panel.appendChild(header);

    if (error !== null) {
      panel.appendChild(el("p", "ghc-error", error));
      return;
    }
    if (loading) {
      panel.appendChild(el("p", "ghc-panel__empty", "Loading annotations…"));
      return;
    }
    if (items.length === 0) {
      panel.appendChild(el("p", "ghc-panel__empty", "No open annotations on this page. Select text to add one."));
      return;
    }
    const list = el("ul", "ghc-panel__list");
    for (const item of items) {
      const entry = el("li", "ghc-panel__item");
      const quote = el("blockquote", "ghc-panel__quote", shortQuote(item.annotation.data.selector.exact));
      entry.appendChild(quote);
      if (item.annotation.comment) {
        entry.appendChild(el("p", "ghc-panel__comment", item.annotation.comment));
      }
      const meta = el("p", "ghc-panel__meta");
      meta.appendChild(
        el("span", "ghc-panel__author", item.annotation.author ? `@${item.annotation.author}` : "unknown author"),
      );
      meta.appendChild(document.createTextNode(" · "));
      const issueLink = link(item.annotation.htmlUrl, `#${item.annotation.issueNumber}`, "ghc-panel__issue");
      issueLink.addEventListener("click", (event) => event.stopPropagation());
      meta.appendChild(issueLink);
      if (!item.anchored) {
        meta.appendChild(document.createTextNode(" · "));
        meta.appendChild(el("span", "ghc-panel__orphan", "not anchorable on this page"));
      }
      entry.appendChild(meta);
      entry.addEventListener("click", () => cb.onSelect(item, entry));
      list.appendChild(entry);
    }
    panel.appendChild(list);
  }

  render();

  return {
    setUser(value: string | null): void {
      login = value;
      render();
    },
    setItems(value: PanelItem[]): void {
      items = value;
      error = null;
      loading = false;
      render();
    },
    setError(message: string | null): void {
      error = message;
      loading = false;
      render();
    },
    setLoading(value: boolean): void {
      loading = value;
      render();
    },
    destroy(): void {
      toggle.remove();
      panel.remove();
    },
  };
}
