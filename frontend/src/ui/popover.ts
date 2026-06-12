import type { Annotation } from "../annotation/record";
import { button, el, errorText, link } from "./dom";

export interface PopoverHandle {
  close(): void;
  readonly body: HTMLElement;
}

let active: { box: HTMLElement; dispose(): void } | null = null;

export function closePopover(): void {
  if (active) {
    active.dispose();
    active.box.remove();
    active = null;
  }
}

export function openPopover(anchorRect: DOMRect, className: string): PopoverHandle {
  closePopover();
  const box = el("div", `ghc-popover ${className}`);
  box.setAttribute("data-ghc-ui", "");
  const margin = 8;
  const width = 360;
  const left = Math.max(
    margin + window.scrollX,
    Math.min(anchorRect.left + window.scrollX, window.scrollX + window.innerWidth - width - margin),
  );
  box.style.left = `${left}px`;
  box.style.top = `${anchorRect.bottom + window.scrollY + margin}px`;
  document.body.appendChild(box);

  const onMouseDown = (event: MouseEvent): void => {
    if (event.target instanceof Node && !box.contains(event.target)) closePopover();
  };
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === "Escape") closePopover();
  };
  document.addEventListener("mousedown", onMouseDown, true);
  document.addEventListener("keydown", onKeyDown, true);
  const dispose = (): void => {
    document.removeEventListener("mousedown", onMouseDown, true);
    document.removeEventListener("keydown", onKeyDown, true);
  };
  active = { box, dispose };
  return { body: box, close: closePopover };
}

export function renderAnnotationHeader(box: HTMLElement, annotation: Annotation): void {
  box.appendChild(el("blockquote", "ghc-popover__quote", annotation.data.selector.exact));
  const meta = el("p", "ghc-popover__meta");
  meta.appendChild(el("span", "ghc-popover__author", annotation.author ? `@${annotation.author}` : "unknown author"));
  meta.appendChild(document.createTextNode(" · "));
  meta.appendChild(link(annotation.htmlUrl, `#${annotation.issueNumber}`, "ghc-popover__issue"));
  box.appendChild(meta);
}

export function showDetail(annotation: Annotation, anchorRect: DOMRect): PopoverHandle {
  const handle = openPopover(anchorRect, "ghc-popover--detail");
  renderAnnotationHeader(handle.body, annotation);
  const comment = el("p", "ghc-popover__comment", annotation.comment || "(no comment)");
  if (!annotation.comment) comment.classList.add("ghc-popover__comment--empty");
  handle.body.appendChild(comment);
  return handle;
}

export interface CreatedIssueRef {
  issueNumber: number;
  htmlUrl: string;
}

export interface ComposerCallbacks {
  getDraft(): string;
  setDraft(value: string): void;
  onSubmit(comment: string): Promise<CreatedIssueRef>;
}

export function showComposer(quote: string, anchorRect: DOMRect, cb: ComposerCallbacks): PopoverHandle {
  const handle = openPopover(anchorRect, "ghc-popover--composer");
  const box = handle.body;
  box.appendChild(el("blockquote", "ghc-popover__quote", quote));
  const textarea = el("textarea", "ghc-textarea");
  textarea.placeholder = "Write a review comment (optional — the quote alone can be the finding)";
  textarea.value = cb.getDraft();
  textarea.addEventListener("input", () => cb.setDraft(textarea.value));
  box.appendChild(textarea);
  const error = el("p", "ghc-error");
  error.hidden = true;
  const actions = el("div", "ghc-popover__actions");
  const send = button("Send", "ghc-button ghc-button--primary", () => {
    send.disabled = true;
    error.hidden = true;
    cb.onSubmit(textarea.value)
      .then((created) => {
        box.replaceChildren();
        const done = el("p", "ghc-popover__comment", "Annotation created: ");
        done.appendChild(link(created.htmlUrl, `#${created.issueNumber}`));
        box.appendChild(done);
        const closeActions = el("div", "ghc-popover__actions");
        closeActions.appendChild(button("Close", "ghc-button", () => handle.close()));
        box.appendChild(closeActions);
      })
      .catch((e: unknown) => {
        error.textContent = errorText(e);
        error.hidden = false;
        send.disabled = false;
      });
  });
  actions.appendChild(send);
  box.appendChild(actions);
  box.appendChild(error);
  textarea.focus();
  return handle;
}

export function showTokenGate(anchorRect: DOMRect, form: HTMLElement): PopoverHandle {
  const handle = openPopover(anchorRect, "ghc-popover--token");
  handle.body.appendChild(form);
  return handle;
}
