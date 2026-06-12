export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function button(label: string, className: string, onClick: () => void): HTMLButtonElement {
  const b = el("button", className, label);
  b.type = "button";
  b.addEventListener("click", onClick);
  return b;
}

export function link(href: string, text: string, className?: string): HTMLAnchorElement | HTMLSpanElement {
  let url: URL;
  try {
    url = new URL(href, location.href);
  } catch {
    return el("span", className, text);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return el("span", className, text);
  const a = el("a", className, text);
  a.href = href;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  return a;
}

export function errorText(e: unknown): string {
  if (e instanceof Error && e.message) return e.message;
  return "Something went wrong";
}
