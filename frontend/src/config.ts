export interface WidgetConfig {
  ghc: number;
  src: string;
  page: string;
  repo: string;
  apiBaseUrl: string;
  label: string;
  tokenUrl: string | null;
  client: string;
  contentSelector: string | null;
}

function isString(v: unknown): v is string {
  return typeof v === "string";
}

function optionalString(v: unknown): v is string | null | undefined {
  return v === null || v === undefined || typeof v === "string";
}

export function readConfig(doc: Document): WidgetConfig | null {
  const el = doc.getElementById("ghc-config");
  if (!el || !el.textContent) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(el.textContent);
  } catch {
    return null;
  }
  if (typeof raw !== "object" || raw === null) return null;
  const o = raw as Record<string, unknown>;
  if (o["ghc"] !== 1) return null;
  if (!isString(o["src"]) || !isString(o["page"]) || !isString(o["repo"])) return null;
  if (!isString(o["apiBaseUrl"]) || !isString(o["label"])) return null;
  if (!optionalString(o["tokenUrl"]) || !optionalString(o["contentSelector"])) return null;
  return {
    ghc: 1,
    src: o["src"],
    page: o["page"],
    repo: o["repo"],
    apiBaseUrl: o["apiBaseUrl"].replace(/\/+$/, ""),
    label: o["label"],
    tokenUrl: o["tokenUrl"] ?? null,
    client: isString(o["client"]) ? o["client"] : "",
    contentSelector: o["contentSelector"] ?? null,
  };
}
