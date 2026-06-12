import type { Annotation } from "../annotation/record";
import { button, el, errorText, link } from "./dom";

export interface PopoverHandle {
  close(): void;
  readonly body: HTMLElement;
}

const POPOVER_WIDTH = 360;

let active: { box: HTMLElement; dispose(): void; onClose?: () => void; previous: Element | null } | null = null;

export function closePopover(): void {
  if (active) {
    const current = active;
    active = null;
    current.dispose();
    current.box.remove();
    if (current.previous instanceof HTMLElement && current.previous.isConnected) current.previous.focus();
    current.onClose?.();
  }
}

export function openPopover(anchorRect: DOMRect, className: string, onClose?: () => void): PopoverHandle {
  closePopover();
  const previous = document.activeElement;
  const box = el("div", `ghc-popover ${className}`);
  box.setAttribute("data-ghc-ui", "");
  const margin = 8;
  box.style.width = `${POPOVER_WIDTH}px`;
  const left = Math.max(
    margin + window.scrollX,
    Math.min(
      anchorRect.left + window.scrollX,
      window.scrollX + window.innerWidth - POPOVER_WIDTH - margin,
    ),
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
  active = { box, dispose, onClose, previous };
  queueMicrotask(() => {
    if (active?.box !== box || box.contains(document.activeElement)) return;
    box.querySelector<HTMLElement>("button, [href], textarea, input")?.focus();
  });
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

export interface DetailCallbacks {
  onEdit(newComment: string): Promise<void>;
  onResolve(): Promise<void>;
  onRetract(): Promise<void>;
  onClosed?(): void;
}

export function showDetail(annotation: Annotation, anchorRect: DOMRect, cb: DetailCallbacks): PopoverHandle {
  const handle = openPopover(anchorRect, "ghc-popover--detail", cb.onClosed);
  const box = handle.body;
  renderAnnotationHeader(box, annotation);
  let commentText = annotation.comment;
  const comment = el("p", "ghc-popover__comment");
  const setComment = (value: string): void => {
    commentText = value;
    comment.textContent = value || "(no comment)";
    comment.classList.toggle("ghc-popover__comment--empty", value === "");
  };
  setComment(commentText);
  box.appendChild(comment);

  const error = el("p", "ghc-error");
  error.hidden = true;
  const actions = el("div", "ghc-popover__actions");

  const fail = (e: unknown): void => {
    error.textContent = errorText(e);
    error.hidden = false;
  };

  const run = (action: () => Promise<void>, buttons: HTMLButtonElement[], closeAfter: boolean): void => {
    for (const b of buttons) b.disabled = true;
    error.hidden = true;
    action()
      .then(() => {
        if (closeAfter) handle.close();
      })
      .catch(fail)
      .finally(() => {
        for (const b of buttons) b.disabled = false;
      });
  };

  const editBtn = button("Edit", "ghc-button", () => startEdit());
  const resolveBtn = button("Resolve", "ghc-button", () => {
    run(() => cb.onResolve(), [editBtn, resolveBtn, deleteBtn], true);
  });
  const deleteBtn = button("Delete", "ghc-button", () => {
    if (!window.confirm("Retract this annotation? Its issue will be closed as not planned.")) return;
    run(() => cb.onRetract(), [editBtn, resolveBtn, deleteBtn], true);
  });
  actions.appendChild(editBtn);
  actions.appendChild(resolveBtn);
  actions.appendChild(deleteBtn);
  box.appendChild(actions);
  box.appendChild(error);

  function startEdit(): void {
    actions.hidden = true;
    comment.hidden = true;
    const editor = el("div", "ghc-popover__editor");
    const textarea = el("textarea", "ghc-textarea");
    textarea.value = commentText;
    editor.appendChild(textarea);
    const editActions = el("div", "ghc-popover__actions");
    const closeEditor = (): void => {
      editor.remove();
      actions.hidden = false;
      comment.hidden = false;
    };
    const save = button("Save", "ghc-button ghc-button--primary", () => {
      save.disabled = true;
      cancel.disabled = true;
      error.hidden = true;
      cb.onEdit(textarea.value)
        .then(() => {
          setComment(textarea.value.trim());
          closeEditor();
        })
        .catch((e: unknown) => {
          fail(e);
          save.disabled = false;
          cancel.disabled = false;
        });
    });
    const cancel = button("Cancel", "ghc-button", closeEditor);
    editActions.appendChild(save);
    editActions.appendChild(cancel);
    editor.appendChild(editActions);
    box.insertBefore(editor, actions);
    textarea.focus();
  }

  return handle;
}

export interface ComposerCallbacks {
  getDraft(): string;
  setDraft(value: string): void;
  onSubmit(comment: string): Promise<void>;
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
    cb.onSubmit(textarea.value).catch((e: unknown) => {
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
