export type HighlightClickHandler = (issueNumber: number, anchor: HTMLElement) => void;

function fullyContains(r: Range, node: Text, doc: Document): boolean {
  const nr = doc.createRange();
  nr.selectNodeContents(node);
  return (
    r.compareBoundaryPoints(Range.START_TO_START, nr) <= 0 &&
    r.compareBoundaryPoints(Range.END_TO_END, nr) >= 0
  );
}

export function highlightRange(range: Range, issueNumber: number, onClick: HighlightClickHandler): () => void {
  const doc = range.startContainer.ownerDocument;
  if (!doc) return () => undefined;
  const r = range.cloneRange();
  if (r.startContainer.nodeType === Node.TEXT_NODE && r.startOffset > 0) {
    const t = r.startContainer as Text;
    const sameNodeEnd = r.endContainer === t ? r.endOffset - r.startOffset : null;
    const rest = t.splitText(r.startOffset);
    if (sameNodeEnd !== null) r.setEnd(rest, sameNodeEnd);
    r.setStart(rest, 0);
  }
  if (r.endContainer.nodeType === Node.TEXT_NODE) {
    const t = r.endContainer as Text;
    if (r.endOffset < t.data.length) t.splitText(r.endOffset);
  }
  const textNodes: Text[] = [];
  const top = r.commonAncestorContainer;
  if (top.nodeType === Node.TEXT_NODE) {
    textNodes.push(top as Text);
  } else {
    const walker = doc.createTreeWalker(top, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n !== null; n = walker.nextNode()) {
      const t = n as Text;
      if (t.data.length > 0 && fullyContains(r, t, doc)) textNodes.push(t);
    }
  }
  const marks: HTMLElement[] = [];
  for (const node of textNodes) {
    const parent = node.parentNode;
    if (!parent) continue;
    const mark = doc.createElement("mark");
    mark.className = "ghc-highlight";
    mark.setAttribute("data-ghc-issue", String(issueNumber));
    mark.setAttribute("tabindex", "0");
    mark.setAttribute("role", "button");
    parent.replaceChild(mark, node);
    mark.appendChild(node);
    mark.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      onClick(issueNumber, mark);
    });
    mark.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      event.stopPropagation();
      onClick(issueNumber, mark);
    });
    marks.push(mark);
  }
  return () => {
    for (const mark of marks) {
      const parent = mark.parentNode;
      if (!parent) continue;
      while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
      parent.removeChild(mark);
      parent.normalize();
    }
  };
}
