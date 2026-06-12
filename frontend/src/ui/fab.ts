import { button } from "./dom";

export interface Fab {
  destroy(): void;
}

export function createFab(contentRoot: Element, onAnnotate: (range: Range) => void): Fab {
  let currentRange: Range | null = null;
  const fab = button("Comment", "ghc-fab", () => {
    if (!currentRange) return;
    const range = currentRange;
    hide();
    document.getSelection()?.removeAllRanges();
    onAnnotate(range);
  });
  fab.setAttribute("data-ghc-ui", "");
  fab.hidden = true;
  fab.addEventListener("mousedown", (event) => event.preventDefault());
  document.body.appendChild(fab);

  function hide(): void {
    currentRange = null;
    fab.hidden = true;
  }

  function update(): void {
    const selection = document.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      hide();
      return;
    }
    const range = selection.getRangeAt(0);
    if (!contentRoot.contains(range.startContainer) || !contentRoot.contains(range.endContainer)) {
      hide();
      return;
    }
    if (range.toString().trim().length === 0) {
      hide();
      return;
    }
    currentRange = range.cloneRange();
    const rect = range.getBoundingClientRect();
    const margin = 6;
    const left = Math.max(
      window.scrollX + margin,
      Math.min(rect.right + window.scrollX + margin, window.scrollX + window.innerWidth - 110),
    );
    fab.style.left = `${left}px`;
    fab.style.top = `${rect.bottom + window.scrollY + margin}px`;
    fab.hidden = false;
  }

  document.addEventListener("selectionchange", update);

  return {
    destroy(): void {
      document.removeEventListener("selectionchange", update);
      fab.remove();
    },
  };
}
