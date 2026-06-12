import { readConfig } from "./config";
import { createController } from "./controller";

declare global {
  interface Window {
    document$?: { subscribe(cb: () => void): unknown };
  }
}

let teardown: (() => void) | null = null;

function boot(): void {
  if (teardown) {
    teardown();
    teardown = null;
  }
  const cfg = readConfig(document);
  if (!cfg) return;
  teardown = createController(cfg).start();
}

function onReady(): void {
  if (window.document$) {
    window.document$.subscribe(boot);
  } else {
    boot();
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", onReady);
} else {
  onReady();
}
